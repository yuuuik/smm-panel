"""Support tickets: users create tickets, admin replies."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from .models import SupportTicket, SupportMessage, User
from .auth import get_current_user

router = APIRouter(prefix="/support", tags=["support"])


class CreateTicketRequest(BaseModel):
    subject: str
    message: str


class AddMessageRequest(BaseModel):
    text: str


def _msg_dict(m: SupportMessage) -> dict:
    return {
        "id": m.id,
        "sender_type": m.sender_type,
        "text": m.text,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _ticket_dict(t: SupportTicket, messages: bool = False) -> dict:
    d = {
        "id": t.id,
        "subject": t.subject,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "message_count": len(t.messages),
    }
    if messages:
        d["messages"] = [_msg_dict(m) for m in t.messages]
    return d


@router.post("/tickets")
def create_ticket(
    data: CreateTicketRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not data.subject.strip():
        raise HTTPException(422, "Тема обращения не может быть пустой")
    if not data.message.strip():
        raise HTTPException(422, "Сообщение не может быть пустым")

    ticket = SupportTicket(user_id=user.id, subject=data.subject.strip())
    db.add(ticket)
    db.flush()

    msg = SupportMessage(ticket_id=ticket.id, sender_type="user", text=data.message.strip())
    db.add(msg)
    db.commit()
    db.refresh(ticket)
    return _ticket_dict(ticket, messages=True)


@router.get("/tickets")
def list_tickets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.updated_at.desc())
        .all()
    )
    return [_ticket_dict(t) for t in tickets]


@router.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == user.id,
    ).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    return _ticket_dict(t, messages=True)


@router.post("/tickets/{ticket_id}/messages")
def add_message(
    ticket_id: int,
    data: AddMessageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == user.id,
    ).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    if t.status == "closed":
        raise HTTPException(400, "Обращение закрыто")
    if not data.text.strip():
        raise HTTPException(422, "Сообщение не может быть пустым")

    msg = SupportMessage(ticket_id=t.id, sender_type="user", text=data.text.strip())
    db.add(msg)
    t.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/tickets/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == user.id,
    ).first()
    if not t:
        raise HTTPException(404, "Обращение не найдено")
    db.delete(t)
    db.commit()
    return {"ok": True}
