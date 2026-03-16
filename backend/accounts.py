"""Facebook accounts API and check account logic."""
import base64
import json
import sys
import os
import threading
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import FacebookAccount, Proxy, TemplateAccount, TemplateAction, User
from .schemas import (
    AccountBulkImportRequest, AccountExportCodeResponse, AccountImportCodeRequest,
    CheckAccountRequest, FacebookAccountCreate, FacebookAccountResponse, FacebookAccountUpdate,
)
from .auth import get_current_user

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from automation.browser_manager import start_browser, load_cookies, open_facebook, is_logged_in, close_browser
from automation.proxy_manager import rotate_proxy, get_proxy_dict

router = APIRouter(prefix="/accounts", tags=["accounts"])

# account_id -> selenium WebDriver instance (persistent browsers)
_open_browsers: dict = {}


@router.get("", response_model=List[FacebookAccountResponse])
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FacebookAccount).filter(FacebookAccount.user_id == current_user.id).all()


@router.post("", response_model=FacebookAccountResponse)
def create_account(
    data: FacebookAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = FacebookAccount(
        user_id=current_user.id,
        name=data.name,
        cookies=data.cookies,
        user_agent=data.user_agent,
        proxy_id=data.proxy_id,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@router.post("/import", response_model=List[FacebookAccountResponse])
def import_accounts(
    data: AccountBulkImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk import accounts (e.g. from AdsPower TXT)."""
    created = []
    for item in data.accounts:
        acc = FacebookAccount(
            user_id=current_user.id,
            name=item.name,
            cookies=item.cookies,
            user_agent=item.user_agent,
            proxy_id=data.proxy_id,
        )
        db.add(acc)
        db.flush()
        db.refresh(acc)
        created.append(acc)
    db.commit()
    return created


@router.get("/export-code", response_model=AccountExportCodeResponse)
def export_accounts_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a shareable base64 code containing all user's accounts."""
    accounts = db.query(FacebookAccount).filter(FacebookAccount.user_id == current_user.id).all()
    payload = [
        {"name": a.name, "cookies": a.cookies, "user_agent": a.user_agent}
        for a in accounts
    ]
    code = base64.b64encode(json.dumps({"accounts": payload}).encode()).decode()
    return {"code": code, "count": len(payload)}


@router.post("/import-code", response_model=List[FacebookAccountResponse])
def import_from_code(
    data: AccountImportCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import accounts from a shareable export code."""
    try:
        decoded = json.loads(base64.b64decode(data.code.strip()).decode())
        accounts_data = decoded.get("accounts", [])
    except Exception:
        raise HTTPException(400, "Неверный код импорта")
    created = []
    for item in accounts_data:
        acc = FacebookAccount(
            user_id=current_user.id,
            name=item.get("name", ""),
            cookies=item.get("cookies", ""),
            user_agent=item.get("user_agent"),
            proxy_id=data.proxy_id,
        )
        db.add(acc)
        db.flush()
        db.refresh(acc)
        created.append(acc)
    db.commit()
    return created


@router.patch("/{account_id}", response_model=FacebookAccountResponse)
def update_account(
    account_id: int,
    data: FacebookAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = db.query(FacebookAccount).filter(
        FacebookAccount.id == account_id,
        FacebookAccount.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    if data.name is not None:
        acc.name = data.name
    if data.cookies is not None:
        acc.cookies = data.cookies
    if data.user_agent is not None:
        acc.user_agent = data.user_agent
    # proxy_id can be set to None (remove proxy) or a new id
    if "proxy_id" in data.model_fields_set:
        acc.proxy_id = data.proxy_id
    db.commit()
    db.refresh(acc)
    return acc


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = db.query(FacebookAccount).filter(
        FacebookAccount.id == account_id,
        FacebookAccount.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    # Remove account from template account lists
    db.query(TemplateAccount).filter(TemplateAccount.account_id == account_id).delete()
    # Set account_id to NULL in template actions (preserve actions with "Не выбрано")
    db.query(TemplateAction).filter(TemplateAction.account_id == account_id).update({"account_id": None})
    db.flush()
    db.delete(acc)
    db.commit()
    # Also close browser if open
    if account_id in _open_browsers:
        try:
            close_browser(_open_browsers.pop(account_id))
        except Exception:
            pass
    return {"ok": True}


@router.get("/open-status")
def open_status(current_user: User = Depends(get_current_user)):
    """Return list of account IDs that currently have an open browser."""
    return {"open": list(_open_browsers.keys())}


@router.post("/{account_id}/open")
def open_account_browser(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Open a persistent browser for this account (non-headless, stays open)."""
    if account_id in _open_browsers:
        return {"ok": True, "message": "Браузер уже открыт"}

    acc = db.query(FacebookAccount).filter(
        FacebookAccount.id == account_id,
        FacebookAccount.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(404, "Account not found")

    proxy = None
    if acc.proxy_id:
        p = db.query(Proxy).filter(Proxy.id == acc.proxy_id).first()
        if p:
            proxy = get_proxy_dict(p)
            rotate_proxy(proxy)

    def _launch():
        try:
            driver = start_browser(proxy=proxy, user_agent=acc.user_agent, headless=False)
            _open_browsers[account_id] = driver
            load_cookies(driver, acc.cookies)
            open_facebook(driver)
            # Block thread until browser is closed by user
            while True:
                import time
                time.sleep(2)
                try:
                    _ = driver.window_handles
                except Exception:
                    break
        except Exception:
            pass
        finally:
            _open_browsers.pop(account_id, None)

    t = threading.Thread(target=_launch, daemon=True)
    t.start()
    return {"ok": True, "message": "Браузер открывается..."}


@router.post("/{account_id}/close-browser")
def close_account_browser(
    account_id: int,
    current_user: User = Depends(get_current_user),
):
    """Programmatically close the open browser for this account."""
    driver = _open_browsers.pop(account_id, None)
    if driver is None:
        return {"ok": True, "message": "Браузер не был открыт"}
    try:
        close_browser(driver)
    except Exception:
        pass
    return {"ok": True, "message": "Браузер закрыт"}


@router.post("/{account_id}/check")
def check_account(
    account_id: int,
    data: CheckAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acc = db.query(FacebookAccount).filter(
        FacebookAccount.id == account_id,
        FacebookAccount.user_id == current_user.id,
    ).first()
    if not acc:
        raise HTTPException(404, "Account not found")

    proxy = None
    if acc.proxy_id:
        p = db.query(Proxy).filter(Proxy.id == acc.proxy_id).first()
        if p:
            proxy = get_proxy_dict(p)
            rotate_proxy(proxy)

    driver = None
    try:
        driver = start_browser(proxy=proxy, user_agent=acc.user_agent, headless=not bool(data.show_browser))
        load_cookies(driver, acc.cookies)
        open_facebook(driver)
        authorized = is_logged_in(driver)
        acc.is_valid = authorized
        from datetime import datetime
        acc.last_check = datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "message": f"{'Authorized' if authorized else 'Not authorized'} | URL: {driver.current_url}",
            "is_authorized": authorized,
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "is_authorized": None,
        }
    finally:
        if driver:
            close_browser(driver)
