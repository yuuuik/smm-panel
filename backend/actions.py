"""Actions (tasks) API: template-based, start/stop."""
import threading
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Task, Template, User
from .schemas import TaskCreate, TaskResponse
from .auth import get_current_user
from .task_runner import run_task, request_stop

router = APIRouter(prefix="/actions", tags=["actions"])

_tasks_threads: dict = {}

FREE_TASK_LIMIT = 5


def _is_pro(user: User) -> bool:
    sub = getattr(user, 'subscription', 'free') or 'free'
    if sub == 'pro':
        exp = getattr(user, 'subscription_expires_at', None)
        if exp is None or exp > datetime.utcnow():
            return True
    return False


def _task_to_response(task: Task) -> TaskResponse:
    template_name = None
    if task.template_id and task.template:
        template_name = task.template.name
    return TaskResponse(
        id=task.id,
        template_id=task.template_id,
        post_urls=task.post_urls or ([task.post_url] if task.post_url else []),
        max_comments=task.max_comments,
        rotate_proxy_mode=task.rotate_proxy_mode,
        show_browser=task.show_browser,
        status=task.status,
        progress_current=task.progress_current,
        progress_total=task.progress_total,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        error_message=task.error_message,
        template_name=template_name,
    )


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = db.query(Task).filter(Task.user_id == current_user.id, Task.template_id.isnot(None)).order_by(Task.created_at.desc()).all()
    return [_task_to_response(t) for t in tasks]


@router.post("", response_model=TaskResponse)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tpl = db.query(Template).filter(Template.id == data.template_id, Template.user_id == current_user.id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")

    # Enforce free-plan task limit (5 tasks total, no reset)
    if not _is_pro(current_user):
        total_tasks = db.query(Task).filter(
            Task.user_id == current_user.id,
        ).count()
        if total_tasks >= FREE_TASK_LIMIT:
            raise HTTPException(429, detail={
                "message": f"Лимит задач исчерпан. Тариф Free позволяет {FREE_TASK_LIMIT} задач на аккаунт. Перейдите на Pro для безлимитного доступа.",
                "reset_at": None,
            })

    action_count = len(tpl.actions)
    account_count = len(tpl.accounts)
    if action_count == 0 and account_count == 0:
        raise HTTPException(400, "Template has no actions")
    post_urls = [u.strip() for u in (data.post_urls or []) if u.strip()]
    if not post_urls:
        raise HTTPException(400, "Укажите хотя бы один URL поста")
    account_ids = sorted({action.account_id for action in tpl.actions}) or [ta.account_id for ta in tpl.accounts]
    task = Task(
        user_id=current_user.id,
        task_type="template_scenario",
        template_id=data.template_id,
        post_urls=post_urls,
        account_ids=account_ids,
        delay_min=0,
        delay_max=0,
        max_comments=data.max_comments,
        rotate_proxy_mode=data.rotate_proxy_mode,
        show_browser=data.show_browser,
        status="pending",
        progress_total=(action_count or account_count) * len(post_urls),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    if t.status == "running":
        request_stop(task_id)
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    if t.status == "running":
        raise HTTPException(409, "Нельзя редактировать запущенную задачу")
    tpl = db.query(Template).filter(Template.id == data.template_id, Template.user_id == current_user.id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")
    post_urls = [u.strip() for u in (data.post_urls or []) if u.strip()]
    if not post_urls:
        raise HTTPException(400, "Укажите хотя бы один URL поста")
    action_count = len(tpl.actions)
    account_count = len(tpl.accounts)
    account_ids = sorted({action.account_id for action in tpl.actions}) or [ta.account_id for ta in tpl.accounts]
    t.template_id = data.template_id
    t.post_urls = post_urls
    t.max_comments = data.max_comments
    t.rotate_proxy_mode = data.rotate_proxy_mode
    t.show_browser = data.show_browser
    t.account_ids = account_ids
    t.progress_total = (action_count or account_count) * len(post_urls)
    t.progress_current = 0
    t.status = "pending"
    db.commit()
    db.refresh(t)
    return _task_to_response(t)


@router.post("/{task_id}/start")
def start_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_email_verified:
        raise HTTPException(403, "Подтвердите email перед запуском задач")
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    # Allow restart if task is "running" but thread is no longer alive (e.g. after server restart)
    existing_thread = _tasks_threads.get(task_id)
    if t.status == "running" and existing_thread and existing_thread.is_alive():
        return {"ok": True, "message": "Already running"}
    t.status = "pending"
    t.progress_current = 0
    db.commit()
    th = threading.Thread(target=run_task, args=(task_id,), daemon=True)
    th.start()
    _tasks_threads[task_id] = th
    return {"ok": True, "message": "Started"}


@router.post("/{task_id}/stop")
def stop_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    request_stop(task_id)
    return {"ok": True, "message": "Stop requested"}


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    return _task_to_response(t)
