"""Admin API: manage users (admin-only)."""
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, FacebookAccount, Proxy, Template, Task, LogEntry, SupportTicket, SupportMessage
from .auth import get_current_admin, get_password_hash

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    telegram: Optional[str]
    is_admin: bool
    is_email_verified: bool
    created_at: Optional[datetime]
    accounts_count: int
    proxies_count: int
    templates_count: int
    tasks_count: int
    subscription: str
    subscription_expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    new_password: Optional[str] = None
    is_email_verified: Optional[bool] = None


class AdminCreateUser(BaseModel):
    email: str
    password: str
    username: Optional[str] = None
    is_email_verified: bool = False


@router.get("/users", response_model=List[AdminUserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    users = db.query(User).order_by(User.created_at).all()
    result = []
    for u in users:
        result.append(AdminUserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            telegram=u.telegram,
            is_admin=bool(u.is_admin),
            is_email_verified=bool(u.is_email_verified),
            created_at=u.created_at,
            accounts_count=db.query(FacebookAccount).filter(FacebookAccount.user_id == u.id).count(),
            proxies_count=db.query(Proxy).filter(Proxy.user_id == u.id).count(),
            templates_count=db.query(Template).filter(Template.user_id == u.id).count(),
            tasks_count=db.query(Task).filter(Task.user_id == u.id).count(),
            subscription=u.subscription or "free",
            subscription_expires_at=u.subscription_expires_at,
        ))
    return result


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Пользователь не найден")
    if u.id == current_admin.id and data.is_admin is False:
        raise HTTPException(400, "Нельзя снять права администратора у себя")
    if data.is_admin is not None:
        u.is_admin = data.is_admin
    if data.is_email_verified is not None:
        u.is_email_verified = data.is_email_verified
    if data.new_password:
        if len(data.new_password) < 6:
            raise HTTPException(422, "Пароль должен содержать минимум 6 символов")
        u.password_hash = get_password_hash(data.new_password)
    db.commit()
    db.refresh(u)
    return AdminUserResponse(
        id=u.id,
        username=u.username,
        email=u.email,
        telegram=u.telegram,
        is_admin=bool(u.is_admin),
        is_email_verified=bool(u.is_email_verified),
        created_at=u.created_at,
        accounts_count=db.query(FacebookAccount).filter(FacebookAccount.user_id == u.id).count(),
        proxies_count=db.query(Proxy).filter(Proxy.user_id == u.id).count(),
        templates_count=db.query(Template).filter(Template.user_id == u.id).count(),
        tasks_count=db.query(Task).filter(Task.user_id == u.id).count(),
        subscription=u.subscription or "free",
        subscription_expires_at=u.subscription_expires_at,
    )


@router.post("/users", response_model=AdminUserResponse)
def create_user(
    data: AdminCreateUser,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email уже используется")
    username = data.username or data.email.split('@')[0]
    base = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base}{counter}"
        counter += 1
    u = User(
        username=username,
        email=data.email,
        password_hash=get_password_hash(data.password),
        is_email_verified=data.is_email_verified,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return AdminUserResponse(
        id=u.id, username=u.username, email=u.email, telegram=u.telegram,
        is_admin=False, is_email_verified=bool(u.is_email_verified),
        created_at=u.created_at,
        accounts_count=0, proxies_count=0, templates_count=0, tasks_count=0,
        subscription="free", subscription_expires_at=None,
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(400, "Нельзя удалить самого себя")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Пользователь не найден")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/users/{user_id}/tasks")
def get_user_tasks(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .order_by(Task.created_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "status": t.status,
            "post_url": t.post_url,
            "template_name": t.template.name if t.template else None,
            "progress_current": t.progress_current,
            "progress_total": t.progress_total,
            "error_message": t.error_message,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "started_at": t.started_at.isoformat() if t.started_at else None,
            "finished_at": t.finished_at.isoformat() if t.finished_at else None,
        })
    return result


@router.get("/tasks/{task_id}/logs")
def get_task_logs(
    task_id: int,
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    logs = (
        db.query(LogEntry)
        .filter(LogEntry.task_id == task_id)
        .order_by(LogEntry.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "account_name": l.account_name,
            "action": l.action,
            "message": l.message,
            "success": l.success,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


# ── Support ticket admin endpoints ───────────────────────────────────────────

class AdminReplyRequest(BaseModel):
    text: str


class AdminTicketStatusUpdate(BaseModel):
    status: str  # "open" or "closed"


def _admin_ticket_dict(t: SupportTicket, messages: bool = False) -> dict:
    d = {
        "id": t.id,
        "user_id": t.user_id,
        "user_email": t.user.email if t.user else None,
        "user_username": t.user.username if t.user else None,
        "subject": t.subject,
        "status": t.status,
        "message_count": len(t.messages),
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
    if messages:
        d["messages"] = [
            {
                "id": m.id,
                "sender_type": m.sender_type,
                "text": m.text,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in t.messages
        ]
    return d


@router.get("/support/tickets")
def admin_list_tickets(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    tickets = (
        db.query(SupportTicket)
        .order_by(SupportTicket.updated_at.desc())
        .all()
    )
    return [_admin_ticket_dict(t) for t in tickets]


@router.get("/support/tickets/{ticket_id}")
def admin_get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    return _admin_ticket_dict(t, messages=True)


@router.post("/support/tickets/{ticket_id}/reply")
def admin_reply_ticket(
    ticket_id: int,
    data: AdminReplyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    if not data.text.strip():
        raise HTTPException(422, "Ответ не может быть пустым")

    msg = SupportMessage(ticket_id=t.id, sender_type="admin", text=data.text.strip())
    db.add(msg)
    if t.status == "closed":
        t.status = "open"
    t.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.patch("/support/tickets/{ticket_id}")
def admin_update_ticket(
    ticket_id: int,
    data: AdminTicketStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if data.status not in ("open", "closed"):
        raise HTTPException(422, "Статус должен быть open или closed")
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    t.status = data.status
    t.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/support/tickets/{ticket_id}")
def admin_delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    db.delete(t)
    db.commit()
    return {"ok": True}


# ── Subscription management ───────────────────────────────────────────────────

class AdminSubscriptionUpdate(BaseModel):
    subscription: str  # "free" or "pro"
    subscription_expires_at: Optional[datetime] = None


@router.patch("/users/{user_id}/subscription")
def set_user_subscription(
    user_id: int,
    data: AdminSubscriptionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if data.subscription not in ("free", "pro"):
        raise HTTPException(422, "Подписка должна быть 'free' или 'pro'")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Пользователь не найден")
    u.subscription = data.subscription
    if data.subscription == "pro":
        if data.subscription_expires_at:
            u.subscription_expires_at = data.subscription_expires_at
        else:
            u.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
    else:
        u.subscription_expires_at = None
    db.commit()
    db.refresh(u)
    return {
        "id": u.id,
        "subscription": u.subscription,
        "subscription_expires_at": u.subscription_expires_at,
    }

