"""Proxies CRUD API."""
import os
import sys
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from automation.proxy_manager import check_proxy, get_proxy_dict

from .database import get_db
from .models import Proxy, User
from .schemas import ProxyCreate, ProxyResponse
from .auth import get_current_user

router = APIRouter(prefix="/proxies", tags=["proxies"])


@router.get("", response_model=List[ProxyResponse])
def list_proxies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Proxy).filter(Proxy.user_id == current_user.id).all()


@router.post("", response_model=ProxyResponse)
def create_proxy(
    data: ProxyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = Proxy(
        user_id=current_user.id,
        name=data.name,
        ip=data.ip,
        port=data.port,
        login=data.login,
        password=data.password,
        rotate_url=data.rotate_url,
        rotate_delay=data.rotate_delay,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{proxy_id}")
def delete_proxy(
    proxy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Proxy).filter(Proxy.id == proxy_id, Proxy.user_id == current_user.id).first()
    if not p:
        raise HTTPException(404, "Proxy not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{proxy_id}/check")
def check_proxy_endpoint(
    proxy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Proxy).filter(Proxy.id == proxy_id, Proxy.user_id == current_user.id).first()
    if not p:
        raise HTTPException(404, "Proxy not found")
    ok = check_proxy(get_proxy_dict(p))
    return {"success": ok, "message": "Proxy works" if ok else "Proxy failed"}
