"""Crawl comments under a post to get comment_id and feedback_id."""
import re
import time
from typing import List, Dict, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def get_comments_from_post(
    driver: webdriver.Chrome,
    post_url: str,
    max_comments: int = 20,
    scroll_pause: float = 1.0,
) -> List[Dict[str, str]]:
    """
    Open post URL, scroll to load comments, extract comment_id and feedback_id.
    Returns list of {"comment_id": "...", "feedback_id": "..."}.
    """
    driver.get(post_url)
    time.sleep(2)

    comments = []
    seen_ids = set()

    # Extract feedback_id (post id) from URL or page
    feedback_id = _get_feedback_id_from_page(driver, post_url)

    # Scroll to load more comments
    for _ in range(3):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(scroll_pause)

    # Try to find comment elements and extract data
    try:
        # Data attributes or links often contain comment IDs
        html = driver.page_source
        # Pattern: comment_id in data-* or href
        # e.g. comment_id=123456789 or feedback_comment_id
        for m in re.finditer(r'(?:comment_id|feedback_comment_id|reply_to_comment)[=:]["\']?(\d+)', html, re.I):
            cid = m.group(1)
            if cid not in seen_ids:
                seen_ids.add(cid)
                comments.append({"comment_id": cid, "feedback_id": feedback_id or ""})
            if len(comments) >= max_comments:
                break

        # Alternative: data-ft or data-store
        for m in re.finditer(r'"commentID":"(\d+)"', html):
            cid = m.group(1)
            if cid not in seen_ids:
                seen_ids.add(cid)
                comments.append({"comment_id": cid, "feedback_id": feedback_id or ""})
            if len(comments) >= max_comments:
                break
    except Exception:
        pass

    return comments[:max_comments]


def _get_feedback_id_from_page(driver: webdriver.Chrome, post_url: str) -> Optional[str]:
    """Get feedback (post) id from URL or page source."""
    # From URL: .../posts/123456_789012 or story_fbid=123456
    m = re.search(r"(\d+)_(\d+)", post_url)
    if m:
        return f"{m.group(1)}_{m.group(2)}"
    m = re.search(r"story_fbid=(\d+)", post_url)
    if m:
        return m.group(1)
    try:
        html = driver.page_source
        m = re.search(r'"feedbackID":"(\d+_\d+)"', html)
        if m:
            return m.group(1)
        m = re.search(r'"top_level_comment_id":"(\d+)"', html)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None
