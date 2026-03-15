"""Logs API."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .database import get_db
from .models import LogEntry, Task, User
from .schemas import LogEntryResponse
from .auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


def _user_task_ids(db: Session, user_id: int):
    """Return set of task IDs owned by the given user."""
    rows = db.query(Task.id).filter(Task.user_id == user_id).all()
    return {r[0] for r in rows}


@router.get("", response_model=List[LogEntryResponse])
def list_logs(
    task_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(LogEntry).order_by(LogEntry.created_at.desc())
    if not current_user.is_admin:
        allowed = _user_task_ids(db, current_user.id)
        if task_id is not None:
            if task_id not in allowed:
                return []
            q = q.filter(LogEntry.task_id == task_id)
        else:
            if not allowed:
                return []
            q = q.filter(LogEntry.task_id.in_(allowed))
    elif task_id is not None:
        q = q.filter(LogEntry.task_id == task_id)
    return q.limit(limit).all()


@router.delete("/all")
def delete_all_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_admin:
        db.query(LogEntry).delete()
    else:
        allowed = _user_task_ids(db, current_user.id)
        if allowed:
            db.query(LogEntry).filter(LogEntry.task_id.in_(allowed)).delete(synchronize_session=False)
    db.commit()
    return {"detail": "Logs deleted"}
