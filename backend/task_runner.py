"""Task runner for manual scenario templates with ordered per-account actions."""
import sys
import os
import time
from datetime import datetime
from typing import Optional, Dict, Any

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from sqlalchemy.orm import Session
from automation.browser_manager import start_browser, load_cookies, open_facebook, close_browser
from automation.proxy_manager import rotate_proxy, get_proxy_dict
from .database import SessionLocal
from .models import Task, Template, TemplateAction, FacebookAccount, Proxy, LogEntry
from .facebook_bot import (
    react_to_post as bot_react_to_post,
    react_to_post_result as bot_react_to_post_result,
    react_to_post_http_result as bot_react_to_post_http_result,
    comment_post as bot_comment_post,
    comment_post_result as bot_comment_post_result,
    comment_post_http_result as bot_comment_post_http_result,
    react_to_comment as bot_react_to_comment,
    react_to_comment_result as bot_react_to_comment_result,
    react_to_comment_http_result as bot_react_to_comment_http_result,
    reply_to_comment as bot_reply_to_comment,
    reply_to_comment_result as bot_reply_to_comment_result,
    reply_to_comment_http_result as bot_reply_to_comment_http_result,
    get_comments_for_post,
    random_delay,
)


_stop_flags: dict = {}


def _should_stop(task_id: int) -> bool:
    return _stop_flags.get(task_id, False)


def request_stop(task_id: int) -> None:
    _stop_flags[task_id] = True


def _log(db: Session, task_id: Optional[int], account_name: str, action: str, message: str, success: bool = True):
    e = LogEntry(task_id=task_id, account_name=account_name, action=action, message=message, success=success)
    db.add(e)
    db.commit()


def _resolve_image_path(image_path: Optional[str]) -> Optional[str]:
    if not image_path:
        return None
    if os.path.isabs(image_path) and os.path.isfile(image_path):
        return image_path
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    full_path = os.path.join(upload_dir, image_path)
    if os.path.isfile(full_path):
        return full_path
    return None


def _normalize_target(target_comment: Optional[str]) -> str:
    return (target_comment or "random").strip().lower()


def _extract_target_index(target_comment: str) -> Optional[int]:
    value = target_comment.replace("comment", "").replace("#", "").replace(" ", "")
    if value.isdigit():
        return int(value)
    return None


def _resolve_comment_target(
    target_comment: Optional[str],
    last_bot_comment: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Return target_info dict for Selenium-based comment resolution.

    Returns: {"type": "last_bot_comment"|"random"|"index", "text": ..., "index": ...}
    """
    target = _normalize_target(target_comment)
    if target == "last_bot_comment":
        if last_bot_comment:
            return last_bot_comment
        return {"type": "last_bot_comment", "text": ""}
    if target in {"", "random"}:
        return {"type": "random"}
    index = _extract_target_index(target)
    if index is not None:
        return {"type": "index", "index": max(0, index - 1)}  # 1-based to 0-based
    return {"type": "random"}


def _wait_after_action(delay_seconds: Optional[float]) -> None:
    if delay_seconds and delay_seconds > 0:
        time.sleep(delay_seconds)


def _open_post_page(driver, post_url: str, show_browser: bool) -> None:
    driver.get(post_url)
    time.sleep(3 if show_browser else 1.5)


def _debug_pause_on_failure(task: Task) -> None:
    if task.show_browser:
        time.sleep(8)


def _describe_action(action: TemplateAction) -> str:
    parts = [action.action_type]
    if action.reaction_type:
        parts.append(f"reaction={action.reaction_type}")
    if action.target_comment:
        parts.append(f"target={action.target_comment}")
    if action.text:
        preview = action.text.strip().replace("\n", " ")
        parts.append(f"text={preview[:60]}")
    return ", ".join(parts)


def _run_manual_scenario(
    db: Session,
    task: Task,
    template: Template,
    proxies_by_id: Dict[int, Dict[str, Any]],
) -> None:
    actions = sorted(template.actions, key=lambda item: item.action_order)
    # Collect URLs: prefer task.post_urls list, fall back to single task.post_url for backward compat
    post_urls: list = []
    if task.post_urls:
        post_urls = [u for u in task.post_urls if u and u.strip()]
    if not post_urls and task.post_url:
        post_urls = [task.post_url]
    max_comments = task.max_comments or 10

    task.progress_total = len(actions) * max(1, len(post_urls))
    task.progress_current = 0
    db.commit()

    step = 0
    for url in post_urls:
        last_bot_comment: Optional[Dict[str, str]] = None
        for index, action in enumerate(actions, start=1):
            if _should_stop(task.id):
                task.status = "stopped"
                db.commit()
                return

            account = db.query(FacebookAccount).filter(FacebookAccount.id == action.account_id).first()
            if not account:
                _log(db, task.id, f"account:{action.account_id}", action.action_type, "Account not found", False)
                step += 1
                task.progress_current = step
                db.commit()
                continue

            if not url:
                _log(db, task.id, account.name, action.action_type, "No post URL", False)
                step += 1
                task.progress_current = step
                db.commit()
                continue

            proxy = proxies_by_id.get(account.proxy_id) if account.proxy_id else None
            if proxy and task.rotate_proxy_mode in {"before_account", "before_each_action"}:
                rotate_proxy(proxy)

            driver = None
            try:
                _log(db, task.id, account.name, "step_start", f"step #{index}: {_describe_action(action)}", True)
                driver = start_browser(proxy=proxy, user_agent=account.user_agent, headless=not bool(task.show_browser))
                load_cookies(driver, account.cookies)
                open_facebook(driver)
                _open_post_page(driver, url, bool(task.show_browser))

                ok = False
                message = ""
                if action.action_type == "react_post":
                    reaction = (action.reaction_type or "LIKE").upper()
                    result = bot_react_to_post_http_result(driver, url, reaction)
                    ok = result.get("success", False)
                    message = f"reacted to post ({reaction}) via HTTP"
                    if result.get("reason"):
                        message = f"{message} | reason={result['reason']}"
                    if result.get("post_id"):
                        message = f"{message} | post_id={result['post_id']}"

                elif action.action_type == "comment_post":
                    image_path = _resolve_image_path(action.image_path)
                    result = bot_comment_post_http_result(
                        driver,
                        url,
                        (action.text or "").strip(),
                        image_path,
                    )
                    ok = result.get("success", False)
                    message = "commented on post (HTTP)"
                    if not ok and result.get("reason"):
                        message = f"{message} | reason={result['reason']}"
                    if result.get("post_id"):
                        message = f"{message} | post_id={result['post_id']}"
                    if ok:
                        last_bot_comment = {
                            "type": "last_bot_comment",
                            "text": (action.text or "").strip(),
                            "comment_id": str(result.get("comment_id") or ""),
                            "post_id": str(result.get("post_id") or ""),
                        }

                elif action.action_type == "reply_comment":
                    target_info = _resolve_comment_target(action.target_comment, last_bot_comment)
                    _cid = target_info.get("comment_id", "")
                    _pid = target_info.get("post_id", "")
                    _img = _resolve_image_path(action.image_path)
                    if _cid and _pid:
                        result = bot_reply_to_comment_http_result(
                            driver,
                            url,
                            str(_pid),
                            str(_cid),
                            (action.text or "").strip(),
                            _img,
                        )
                        message = f"replied to comment HTTP ({action.target_comment or 'last'})"
                    else:
                        result = bot_reply_to_comment_result(
                            driver,
                            account.cookies,
                            account.user_agent,
                            target_info,
                            (action.text or "").strip(),
                            _img,
                        )
                        message = f"replied to comment ({action.target_comment or 'random'})"
                    ok = result.get("success", False)
                    if not ok and result.get("reason"):
                        message = f"{message} | reason={result['reason']}"
                    if ok:
                        _new_pid = result.get("post_id") or _pid
                        last_bot_comment = {
                            "type": "last_bot_comment",
                            "text": (action.text or "").strip(),
                            "comment_id": str(result.get("comment_id") or ""),
                            "post_id": str(_new_pid or ""),
                        }

                elif action.action_type == "react_comment":
                    target_info = _resolve_comment_target(action.target_comment, last_bot_comment)
                    reaction = (action.reaction_type or "LIKE").upper()
                    # Use HTTP when we have explicit comment_id + post_id (e.g. from last_bot_comment)
                    _cid = target_info.get("comment_id", "")
                    _pid = target_info.get("post_id", "")
                    if _cid and _pid:
                        result = bot_react_to_comment_http_result(
                            driver,
                            url,
                            str(_pid),
                            str(_cid),
                            reaction,
                        )
                        message = f"reacted to comment HTTP ({reaction})"
                    else:
                        result = bot_react_to_comment_result(
                            driver,
                            account.cookies,
                            account.user_agent,
                            target_info,
                            reaction,
                        )
                        message = f"reacted to comment ({reaction})"
                    ok = result.get("success", False)
                    if not ok and result.get("reason"):
                        message = f"{message} | reason={result['reason']}"

                else:
                    message = f"Unsupported action type: {action.action_type}"

                if not ok:
                    current_url = ""
                    try:
                        current_url = driver.current_url
                    except Exception:
                        current_url = ""
                    if current_url:
                        message = f"{message} | page={current_url}"
                    _debug_pause_on_failure(task)

                _log(db, task.id, account.name, action.action_type, message, ok)

            except Exception as exc:
                _debug_pause_on_failure(task)
                _log(db, task.id, account.name, action.action_type, str(exc), False)
            finally:
                if driver:
                    close_browser(driver)

            step += 1
            task.progress_current = step
            db.commit()
            _wait_after_action(action.delay)


def _run_legacy_template(
    db: Session,
    task: Task,
    template: Template,
    proxies_by_id: Dict[int, Dict[str, Any]],
) -> None:
    account_ids = [ta.account_id for ta in template.accounts]
    accounts = db.query(FacebookAccount).filter(FacebookAccount.id.in_(account_ids)).all()
    if not accounts:
        task.status = "error"
        task.error_message = "No accounts in template"
        db.commit()
        return

    post_url = task.post_url or template.post_url or ""
    max_comments = task.max_comments or 10
    delay_min, delay_max = template.delay_min, template.delay_max
    reaction_type = template.reaction_type if template.reaction_type and template.reaction_type != "NONE" else None
    comment_text = (template.comment_text or "").strip()
    reply_text = (template.reply_text or "").strip()
    image_path = _resolve_image_path(template.image_path)

    task.progress_total = len(accounts)
    task.progress_current = 0
    db.commit()

    for index, template_account in enumerate(template.accounts):
        if _should_stop(task.id):
            task.status = "stopped"
            db.commit()
            return

        account = db.query(FacebookAccount).filter(FacebookAccount.id == template_account.account_id).first()
        if not account:
            continue

        proxy = proxies_by_id.get(account.proxy_id) if account.proxy_id else None
        if proxy and task.rotate_proxy_mode in {"before_account", "before_each_action"}:
            rotate_proxy(proxy)

        driver = None
        try:
            driver = start_browser(proxy=proxy, user_agent=account.user_agent, headless=not bool(task.show_browser))
            load_cookies(driver, account.cookies)
            open_facebook(driver)
            _open_post_page(driver, post_url, bool(task.show_browser))
            random_delay(delay_min, delay_max)

            if not post_url:
                _log(db, task.id, account.name, "skip", "No post URL", False)
                task.progress_current = index + 1
                db.commit()
                continue

            if reaction_type:
                ok = bot_react_to_post(driver, account.cookies, account.user_agent, post_url, reaction_type)
                _log(db, task.id, account.name, "react_to_post", f"reacted ({reaction_type})", ok)

            if comment_text:
                ok = bot_comment_post(driver, account.cookies, account.user_agent, post_url, comment_text, image_path)
                _log(db, task.id, account.name, "comment_post", "commented on post", ok)
                random_delay(delay_min, delay_max)

            comments = get_comments_for_post(driver, post_url, max_comments=max_comments)
            for i, comment in enumerate(comments):
                if _should_stop(task.id):
                    break
                t_info = {"type": "index", "index": comment.get("index", i)}
                if reply_text:
                    ok = bot_reply_to_comment(
                        driver,
                        account.cookies,
                        account.user_agent,
                        t_info,
                        reply_text,
                    )
                    _log(db, task.id, account.name, "reply_to_comment", "replied to comment", ok)
                if reaction_type:
                    ok = bot_react_to_comment(
                        driver,
                        account.cookies,
                        account.user_agent,
                        t_info,
                        reaction_type,
                    )
                    _log(db, task.id, account.name, "react_to_comment", "liked comment", ok)
                random_delay(delay_min, delay_max)

        except Exception as exc:
            _debug_pause_on_failure(task)
            _log(db, task.id, account.name, "error", str(exc), False)
        finally:
            if driver:
                close_browser(driver)

        task.progress_current = index + 1
        db.commit()
        random_delay(delay_min, delay_max)


def run_task(task_id: int) -> None:
    """Run task against either manual scenario actions or legacy templates."""
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task or task.template_id is None or task.status not in ("pending", "stopped"):
            return

        template = db.query(Template).filter(Template.id == task.template_id).first()
        if not template:
            task.status = "error"
            task.error_message = "Template not found"
            db.commit()
            return

        task.status = "running"
        task.started_at = datetime.utcnow()
        task.progress_current = 0
        db.commit()

        proxies_by_id = {p.id: get_proxy_dict(p) for p in db.query(Proxy).all()}
        if template.actions:
            _run_manual_scenario(db, task, template, proxies_by_id)
        else:
            _run_legacy_template(db, task, template, proxies_by_id)

        task = db.query(Task).filter(Task.id == task_id).first()
        if not task or task.status == "stopped":
            return

        task.progress_current = task.progress_total
        task.status = "completed"
        task.finished_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = "error"
            task.error_message = str(e)
            db.commit()
    finally:
        if task_id in _stop_flags:
            del _stop_flags[task_id]
        db.close()
