"""Manual scenario template API: one template = post URL + ordered actions list."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import FacebookAccount, Template, TemplateAccount, TemplateAction, User
from .schemas import TemplateActionResponse, TemplateCreate, TemplateResponse
from .auth import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])

ACTION_TYPES = {"react_post", "comment_post", "reply_comment", "react_comment"}


def _normalize_reaction(value: str | None) -> str | None:
    if not value or value == "NONE":
        return None
    return value.upper()


def _validate_actions(db: Session, actions, user_id: int) -> None:
    if not actions:
        raise HTTPException(400, "Template must contain at least one action")

    account_ids = {action.account_id for action in actions}
    existing_ids = {
        row[0]
        for row in db.query(FacebookAccount.id)
        .filter(FacebookAccount.id.in_(account_ids), FacebookAccount.user_id == user_id)
        .all()
    }
    missing_ids = sorted(account_ids - existing_ids)
    if missing_ids:
        raise HTTPException(400, f"Accounts not found: {', '.join(str(x) for x in missing_ids)}")

    for index, action in enumerate(actions, start=1):
        if action.action_type not in ACTION_TYPES:
            raise HTTPException(400, f"Unsupported action_type at position {index}")
        if action.action_type in {"comment_post", "reply_comment"} and not ((action.text or "").strip() or action.image_path):
            raise HTTPException(400, f"Action #{index} requires text or image")
        if action.action_type == "reply_comment" and not (action.text or "").strip():
            raise HTTPException(400, f"Action #{index} requires reply text")
        if action.action_type in {"react_post", "react_comment"} and not _normalize_reaction(action.reaction_type):
            raise HTTPException(400, f"Action #{index} requires reaction_type")


def _template_to_response(t: Template) -> TemplateResponse:
    actions = [
        TemplateActionResponse(
            id=action.id,
            action_order=action.action_order,
            account_id=action.account_id,
            action_type=action.action_type,
            reaction_type=action.reaction_type,
            text=action.text,
            image_path=action.image_path,
            target_comment=action.target_comment,
            delay=action.delay,
        )
        for action in sorted(t.actions, key=lambda item: item.action_order)
    ]
    account_ids = sorted({action.account_id for action in actions} | {ta.account_id for ta in t.accounts})
    return TemplateResponse(
        id=t.id,
        name=t.name,
        post_url=t.post_url,
        reaction_type=t.reaction_type,
        comment_text=t.comment_text,
        reply_text=t.reply_text,
        image_path=t.image_path,
        delay_min=t.delay_min,
        delay_max=t.delay_max,
        created_at=t.created_at,
        account_ids=account_ids,
        actions=actions,
        action_count=len(actions),
    )


def _replace_template_actions(db: Session, template_id: int, actions) -> None:
    db.query(TemplateAction).filter(TemplateAction.template_id == template_id).delete()
    for index, action in enumerate(actions, start=1):
        db.add(
            TemplateAction(
                template_id=template_id,
                action_order=index,
                account_id=action.account_id,
                action_type=action.action_type,
                reaction_type=_normalize_reaction(action.reaction_type),
                text=(action.text or "").strip() or None,
                image_path=action.image_path or None,
                target_comment=(action.target_comment or "").strip() or None,
                delay=action.delay,
            )
        )


@router.get("", response_model=List[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    templates = db.query(Template).filter(Template.user_id == current_user.id).order_by(Template.created_at.desc()).all()
    return [_template_to_response(t) for t in templates]


@router.post("", response_model=TemplateResponse)
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_actions(db, data.actions, current_user.id)
    t = Template(
        user_id=current_user.id,
        name=data.name,
        post_url=(data.post_url or "").strip() or None,
        reaction_type=None,
        comment_text=None,
        reply_text=None,
        image_path=None,
        delay_min=0,
        delay_max=0,
    )
    db.add(t)
    db.flush()
    _replace_template_actions(db, t.id, data.actions)
    db.commit()
    db.refresh(t)
    return _template_to_response(t)


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Template).filter(Template.id == template_id, Template.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    return _template_to_response(t)


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Template).filter(Template.id == template_id, Template.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    _validate_actions(db, data.actions, current_user.id)
    t.name = data.name
    t.post_url = (data.post_url or "").strip() or None
    t.reaction_type = None
    t.comment_text = None
    t.reply_text = None
    t.image_path = None
    t.delay_min = 0
    t.delay_max = 0
    db.query(TemplateAccount).filter(TemplateAccount.template_id == template_id).delete()
    _replace_template_actions(db, template_id, data.actions)
    db.commit()
    db.refresh(t)
    return _template_to_response(t)


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Template).filter(Template.id == template_id, Template.user_id == current_user.id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()
    return {"ok": True}
