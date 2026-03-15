"""Facebook bot — pure Selenium UI automation for all four post actions.

Every action (react_post, comment_post, reply_comment, react_comment)
is performed through real browser clicks, hovers and key presses.
No HTTP / GraphQL shortcuts are used.
"""
import logging
import os
import random
import time
from typing import Optional, Dict, Any, List

from selenium import webdriver
from selenium.common.exceptions import (
    WebDriverException,
    StaleElementReferenceException,
    ElementClickInterceptedException,
    TimeoutException,
)
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logger = logging.getLogger(__name__)
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement

import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from automation.browser_manager import (
    start_browser,
    load_cookies,
    open_facebook,
    is_logged_in,
    close_browser,
)
from automation.proxy_manager import rotate_proxy, get_proxy_dict, assign_proxy
from automation.fb_requests import get_post_id_from_url

# ── Reaction label mapping (EN + RU) ─────────────────────────────
REACTION_MAP = {
    "LIKE":  {"en": "Like",  "ru": "Нравится"},
    "LOVE":  {"en": "Love",  "ru": "Супер"},
    "HAHA":  {"en": "Haha",  "ru": "Ха-ха"},
    "WOW":   {"en": "Wow",   "ru": "Ух ты"},
    "SAD":   {"en": "Sad",   "ru": "Сочувствую"},
    "ANGRY": {"en": "Angry", "ru": "Возмутительно"},
}

WAIT_LONG = 7
WAIT_MED = 4
WAIT_SHORT = 2


# ══════════════════════════════════════════════════════════════════
#  Low-level helpers
# ══════════════════════════════════════════════════════════════════

def _sleep(s: float) -> None:
    time.sleep(max(0.1, s))


def _scroll_into_view(driver: webdriver.Chrome, el: WebElement) -> None:
    driver.execute_script(
        "arguments[0].scrollIntoView({block:'center',behavior:'smooth'});", el)
    _sleep(0.3)


def _fb_scroll_to_element(driver: webdriver.Chrome, el: WebElement) -> None:
    """Scroll Facebook's custom scrollable container to bring element into view.

    FB wraps content in a div with overflow-y: auto/scroll.
    Regular scrollIntoView scrolls the window but not that container.
    This finds the nearest scrollable ancestor and scrolls IT.
    """
    driver.execute_script("""
        var el = arguments[0];
        // Walk up DOM to find the scrollable container
        var p = el.parentElement;
        var container = null;
        while (p && p !== document.documentElement) {
            var s = window.getComputedStyle(p);
            if ((s.overflowY === 'auto' || s.overflowY === 'scroll')
                && p.scrollHeight > p.clientHeight
                && p.clientHeight > 200) {
                container = p;
                break;
            }
            p = p.parentElement;
        }
        if (container) {
            var elRect = el.getBoundingClientRect();
            var cRect  = container.getBoundingClientRect();
            container.scrollTop += elRect.top - cRect.top - cRect.height / 3;
        } else {
            el.scrollIntoView({block: 'center', behavior: 'instant'});
        }
    """, el)
    _sleep(0.5)


def _js_click(driver: webdriver.Chrome, el: WebElement) -> None:
    driver.execute_script("arguments[0].click();", el)


def _safe_click(driver: webdriver.Chrome, el: WebElement) -> None:
    _scroll_into_view(driver, el)
    try:
        el.click()
    except (ElementClickInterceptedException, WebDriverException):
        _js_click(driver, el)


def _is_displayed_safe(el: WebElement) -> bool:
    try:
        return el.is_displayed()
    except StaleElementReferenceException:
        return False


def _find_any(ctx, locators: List[tuple], timeout: float = WAIT_LONG) -> Optional[WebElement]:
    """Try multiple (By, selector) pairs, return first visible match."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        for by, sel in locators:
            try:
                for el in ctx.find_elements(by, sel):
                    try:
                        if el.is_displayed():
                            return el
                    except StaleElementReferenceException:
                        continue
            except Exception:
                continue
        _sleep(0.5)
    return None


def _dismiss_cookie_banners(driver: webdriver.Chrome) -> None:
    """Dismiss Facebook cookie consent banners if present."""
    try:
        for sel in [
            "[data-testid='cookie-policy-manage-dialog-accept-button']",
            "button[data-cookiebanner='accept_button']",
        ]:
            btns = driver.find_elements(By.CSS_SELECTOR, sel)
            for b in btns:
                if b.is_displayed():
                    b.click()
                    _sleep(1)
                    break
    except Exception:
        pass


def _highlight(driver: webdriver.Chrome, el: WebElement) -> None:
    """Temporarily highlight element with red border for debug visibility."""
    try:
        driver.execute_script(
            "var e=arguments[0];"
            "e.style.outline='3px solid red';"
            "setTimeout(function(){e.style.outline='';}, 2000);", el)
    except Exception:
        pass


def _ensure_in_viewport(driver: webdriver.Chrome, el: WebElement) -> None:
    """Ensure element is within the visible viewport; scroll if needed."""
    try:
        in_vp = driver.execute_script("""
            var rect = arguments[0].getBoundingClientRect();
            return (rect.top >= 0 && rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth));
        """, el)
        if not in_vp:
            _scroll_into_view(driver, el)
    except Exception:
        pass


def _ensure_clickable_parent(driver: webdriver.Chrome, el: WebElement) -> WebElement:
    """If el is a plain span/text, walk up to the nearest role='button' ancestor."""
    try:
        tag = el.tag_name.lower()
        role = (el.get_attribute("role") or "").lower()
        if role == "button" or tag in ("button", "a"):
            return el
        parent = el.find_element(By.XPATH, "ancestor::*[@role='button'][1]")
        if parent:
            return parent
    except Exception:
        pass
    return el


def _wait_for_reply_box(
    driver: webdriver.Chrome, timeout: float = 7,
    old_boxes: Optional[List[WebElement]] = None,
) -> Optional[WebElement]:
    """Wait for a NEW reply textbox to appear after clicking Reply.

    Compares current visible textboxes against old_boxes references.
    Returns the element that is new (not in old_boxes).
    """
    old_ids = set()
    if old_boxes:
        for b in old_boxes:
            try:
                old_ids.add(b.id)
            except Exception:
                pass

    deadline = time.time() + timeout
    while time.time() < deadline:
        boxes = driver.find_elements(
            By.CSS_SELECTOR, "div[role='textbox'][contenteditable='true']")
        for b in boxes:
            try:
                if b.is_displayed() and b.id not in old_ids:
                    return b
            except StaleElementReferenceException:
                continue
        _sleep(0.3)
    return None


def _find_post_container(driver: webdriver.Chrome) -> Optional[WebElement]:
    """Find the main post article/container on a permalink page."""
    locators = [
        (By.CSS_SELECTOR, "div[role='article']"),
        (By.CSS_SELECTOR, "div[data-pagelet='FeedUnit']"),
        (By.CSS_SELECTOR, "div[data-pagelet*='FeedUnit']"),
        (By.XPATH, "//div[@role='main']//div[@role='article']"),
        (By.CSS_SELECTOR, "div[role='main']"),
    ]
    for by, sel in locators:
        try:
            els = driver.find_elements(by, sel)
            for el in els:
                if el.is_displayed():
                    return el
        except Exception:
            continue
    return None


def _find_scrollable_container(driver: webdriver.Chrome) -> Optional[WebElement]:
    """Find the real scrollable div Facebook uses (overflow-y: auto/scroll)."""
    try:
        return driver.execute_script("""
            var all = document.querySelectorAll('div');
            for (var i = 0; i < all.length; i++) {
                var s = window.getComputedStyle(all[i]);
                if ((s.overflowY === 'auto' || s.overflowY === 'scroll')
                    && all[i].scrollHeight > all[i].clientHeight
                    && all[i].clientHeight > 300) {
                    return all[i];
                }
            }
            return null;
        """)
    except Exception:
        return None


def _scroll_down(driver: webdriver.Chrome, px: int = 400) -> None:
    """Scroll Facebook page down by px pixels.

    Targets both the window and Facebook's custom overflow scroll container.
    This is necessary because FB wraps its feed in a div with overflow-y:scroll
    and regular window.scrollBy / Arrow Down only moves the browser window.
    """
    try:
        driver.execute_script("""
            var px = arguments[0];
            // 1. Scroll the browser window
            window.scrollBy(0, px);
            // 2. Find the largest scrollable div and scroll it too
            var best = null, bestArea = 0;
            var all = document.querySelectorAll('div');
            for (var i = 0; i < all.length; i++) {
                var el = all[i];
                var s = window.getComputedStyle(el);
                if ((s.overflowY === 'auto' || s.overflowY === 'scroll')
                    && el.scrollHeight > el.clientHeight
                    && el.clientHeight > 200) {
                    var area = el.clientWidth * el.clientHeight;
                    if (area > bestArea) { bestArea = area; best = el; }
                }
            }
            if (best) best.scrollTop += px;
        """, px)
    except Exception:
        pass
    _sleep(0.15)


def _is_in_viewport(driver: webdriver.Chrome, el) -> bool:
    """Return True only if el is in the visible viewport (not just in the DOM)."""
    try:
        return bool(driver.execute_script(
            "var r=arguments[0].getBoundingClientRect();"
            "return r.width>0 && r.height>0"
            " && r.top>=0 && r.bottom<=(window.innerHeight||document.documentElement.clientHeight);",
            el))
    except Exception:
        return False


def _scroll_to_reactions(driver: webdriver.Chrome) -> None:
    """Scroll until the Like button is actually inside the viewport."""
    _sleep(1.5)  # let FB finish initial render
    _dismiss_cookie_banners(driver)

    for _ in range(12):  # up to 12 × 300px = 3600px
        # Stop only when a Like button is TRULY visible in the viewport
        for by, sel in _like_btn_locators():
            try:
                for el in driver.find_elements(by, sel):
                    if el.is_displayed() and _is_in_viewport(driver, el):
                        return
            except Exception:
                pass
        _scroll_down(driver, 300)
        _sleep(0.25)


# ══════════════════════════════════════════════════════════════════
#  Locator factories
# ══════════════════════════════════════════════════════════════════

def _find_like_btn_js(driver: webdriver.Chrome):
    """Find the Like button via JS — no is_displayed() restriction.

    Searches all [role='button'] elements whose aria-label or text is an exact
    match for 'Like' / 'Нравится' (and common FB translations).
    Returns the DOM element or None.
    """
    try:
        return driver.execute_script("""
            var LABELS = ['Like','Нравится','Мне нравится','like','нравится',
                          'J\'aime','Me gusta','Curtir','Gefällt mir','いいね!'];
            var btns = document.querySelectorAll('[role="button"]');
            // First pass: exact aria-label match
            for (var i = 0; i < btns.length; i++) {
                var lbl = btns[i].getAttribute('aria-label') || '';
                for (var j = 0; j < LABELS.length; j++) {
                    if (lbl === LABELS[j]) return btns[i];
                }
            }
            // Second pass: exact innerText match
            for (var i = 0; i < btns.length; i++) {
                var txt = (btns[i].innerText || '').trim();
                for (var j = 0; j < LABELS.length; j++) {
                    if (txt === LABELS[j]) return btns[i];
                }
            }
            // Third pass: aria-label starts-with (e.g. "Like: 42")
            for (var i = 0; i < btns.length; i++) {
                var lbl = (btns[i].getAttribute('aria-label') || '').toLowerCase();
                if (lbl === 'like' || lbl.indexOf('like:') === 0
                    || lbl === 'нравится' || lbl.indexOf('нравится:') === 0) {
                    return btns[i];
                }
            }
            return null;
        """)
    except Exception:
        return None


def _like_btn_locators() -> List[tuple]:
    """Locators for the Like button in the post action bar.

    Uses global XPath with [1] index to grab the FIRST Like button on the page,
    which is always the post's Like button (comment Likes come after).
    """
    return [
        (By.XPATH,
         "(//div[@role='button'][@aria-label='Like' or @aria-label='Нравится'])[1]"),
        (By.XPATH,
         "(//div[@role='button'][.//span[normalize-space()='Like'"
         " or normalize-space()='Нравится']])[1]"),
        (By.XPATH,
         "(//span[normalize-space()='Like' or normalize-space()='Нравится']"
         "/ancestor::div[@role='button'])[1]"),
        (By.XPATH,
         "(//*[@role='button'][contains(translate(@aria-label,"
         "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'like')])[1]"),
        (By.CSS_SELECTOR, "[data-testid='like_button']"),
    ]


def _reaction_popup_locators(reaction: str) -> List[tuple]:
    """Locators for a specific reaction inside the hover popup."""
    info = REACTION_MAP.get(reaction.upper(), {})
    labels = [info.get("en", reaction.title())]
    if info.get("ru"):
        labels.append(info["ru"])
    locs: List[tuple] = []
    for lbl in labels:
        # Popup items with aria-label
        locs.append(
            (By.XPATH,
             f"//div[@role='dialog' or @role='tooltip' or @role='menu']"
             f"//div[@role='button'][@aria-label='{lbl}']"))
        # Any positioned button with label (popup overlays)
        locs.append(
            (By.XPATH,
             f"//*[@role='button'][@aria-label='{lbl}']"))
    return locs


def _comment_box_locators() -> List[tuple]:
    """Locators for the comment text input."""
    return [
        (By.XPATH,
         ".//div[@role='textbox'][@contenteditable='true']"
         "[contains(@aria-label,'comment') or contains(@aria-label,'Comment')"
         " or contains(@aria-label,'комментарий') or contains(@aria-label,'Комментарий')"
         " or contains(@aria-label,'Write a comment')"
         " or contains(@aria-label,'Написать комментарий')]"),
        (By.XPATH,
         ".//div[@role='textbox'][@contenteditable='true']"
         "[contains(@aria-placeholder,'comment') or contains(@aria-placeholder,'Comment')"
         " or contains(@aria-placeholder,'комментарий')]"),
        # last resort: first contenteditable inside context
        (By.XPATH,
         "(.//div[@role='textbox'][@contenteditable='true'])[1]"),
    ]


def _comment_btn_locators() -> List[tuple]:
    """The 'Comment' button in the action bar to open comment section."""
    return [
        (By.XPATH,
         ".//div[@role='button'][.//span[normalize-space()='Comment'"
         " or normalize-space()='Комментарий']]"),
        (By.XPATH,
         ".//div[@role='button'][@aria-label='Leave a comment'"
         " or @aria-label='Comment' or @aria-label='Комментарий']"),
    ]


# ══════════════════════════════════════════════════════════════════
#  Comment DOM helpers  (for reply_comment / react_comment)
# ══════════════════════════════════════════════════════════════════

def _load_more_comments(driver: webdriver.Chrome) -> None:
    """Click 'View more comments' / 'Most relevant' links to load comments."""
    expand_locators = [
        (By.XPATH,
         "//div[@role='button'][contains(.,'View more comments')"
         " or contains(.,'Ещё комментарии') or contains(.,'Показать')]"),
        (By.XPATH,
         "//span[@role='button'][contains(.,'View more comments')"
         " or contains(.,'Ещё комментарии')]"),
    ]
    for _ in range(3):
        btn = _find_any(driver, expand_locators, timeout=2)
        if not btn:
            break
        try:
            _safe_click(driver, btn)
            _sleep(2)
        except Exception:
            break


def _get_comment_elements(driver: webdriver.Chrome) -> List[WebElement]:
    """Return visible comment article elements (skip the post itself)."""
    arts = driver.find_elements(By.CSS_SELECTOR, "div[role='article']")
    result: List[WebElement] = []
    for a in arts[1:]:  # first article is the main post
        try:
            if a.is_displayed():
                result.append(a)
        except StaleElementReferenceException:
            pass
    return result


def _find_comment_by_text(driver: webdriver.Chrome, text: str) -> Optional[WebElement]:
    needle = text.strip().lower()
    for el in _get_comment_elements(driver):
        try:
            if needle in el.text.lower():
                return el
        except StaleElementReferenceException:
            continue
    return None


def _find_comment_by_index(driver: webdriver.Chrome, idx: int) -> Optional[WebElement]:
    cs = _get_comment_elements(driver)
    return cs[idx] if 0 <= idx < len(cs) else None


def _resolve_comment_el(
    driver: webdriver.Chrome, target_info: Dict[str, Any]
) -> Optional[WebElement]:
    """Resolve target_info dict to a comment WebElement in the DOM.

    target_info keys:
      type = "last_bot_comment" | "random" | "index"
      text = posted text (for last_bot_comment)
      index = 0-based index
    """
    t = target_info.get("type", "random")
    if t == "last_bot_comment":
        txt = target_info.get("text", "")
        if txt:
            el = _find_comment_by_text(driver, txt)
            if el:
                return el
        # fallback: last comment in DOM
        cs = _get_comment_elements(driver)
        return cs[-1] if cs else None
    if t == "index":
        return _find_comment_by_index(driver, target_info.get("index", 0))
    # random
    cs = _get_comment_elements(driver)
    return random.choice(cs) if cs else None


def _find_on_comment(comment_el: WebElement, locators: List[tuple]) -> Optional[WebElement]:
    """Find a sub-element within a comment container or its parent wrapper.

    Facebook puts Like inside the article but Reply in a sibling div.
    So we search both the element itself AND its parent.
    """
    # First search within the comment element
    for by, sel in locators:
        try:
            for el in comment_el.find_elements(by, sel):
                if el.is_displayed():
                    return el
        except Exception:
            continue
    # If not found, search in parent (2 levels up to cover wrapper divs)
    try:
        parent = comment_el.find_element(By.XPATH, "..")
        for by, sel in locators:
            try:
                for el in parent.find_elements(by, sel):
                    if el.is_displayed():
                        return el
            except Exception:
                continue
        grandparent = parent.find_element(By.XPATH, "..")
        for by, sel in locators:
            try:
                for el in grandparent.find_elements(by, sel):
                    if el.is_displayed():
                        return el
            except Exception:
                continue
    except Exception:
        pass
    return None


def _comment_like_locs() -> List[tuple]:
    return [
        (By.XPATH,
         ".//div[@role='button'][@aria-label='Like' or @aria-label='Нравится']"),
        (By.XPATH,
         ".//span[normalize-space()='Like' or normalize-space()='Нравится']"
         "/ancestor::div[@role='button'][1]"),
        (By.XPATH,
         ".//span[@role='button'][normalize-space()='Like' or normalize-space()='Нравится']"),
    ]


def _comment_reply_locs() -> List[tuple]:
    return [
        (By.XPATH,
         ".//div[@role='button'][.//span[normalize-space()='Reply'"
         " or normalize-space()='Ответить']]"),
        (By.XPATH,
         ".//div[@role='button'][@aria-label='Reply' or @aria-label='Ответить']"),
        (By.XPATH,
         ".//span[@role='button'][normalize-space()='Reply' or normalize-space()='Ответить']"),
        # FB sometimes uses a plain link-like span with text Reply
        (By.XPATH,
         ".//span[normalize-space()='Reply' or normalize-space()='Ответить']"),
        # or a link/anchor
        (By.XPATH,
         ".//a[normalize-space()='Reply' or normalize-space()='Ответить']"),
    ]


def _click_reply_via_like_offset(
    driver: webdriver.Chrome, comment_el: WebElement
) -> bool:
    """Find Reply by moving the mouse right from the Like button.

    FB comment footer layout:  Like · Reply · 3h
    Reply is always to the right of Like.
    """
    like_btn = _find_on_comment(comment_el, _comment_like_locs())
    if not like_btn:
        logger.warning("[reply_offset] Like button not found on comment")
        return False

    _fb_scroll_to_element(driver, like_btn)
    _sleep(0.5)
    _highlight(driver, like_btn)

    # Try elementFromPoint at various offsets to the right of Like
    for offset in [40, 60, 80, 100, 30, 120]:
        try:
            el = driver.execute_script("""
                var like = arguments[0];
                var offset = arguments[1];
                var rect = like.getBoundingClientRect();
                var x = rect.right + offset;
                var y = rect.top + rect.height / 2;
                var target = document.elementFromPoint(x, y);
                if (!target) return null;
                // Check the element itself and ancestors for Reply text
                var node = target;
                for (var i = 0; i < 5 && node; i++) {
                    var txt = (node.textContent || '').trim();
                    if (txt === 'Reply' || txt === 'Ответить') return node;
                    node = node.parentElement;
                }
                // Also check child spans
                var spans = target.querySelectorAll('span');
                for (var j = 0; j < spans.length; j++) {
                    var st = (spans[j].textContent || '').trim();
                    if (st === 'Reply' || st === 'Ответить') return spans[j];
                }
                return null;
            """, like_btn, offset)
            if el:
                logger.info("[reply_offset] found Reply at offset %dpx right of Like", offset)
                _highlight(driver, el)
                # Walk up to clickable parent
                el = _ensure_clickable_parent(driver, el)
                _js_click(driver, el)
                return True
        except Exception:
            continue

    # Last resort: blind click to the right of Like
    logger.warning("[reply_offset] elementFromPoint failed, blind-clicking 60px right of Like")
    try:
        ActionChains(driver).move_to_element(like_btn).move_by_offset(60, 0).click().perform()
        return True
    except Exception as exc:
        logger.error("[reply_offset] blind click failed: %s", exc)
        return False


# ══════════════════════════════════════════════════════════════════
#  Image attachment (into comment / reply)
# ══════════════════════════════════════════════════════════════════

def _attach_image(driver: webdriver.Chrome, path: str) -> Optional[str]:
    """Send image file directly to input[type='file'] WITHOUT clicking any button.

    We find the correct file input for the *comment* section (accepts images),
    make it visible, and send the path. No button click = no OS file dialog.
    """
    if not path or not os.path.isfile(path):
        return f"image not found: {path}"
    abspath = os.path.abspath(path)

    # Find file inputs and pick the one that accepts images
    inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
    if not inputs:
        # Reveal hidden inputs
        driver.execute_script("""
            document.querySelectorAll('input[type="file"]').forEach(function(el){
                el.style.display='block'; el.style.visibility='visible';
                el.style.height='1px'; el.style.width='1px'; el.style.opacity='0.01';
            });
        """)
        _sleep(0.5)
        inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
    if not inputs:
        return "file input not found"

    # Prefer a file input that accepts images (not video-only etc.)
    # and that is NOT inside the main post composer.
    fi = None
    for inp in reversed(inputs):
        accept = (inp.get_attribute("accept") or "").lower()
        if "image" in accept or "video" in accept or accept == "" or "*" in accept:
            fi = inp
            break
    if not fi:
        fi = inputs[-1]

    try:
        driver.execute_script(
            "var e=arguments[0];"
            "e.style.display='block'; e.style.visibility='visible';"
            "e.style.height='1px'; e.style.width='1px'; e.style.opacity='0.01';"
            "e.style.position='absolute'; e.style.zIndex='99999';"
            "if(e.hasAttribute('multiple')) {}; e.removeAttribute('disabled');",
            fi)
        fi.send_keys(abspath)
        _sleep(3)  # wait for upload/preview to show
        return None
    except Exception as exc:
        return str(exc)


# ══════════════════════════════════════════════════════════════════
#  PUBLIC API — browser / cookies
# ══════════════════════════════════════════════════════════════════

def open_browser(proxy=None, user_agent=None, headless=True):
    return start_browser(proxy=proxy, user_agent=user_agent, headless=headless)


def load_cookies_to_browser(driver, cookies_json):
    load_cookies(driver, cookies_json)
    open_facebook(driver)


def extract_tokens_from_browser(driver):
    from .token_extractor import extract_tokens
    return extract_tokens(driver)


def random_delay(lo: float, hi: float) -> None:
    time.sleep(random.uniform(lo, hi))


# ══════════════════════════════════════════════════════════════════
#  react_post  — HTTP (no UI, no scroll)
# ══════════════════════════════════════════════════════════════════

def react_to_post_http_result(
    driver: webdriver.Chrome,
    post_url: str,
    reaction_type: str = "LIKE",
) -> Dict[str, Any]:
    """Like/react to a post via direct HTTP request.

    The driver must already be on the post page (task_runner calls _open_post_page first).
    Extracts live tokens + cookies from the Selenium session, then sends
    an HTTP POST — no scrolling, no clicking buttons.
    """
    import re as _re
    import base64 as _b64
    from automation.fb_requests import react_to_post_result as _http_react

    pid = get_post_id_from_url(post_url)

    # Let page fully render and dismiss banners
    _sleep(2)
    _dismiss_cookie_banners(driver)

    # 1. Extract CSRF tokens from page (fb_dtsg / lsd / jazoest)
    tokens = extract_tokens_from_browser(driver)
    if not tokens or not tokens.get("fb_dtsg"):
        return {"success": False, "reason": "fb_dtsg not found on page", "post_id": pid}

    # 2. Get live cookies from Selenium (more reliable than stored JSON)
    try:
        cook = {c["name"]: c["value"] for c in driver.get_cookies() if c.get("name")}
    except Exception as e:
        return {"success": False, "reason": f"cookie extract: {e}", "post_id": pid}

    c_user = cook.get("c_user", "")

    # Build feedback_id directly from numeric post id — never read from page source
    # (page source feedback_id is often a comment's feedback, not the post's)
    numeric_id = ""
    if pid:
        numeric_id = str(pid).split("_")[-1] if "_" in str(pid) else str(pid)
    feedback_id = _b64.b64encode(f"feedback:{numeric_id}".encode()).decode() if numeric_id.isdigit() else (str(pid) if pid else "")

    # doc_id для CometUFIFeedbackReactMutation — подтверждён из браузерного захвата
    # Пробуем точно извлечь из страницы, иначе используем проверенный hardcoded
    REACT_DOC_ID_FALLBACK = "33371893662453814"
    doc_id = None
    try:
        page_src = driver.page_source
        # Точный паттерн: ищем doc_id рядом с именем мутации CometUFIFeedbackReactMutation
        for pattern in [
            r'"CometUFIFeedbackReactMutation"[^}]{0,200}"id"\s*:\s*"(\d{14,})"',
            r'fb_api_req_friendly_name["\s:]+CometUFIFeedbackReactMutation["\s,}]{0,200}doc_id["\s:]+(\d{14,})',
        ]:
            m = _re.search(pattern, page_src)
            if m:
                doc_id = m.group(1)
                break
    except Exception:
        pass
    if not doc_id:
        doc_id = REACT_DOC_ID_FALLBACK

    # 6. Get live user-agent from browser
    try:
        ua = driver.execute_script("return navigator.userAgent;") or ""
    except Exception:
        ua = ""

    logger.info("[react_post_http] pid=%s feedback_id=%s doc_id=%s reaction=%s c_user=%s",
                pid, feedback_id[:30] if feedback_id else "?", doc_id, reaction_type, c_user)

    result = _http_react(
        fb_dtsg=tokens["fb_dtsg"],
        lsd=tokens.get("lsd", ""),
        jazoest=tokens.get("jazoest", ""),
        post_id=feedback_id,
        numeric_id=numeric_id,
        reaction_type=reaction_type,
        cookies=cook,
        user_agent=ua,
        c_user=c_user,
        post_url=post_url,
        doc_id=doc_id,
    )
    result["post_id"] = pid
    return result


def comment_post_http_result(
    driver: webdriver.Chrome,
    post_url: str,
    comment_text: str,
    image_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Post a comment via direct HTTP request (no Selenium UI).

    Pass image_path to attach a photo — it will be uploaded first via
    upload.facebook.com, and the returned photo_id included in the mutation.
    The driver must already be on the post page.
    """
    import base64 as _b64
    from automation.fb_requests import (
        comment_post_result as _http_comment,
        upload_comment_photo_result as _http_upload_photo,
    )

    pid = get_post_id_from_url(post_url)

    _sleep(2)
    _dismiss_cookie_banners(driver)

    tokens = extract_tokens_from_browser(driver)
    if not tokens or not tokens.get("fb_dtsg"):
        return {"success": False, "reason": "fb_dtsg not found on page",
                "post_id": pid, "comment_id": None}

    try:
        cook = {c["name"]: c["value"] for c in driver.get_cookies() if c.get("name")}
    except Exception as e:
        return {"success": False, "reason": f"cookie extract: {e}",
                "post_id": pid, "comment_id": None}

    c_user = cook.get("c_user", "")

    try:
        ua = driver.execute_script("return navigator.userAgent;") or ""
    except Exception:
        ua = ""

    numeric_id = str(pid).split("_")[-1] if pid and "_" in str(pid) else str(pid or "")

    # Always build feedback_id directly from numeric post id — do NOT read from page
    # because the first feedback_id found in page source is often a comment's feedback,
    # not the post's top-level feedback.
    feedback_id = None
    if numeric_id.isdigit():
        try:
            feedback_id = _b64.b64encode(f"feedback:{numeric_id}".encode()).decode()
        except Exception:
            pass
    if not feedback_id:
        feedback_id = str(pid) if pid else ""

    logger.info("[comment_post_http] pid=%s feedback_id=%s c_user=%s text=%s image=%s",
                pid, feedback_id[:30] if feedback_id else "?", c_user,
                comment_text[:40] if comment_text else "",
                os.path.basename(image_path) if image_path else None)

    # Upload photo if provided
    photo_id = None
    if image_path:
        upload_result = _http_upload_photo(
            fb_dtsg=tokens["fb_dtsg"],
            lsd=tokens.get("lsd", ""),
            jazoest=tokens.get("jazoest", ""),
            image_path=image_path,
            cookies=cook,
            user_agent=ua,
            c_user=c_user,
        )
        if not upload_result.get("success"):
            return {"success": False,
                    "reason": f"photo upload failed: {upload_result.get('reason')}",
                    "post_id": pid, "comment_id": None}
        photo_id = upload_result["photo_id"]
        logger.info("[comment_post_http] photo_id=%s", photo_id)

    result = _http_comment(
        fb_dtsg=tokens["fb_dtsg"],
        lsd=tokens.get("lsd", ""),
        jazoest=tokens.get("jazoest", ""),
        post_id=feedback_id,
        comment_text=comment_text,
        cookies=cook,
        user_agent=ua,
        c_user=c_user,
        post_url=post_url,
        photo_id=photo_id,
    )
    result["post_id"] = pid
    return result


# ══════════════════════════════════════════════════════════════════
#  react_post  — Selenium UI (kept as fallback)
# ══════════════════════════════════════════════════════════════════

def react_to_post_result(
    driver: webdriver.Chrome,
    cookies_json: str,
    user_agent: Optional[str],
    post_url: str,
    reaction_type: str,
) -> Dict[str, Any]:
    pid = get_post_id_from_url(post_url)
    try:
        # Step 1: scroll down until Like button is in viewport
        _scroll_to_reactions(driver)

        # Step 2: find Like button
        btn = _find_any(driver, _like_btn_locators(), timeout=WAIT_LONG)

        # Step 3: if still not found, keep scrolling and retry
        if not btn:
            for _ in range(6):
                _scroll_down(driver, 300)
                _sleep(0.3)
                btn = _find_any(driver, _like_btn_locators(), timeout=2)
                if btn:
                    break

        # Diagnostic: log available aria-labels when button not found
        if not btn:
            try:
                labels = driver.execute_script(
                    "return Array.from(document.querySelectorAll('[role=\"button\"][aria-label]'))"
                    ".map(el=>el.getAttribute('aria-label')).filter(Boolean).slice(0,30);"
                )
                logger.warning("[react_post] like btn not found. Available aria-labels: %s", labels)
            except Exception:
                pass
            return {"success": False, "reason": "like button not found", "post_id": pid}

        # Step 4: center button in viewport
        driver.execute_script(
            "arguments[0].scrollIntoView({block:'center',behavior:'instant'});", btn)
        _sleep(0.5)
        _highlight(driver, btn)

        # Step 5: plain Like — click
        if reaction_type.upper() == "LIKE":
            _safe_click(driver, btn)
            _sleep(1)
            return {"success": True, "reason": None, "post_id": pid}

        # Step 6: hover Like to open reaction popup
        ActionChains(driver).move_to_element(btn).pause(1.5).perform()
        _sleep(0.8)

        rbtn = _find_any(driver, _reaction_popup_locators(reaction_type), timeout=WAIT_SHORT)
        if not rbtn:
            # Fallback: click-and-hold to force popup
            logger.info("[react_post] hover failed, trying click-and-hold fallback for %s", reaction_type)
            ActionChains(driver).click_and_hold(btn).pause(2).perform()
            _sleep(0.5)
            rbtn = _find_any(driver, _reaction_popup_locators(reaction_type), timeout=WAIT_SHORT)
            ActionChains(driver).release().perform()

        if not rbtn:
            # Final fallback: plain Like click
            logger.warning("[react_post] FALLBACK: popup not found, clicking Like instead of %s", reaction_type)
            _safe_click(driver, btn)
            _sleep(1)
            return {"success": True,
                    "reason": f"fallback: clicked Like instead of {reaction_type}",
                    "post_id": pid}

        # Step 7: click requested reaction
        _highlight(driver, rbtn)
        _safe_click(driver, rbtn)
        _sleep(1)
        return {"success": True, "reason": None, "post_id": pid}
    except Exception as exc:
        return {"success": False, "reason": str(exc), "post_id": pid}


def react_to_post(driver, cookies_json, user_agent, post_url, reaction_type):
    return react_to_post_result(
        driver, cookies_json, user_agent, post_url, reaction_type
    )["success"]


# ══════════════════════════════════════════════════════════════════
#  comment_post  — Selenium UI
# ══════════════════════════════════════════════════════════════════

def comment_post_result(
    driver: webdriver.Chrome,
    cookies_json: str,
    user_agent: Optional[str],
    post_url: str,
    comment_text: str,
    image_url: Optional[str] = None,
) -> Dict[str, Any]:
    pid = get_post_id_from_url(post_url)
    try:
        _scroll_to_reactions(driver)
        _sleep(0.5)

        # Find the post container to scope comment search within it
        post = _find_post_container(driver)
        search_ctx = post if post else driver

        # Open comment section (click 'Comment' button inside post)
        cbtn = _find_any(search_ctx, _comment_btn_locators(), timeout=WAIT_SHORT)
        if cbtn:
            _safe_click(driver, cbtn)
            _sleep(0.5)

        # Search for comment box inside the post container
        box = _find_any(search_ctx, _comment_box_locators(), timeout=WAIT_LONG)
        if not box:
            # Fallback: try global search
            box = _find_any(driver, _comment_box_locators(), timeout=WAIT_SHORT)
        if not box:
            return {"success": False, "reason": "comment box not found",
                    "post_id": pid, "comment_id": None, "feedback_id": None}

        _scroll_into_view(driver, box)
        _safe_click(driver, box)
        _sleep(0.3)

        if comment_text:
            box.send_keys(comment_text)
            _sleep(0.3)

        img_err = None
        if image_url:
            img_err = _attach_image(driver, image_url)

        if not comment_text and (not image_url or img_err):
            return {"success": False, "reason": "empty comment",
                    "post_id": pid, "comment_id": None, "feedback_id": None}

        box.send_keys(Keys.ENTER)
        _sleep(2.5)

        return {"success": True, "reason": img_err,
                "post_id": pid, "comment_id": None, "feedback_id": None,
                "posted_text": comment_text}
    except Exception as exc:
        return {"success": False, "reason": str(exc),
                "post_id": pid, "comment_id": None, "feedback_id": None}


def comment_post(driver, cookies_json, user_agent, post_url, text, image=None):
    return comment_post_result(
        driver, cookies_json, user_agent, post_url, text, image
    )["success"]


# ══════════════════════════════════════════════════════════════════
#  reply_comment  — HTTP
# ══════════════════════════════════════════════════════════════════

def reply_to_comment_http_result(
    driver: webdriver.Chrome,
    post_url: str,
    post_numeric_id: str,
    comment_numeric_id: str,
    reply_text: str,
    image_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Reply to a comment via direct HTTP request.

    post_numeric_id + comment_numeric_id are used to build the comment
    feedback_id and reply_comment_parent_fbid as required by the mutation.
    The driver must already be on the post page.
    """
    import base64 as _b64
    from automation.fb_requests import (
        reply_to_comment_result as _http_reply,
        upload_comment_photo_result as _http_upload_photo,
    )

    _sleep(1)

    tokens = extract_tokens_from_browser(driver)
    if not tokens or not tokens.get("fb_dtsg"):
        return {"success": False, "reason": "fb_dtsg not found on page",
                "comment_id": None}

    try:
        cook = {c["name"]: c["value"] for c in driver.get_cookies() if c.get("name")}
    except Exception as e:
        return {"success": False, "reason": f"cookie extract: {e}",
                "comment_id": None}

    c_user = cook.get("c_user", "")

    # Build comment feedback_id
    comment_feedback_id = _b64.b64encode(
        f"feedback:{post_numeric_id}_{comment_numeric_id}".encode()
    ).decode()

    try:
        ua = driver.execute_script("return navigator.userAgent;") or ""
    except Exception:
        ua = ""

    # Upload photo if provided
    photo_id = None
    if image_path:
        upload_result = _http_upload_photo(
            fb_dtsg=tokens["fb_dtsg"],
            lsd=tokens.get("lsd", ""),
            jazoest=tokens.get("jazoest", ""),
            image_path=image_path,
            cookies=cook,
            user_agent=ua,
            c_user=c_user,
        )
        if not upload_result.get("success"):
            return {"success": False,
                    "reason": f"photo upload failed: {upload_result.get('reason')}",
                    "comment_id": None}
        photo_id = upload_result["photo_id"]

    logger.info("[reply_comment_http] post=%s comment=%s c_user=%s text=%s image=%s",
                post_numeric_id, comment_numeric_id, c_user,
                reply_text[:40] if reply_text else "",
                os.path.basename(image_path) if image_path else None)

    return _http_reply(
        fb_dtsg=tokens["fb_dtsg"],
        lsd=tokens.get("lsd", ""),
        jazoest=tokens.get("jazoest", ""),
        comment_id=comment_numeric_id,
        feedback_id=comment_feedback_id,
        reply_text=reply_text,
        cookies=cook,
        user_agent=ua,
        c_user=c_user,
        post_url=post_url,
        post_id=post_numeric_id,
        photo_id=photo_id,
    )


# ══════════════════════════════════════════════════════════════════
#  reply_comment  — Selenium UI
# ══════════════════════════════════════════════════════════════════

def reply_to_comment_result(
    driver: webdriver.Chrome,
    cookies_json: str,
    user_agent: Optional[str],
    target_info: Dict[str, Any],
    reply_text: str,
    image_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Reply to a comment found via Selenium DOM search.

    target_info: {"type": "last_bot_comment"|"random"|"index",
                  "text": "...", "index": N}
    """
    try:
        _sleep(1)
        _dismiss_cookie_banners(driver)

        # Scroll post into view first to load comments area
        post = _find_post_container(driver)
        if post:
            _fb_scroll_to_element(driver, post)
            _sleep(0.5)

        # Scroll further & load more comments
        for _ in range(3):
            _scroll_down(driver, 500)
        _load_more_comments(driver)
        _sleep(0.5)

        cel = _resolve_comment_el(driver, target_info)
        if not cel:
            return {"success": False,
                    "reason": f"target comment not found ({target_info.get('type', '?')})",
                    "comment_id": None, "feedback_id": None}

        # Scroll comment into view
        _fb_scroll_to_element(driver, cel)
        _sleep(0.5)

        # Save references to ALL visible textboxes BEFORE clicking Reply
        _pre_boxes = driver.find_elements(
            By.CSS_SELECTOR, "div[role='textbox'][contenteditable='true']")
        _old_visible = [b for b in _pre_boxes if _is_displayed_safe(b)]

        # Click Reply — try XPath first, then offset approach
        # IMPORTANT: after click, do NOT scroll or click anything else
        reply_clicked = False
        rbtn = _find_on_comment(cel, _comment_reply_locs())
        if rbtn:
            rbtn = _ensure_clickable_parent(driver, rbtn)
            _js_click(driver, rbtn)
            reply_clicked = True
            logger.info("[reply_comment] clicked Reply via XPath")
        else:
            # Fallback — click to the right of Like button
            like_btn = _find_on_comment(cel, _comment_like_locs())
            if like_btn:
                # Single JS elementFromPoint click — no loops, no extra scrolling
                reply_clicked = driver.execute_script("""
                    var like = arguments[0];
                    var rect = like.getBoundingClientRect();
                    var offsets = [40, 60, 80, 100, 30, 120];
                    for (var k = 0; k < offsets.length; k++) {
                        var x = rect.right + offsets[k];
                        var y = rect.top + rect.height / 2;
                        var target = document.elementFromPoint(x, y);
                        if (!target) continue;
                        var node = target;
                        for (var i = 0; i < 5 && node; i++) {
                            var txt = (node.textContent || '').trim();
                            if (txt === 'Reply' || txt === 'Ответить') {
                                // Walk up to role=button
                                var btn = node;
                                for (var j = 0; j < 5 && btn; j++) {
                                    if (btn.getAttribute && btn.getAttribute('role') === 'button') break;
                                    btn = btn.parentElement;
                                }
                                (btn || node).click();
                                return true;
                            }
                            node = node.parentElement;
                        }
                    }
                    return false;
                """, like_btn) or False
                if reply_clicked:
                    logger.info("[reply_comment] clicked Reply via Like-offset (JS)")

        if not reply_clicked:
            return {"success": False,
                    "reason": "Reply button not found on comment",
                    "comment_id": None, "feedback_id": None}

        # Wait for a NEW reply textbox (one that wasn't in _old_visible)
        _sleep(0.5)
        rbox = _wait_for_reply_box(driver, timeout=WAIT_LONG, old_boxes=_old_visible)
        if not rbox:
            return {"success": False, "reason": "reply box not found after clicking Reply",
                    "comment_id": None, "feedback_id": None}

        # Focus and type — NO scrolling, NO clicking, just JS focus + keys
        driver.execute_script("arguments[0].focus();", rbox)
        _sleep(0.3)

        if reply_text:
            rbox.send_keys(reply_text)
            _sleep(0.3)

        img_err = None
        if image_url:
            img_err = _attach_image(driver, image_url)

        if not reply_text and (not image_url or img_err):
            return {"success": False, "reason": "empty reply",
                    "comment_id": None, "feedback_id": None}

        rbox.send_keys(Keys.ENTER)
        _sleep(2.5)

        return {"success": True, "reason": img_err,
                "comment_id": None, "feedback_id": None,
                "posted_text": reply_text}
    except Exception as exc:
        return {"success": False, "reason": str(exc),
                "comment_id": None, "feedback_id": None}


def reply_to_comment(driver, cookies_json, user_agent, target_info, text, image=None):
    return reply_to_comment_result(
        driver, cookies_json, user_agent, target_info, text, image
    )["success"]


# ══════════════════════════════════════════════════════════════════
#  react_comment  — HTTP
# ══════════════════════════════════════════════════════════════════

def react_to_comment_http_result(
    driver: webdriver.Chrome,
    post_url: str,
    post_numeric_id: str,
    comment_numeric_id: str,
    reaction_type: str = "LIKE",
) -> Dict[str, Any]:
    """React to a comment via direct HTTP request.

    post_numeric_id + comment_numeric_id are used to build
    base64("feedback:{post_id}_{comment_id}") as required by the mutation.
    The driver must already be on the post page.
    """
    import re as _re
    import base64 as _b64
    from automation.fb_requests import react_to_comment_result as _http_react_comment

    _sleep(1)

    tokens = extract_tokens_from_browser(driver)
    if not tokens or not tokens.get("fb_dtsg"):
        return {"success": False, "reason": "fb_dtsg not found on page"}

    try:
        cook = {c["name"]: c["value"] for c in driver.get_cookies() if c.get("name")}
    except Exception as e:
        return {"success": False, "reason": f"cookie extract: {e}"}

    c_user = cook.get("c_user", "")

    # Construct comment feedback_id
    comment_feedback_id = _b64.b64encode(
        f"feedback:{post_numeric_id}_{comment_numeric_id}".encode()
    ).decode()

    # doc_id для CometUFIFeedbackReactMutation — та же мутация что и для поста
    REACT_DOC_ID_FALLBACK = "33371893662453814"
    doc_id = None
    try:
        page_src = driver.page_source
        for pattern in [
            r'"CometUFIFeedbackReactMutation"[^}]{0,200}"id"\s*:\s*"(\d{14,})"',
            r'fb_api_req_friendly_name["\s:]+CometUFIFeedbackReactMutation["\s,}]{0,200}doc_id["\s:]+(\d{14,})',
        ]:
            m = _re.search(pattern, page_src)
            if m:
                doc_id = m.group(1)
                break
    except Exception:
        pass
    if not doc_id:
        doc_id = REACT_DOC_ID_FALLBACK

    try:
        ua = driver.execute_script("return navigator.userAgent;") or ""
    except Exception:
        ua = ""

    logger.info("[react_comment_http] post=%s comment=%s reaction=%s c_user=%s",
                post_numeric_id, comment_numeric_id, reaction_type, c_user)

    return _http_react_comment(
        fb_dtsg=tokens["fb_dtsg"],
        lsd=tokens.get("lsd", ""),
        jazoest=tokens.get("jazoest", ""),
        comment_feedback_id=comment_feedback_id,
        reaction_type=reaction_type,
        cookies=cook,
        user_agent=ua,
        c_user=c_user,
        post_url=post_url,
        doc_id=doc_id,
    )


# ══════════════════════════════════════════════════════════════════
#  react_comment  — Selenium UI
# ══════════════════════════════════════════════════════════════════

def react_to_comment_result(
    driver: webdriver.Chrome,
    cookies_json: str,
    user_agent: Optional[str],
    target_info: Dict[str, Any],
    reaction_type: str,
) -> Dict[str, Any]:
    """React to a comment found via Selenium DOM search."""
    try:
        _scroll_to_reactions(driver)
        _sleep(0.5)
        for _ in range(3):
            _scroll_down(driver, 500)
        _load_more_comments(driver)
        _sleep(0.5)

        cel = _resolve_comment_el(driver, target_info)
        if not cel:
            return {"success": False,
                    "reason": f"target comment not found ({target_info.get('type', '?')})"}

        _scroll_into_view(driver, cel)
        _sleep(0.5)

        lbtn = _find_on_comment(cel, _comment_like_locs())
        if not lbtn:
            return {"success": False, "reason": "Like on comment not found"}

        if reaction_type.upper() == "LIKE":
            _safe_click(driver, lbtn)
            _sleep(1)
            return {"success": True, "reason": None}

        # Hover for reaction popup
        _scroll_into_view(driver, lbtn)
        _sleep(0.3)
        ActionChains(driver).move_to_element(lbtn).pause(1.5).perform()
        _sleep(0.8)

        rbtn = _find_any(driver, _reaction_popup_locators(reaction_type), timeout=WAIT_SHORT)
        if not rbtn:
            ActionChains(driver).click_and_hold(lbtn).pause(2).perform()
            _sleep(0.5)
            rbtn = _find_any(driver, _reaction_popup_locators(reaction_type), timeout=WAIT_SHORT)
            ActionChains(driver).release().perform()
        if not rbtn:
            return {"success": False,
                    "reason": f"reaction popup not found on comment: {reaction_type}"}

        _safe_click(driver, rbtn)
        _sleep(1)
        return {"success": True, "reason": None}
    except Exception as exc:
        return {"success": False, "reason": str(exc)}


def react_to_comment(driver, cookies_json, user_agent, target_info, reaction_type):
    return react_to_comment_result(
        driver, cookies_json, user_agent, target_info, reaction_type
    )["success"]


# ══════════════════════════════════════════════════════════════════
#  Helpers kept for backward compatibility
# ══════════════════════════════════════════════════════════════════

def get_comments_for_post(
    driver: webdriver.Chrome, post_url: str, max_comments: int = 20
) -> List[Dict[str, str]]:
    """Return comment dicts from DOM for compatibility."""
    for _ in range(5):
        _scroll_down(driver, 400)
    _load_more_comments(driver)
    _sleep(1)
    result: List[Dict[str, str]] = []
    for i, el in enumerate(_get_comment_elements(driver)[:max_comments]):
        try:
            result.append({
                "comment_id": str(i), "feedback_id": "",
                "text": el.text[:100], "index": i,
            })
        except StaleElementReferenceException:
            pass
    return result


def random_delay(delay_min: float, delay_max: float) -> None:
    """Sleep random seconds between delay_min and delay_max."""
    time.sleep(random.uniform(delay_min, delay_max))
