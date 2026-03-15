"""Facebook HTTP requests using extracted tokens (faster than Selenium)."""
import re
import requests
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, parse_qs

FACEBOOK_ORIGIN = "https://www.facebook.com"
HEADERS_BASE = {
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": FACEBOOK_ORIGIN,
    "Referer": FACEBOOK_ORIGIN + "/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


def _parse_post_id_from_url(post_url: str) -> Optional[str]:
    """Extract post/permalink id from Facebook URL."""
    try:
        parsed = urlparse(post_url)
        query = parse_qs(parsed.query)
        if query.get("fbid"):
            return query["fbid"][0]
        if query.get("story_fbid"):
            return query["story_fbid"][0]
    except Exception:
        pass

    if "permalink" in post_url or "posts" in post_url:
        m = re.search(r"/posts/(\d+)", post_url) or re.search(r"story_fbid=(\d+)", post_url) or re.search(r"(\d+)_(\d+)", post_url)
        if m:
            g = m.groups()
            if len(g) == 2:
                return f"{g[0]}_{g[1]}"
            return g[0] if g else None
    m = re.search(r"(\d+)_(\d+)", post_url)
    if m:
        return f"{m.group(1)}_{m.group(2)}"
    return None


def _make_headers(
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    lsd: str = "",
    referer: str = "",
) -> Dict[str, str]:
    h = HEADERS_BASE.copy()
    if user_agent:
        h["User-Agent"] = user_agent
    if lsd:
        h["X-FB-LSD"] = lsd
    if referer:
        h["Referer"] = referer
    # Tell Facebook this is an AJAX request (returns JSON/minimal HTML instead of full page)
    h["X-Requested-With"] = "XMLHttpRequest"
    h["Sec-Fetch-Site"] = "same-origin"
    return h


def _extract_comment_id(response_text: str) -> Optional[str]:
    patterns = [
        r'"comment_id":"(\d+)"',
        r'"commentID":"(\d+)"',
        r'"feedback_comment_id"[:=]["\\]*?(\d+)',
        r'"id":"(\d+)"',
    ]
    for pattern in patterns:
        match = re.search(pattern, response_text)
        if match:
            return match.group(1)
    return None


def _summarize_response_text(text: str) -> str:
    compact = re.sub(r"\s+", " ", text or "").strip()
    return compact[:180]


def _strip_fb_prefix(text: str) -> str:
    """Strip the 'for (;;);' anti-hijacking prefix Facebook adds to AJAX responses.

    The prefix is 'for (;;);' (9 characters).  Finding text.index(';') would
    match the FIRST semicolon *inside* '(;;)' and leave junk before the JSON.
    Instead we jump straight to the first '{' or '[' to be robust.
    """
    if not text:
        return text
    brace = text.find("{")
    bracket = text.find("[")
    starts = [i for i in (brace, bracket) if i >= 0]
    if starts:
        first = min(starts)
        if first > 0:
            return text[first:]
    return text


def react_to_post(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    post_id: str,
    reaction_type: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
) -> bool:
    """Send reaction to post via GraphQL / feedback reaction."""
    return react_to_post_result(
        fb_dtsg,
        lsd,
        jazoest,
        post_id,
        reaction_type,
        cookies,
        user_agent,
    )["success"]


def react_to_post_result(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    post_id: str,
    reaction_type: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    c_user: str = "",
    post_url: str = "",
    doc_id: Optional[str] = None,
    numeric_id: str = "",
) -> Dict[str, Any]:
    """Send a Like/reaction via Facebook.

    Tries three strategies in order:
      1. GraphQL CometUFIFeedbackReactMutation (doc_id from page or known-good fallback)
      2. Legacy /ufi/reaction/?action=set (no doc_id needed)
      3. /reactions/react/ mobile-style endpoint
    """
    import base64 as _b64
    import json as _json

    referer = post_url or FACEBOOK_ORIGIN + "/"

    # Reaction IDs confirmed from Facebook's own API response
    _REACTION_IDS = {
        "LIKE":  "1635855486666999",
        "LOVE":  "1678524932434102",
        "HAHA":  "613557422527858",
        "WOW":   "115940658764963",
        "SAD":   "478547315650144",
        "ANGRY": "908563459236466",
        "CARE":  "444813342392137",
    }
    # Numeric reaction codes for legacy endpoints
    _REACTION_CODES = {
        "LIKE": "1", "LOVE": "2", "HAHA": "7",
        "WOW": "3", "SAD": "4", "ANGRY": "5",
    }
    reaction_id = _REACTION_IDS.get(reaction_type.upper(), _REACTION_IDS["LIKE"])
    reaction_code = _REACTION_CODES.get(reaction_type.upper(), "1")

    # Use dynamic doc_id from page, fall back to known-good doc_id
    effective_doc_id = doc_id or "33371893662453814"

    # ── Attempt 1: GraphQL CometUFIFeedbackReactMutation ───────────
    try:
        variables = _json.dumps({
            "input": {
                "feedback_id": post_id,
                "feedback_reaction_id": reaction_id,
                "actor_id": c_user,
                "client_mutation_id": "1",
            },
            "useDefaultActor": False,
            "__relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider": False,
        }, separators=(",", ":"))

        data = {
            "av": c_user,
            "__user": c_user,
            "fb_dtsg": fb_dtsg,
            "lsd": lsd,
            "jazoest": jazoest,
            "variables": variables,
            "doc_id": effective_doc_id,
            "fb_api_caller_class": "RelayModern",
            "fb_api_req_friendly_name": "CometUFIFeedbackReactMutation",
            "server_timestamps": "true",
        }
        headers = _make_headers(cookies, user_agent, lsd=lsd, referer=referer)
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        headers["X-FB-Friendly-Name"] = "CometUFIFeedbackReactMutation"

        r = requests.post(
            FACEBOOK_ORIGIN + "/api/graphql/",
            headers=headers, data=data, cookies=cookies, timeout=30,
        )
        if r.status_code == 200 and not r.text.strip().startswith("<!"):
            try:
                rj = _json.loads(_strip_fb_prefix(r.text))
                errors = rj.get("errors") or []
                if errors:
                    if any("not found" in (e.get("message") or "").lower() for e in errors):
                        graphql_reason = errors[0].get("message", "doc_id not found")
                        # fall through to legacy attempts
                    else:
                        return {"success": False, "status_code": 200,
                                "reason": f"GraphQL: {errors[0].get('message', str(errors))}"}
                else:
                    # Verify reaction actually applied — data.feedback_react must be present
                    feedback_react = (rj.get("data") or {}).get("feedback_react")
                    if feedback_react is not None:
                        return {"success": True, "status_code": 200,
                                "reason": f"graphql ok; feedback_react={_json.dumps(feedback_react)[:120]}"}
                    # data.feedback_react is null/missing — silent failure
                    # Log full data so we can debug what FB returned
                    graphql_reason = f"feedback_react=null data={_summarize_response_text(_json.dumps(rj.get('data', {})))}"
            except Exception as _ge:
                graphql_reason = f"json parse: {_ge}; body_start={r.text[:80]}"
        else:
            graphql_reason = _summarize_response_text(r.text)
    except Exception as exc:
        graphql_reason = str(exc)

    # ── Attempt 2: /ufi/reaction/?action=set (legacy, no doc_id) ───
    nid = numeric_id or (str(post_id).split("_")[-1] if "_" in str(post_id) else str(post_id))
    if not nid.isdigit():
        try:
            decoded = _b64.b64decode(post_id + "==").decode("utf-8", errors="ignore")
            if ":" in decoded:
                nid = decoded.split(":")[-1].strip()
        except Exception:
            pass

    try:
        data2 = {
            "av": c_user,
            "__user": c_user,
            "fb_dtsg": fb_dtsg,
            "lsd": lsd,
            "jazoest": jazoest,
            "ft_ent_identifier": nid,
            "feedback_id": post_id,
            "feedback_referrer": referer,
            "reaction_type": reaction_code,
            "client_request_id": "",
            "__a": "1",
            "__req": "1",
        }
        headers2 = _make_headers(cookies, user_agent, lsd=lsd, referer=referer)
        headers2["Content-Type"] = "application/x-www-form-urlencoded"

        r2 = requests.post(
            FACEBOOK_ORIGIN + "/ufi/reaction/?action=set&__a=1",
            headers=headers2, data=data2, cookies=cookies, timeout=30,
        )
        if r2.status_code == 200 and not r2.text.strip().startswith("<!D"):
            try:
                rj2 = _json.loads(_strip_fb_prefix(r2.text))
                if rj2.get("error") or rj2.get("errors"):
                    ufi_reason = _summarize_response_text(r2.text)
                elif rj2.get("payload") is None:
                    # payload:null means Facebook rejected the reaction silently
                    ufi_reason = f"payload=null resp={_summarize_response_text(r2.text)}"
                else:
                    return {"success": True, "status_code": 200,
                            "reason": f"ufi/reaction ok; resp={_summarize_response_text(r2.text)}"}
            except Exception:
                ufi_reason = _summarize_response_text(r2.text)
        else:
            ufi_reason = _summarize_response_text(r2.text)
    except Exception as exc:
        ufi_reason = str(exc)

    # ── Attempt 3: /reactions/react/ ───────────────────────────────
    try:
        data3 = {
            "av": c_user,
            "__user": c_user,
            "fb_dtsg": fb_dtsg,
            "lsd": lsd,
            "jazoest": jazoest,
            "target_fbid": nid,
            "reaction_type": reaction_type.upper(),
            "__a": "1",
        }
        headers3 = _make_headers(cookies, user_agent, lsd=lsd, referer=referer)
        headers3["Content-Type"] = "application/x-www-form-urlencoded"

        r3 = requests.post(
            FACEBOOK_ORIGIN + "/reactions/react/",
            headers=headers3, data=data3, cookies=cookies, timeout=30,
        )
        if r3.status_code == 200 and not r3.text.strip().startswith("<!D"):
            try:
                rj3 = _json.loads(_strip_fb_prefix(r3.text))
                if rj3.get("payload") is None:
                    pass  # payload:null = rejected
                elif not (rj3.get("error") or rj3.get("errors")):
                    return {"success": True, "status_code": 200,
                            "reason": f"reactions/react ok; resp={_summarize_response_text(r3.text)}"}
            except Exception:
                pass
    except Exception:
        pass

    return {"success": False, "status_code": None,
            "reason": f"all HTTP attempts failed. graphql={graphql_reason} ufi={ufi_reason}"}


def upload_comment_photo_result(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    image_path: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    c_user: str = "",
) -> Dict[str, Any]:
    """Upload a local image to Facebook for use as a comment attachment.

    Returns {'success': bool, 'photo_id': str|None, 'reason': str|None}.
    The returned photo_id can be passed to comment_post_result().
    """
    import os
    import mimetypes
    import json as _json

    if not os.path.isfile(image_path):
        return {"success": False, "photo_id": None, "reason": f"file not found: {image_path}"}

    mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
    filename = os.path.basename(image_path)

    headers = _make_headers(cookies, user_agent, lsd=lsd, referer=FACEBOOK_ORIGIN + "/")
    # Let requests set Content-Type (multipart/form-data with boundary)
    headers.pop("Content-Type", None)

    # Query-string params (as seen in real browser capture)
    params = {
        "av": c_user,
        "profile_id": c_user,
        "source": "19",
        "target_id": c_user,
        "__user": c_user,
        "__a": "1",
        "fb_dtsg": fb_dtsg,
        "jazoest": jazoest,
        "lsd": lsd,
    }

    # POST body: only the file (field name is "file", not "file1")
    data = {
        "fb_dtsg": fb_dtsg,
        "lsd": lsd,
        "jazoest": jazoest,
    }

    try:
        with open(image_path, "rb") as fh:
            files = {"file": (filename, fh, mime_type)}
            r = requests.post(
                FACEBOOK_ORIGIN + "/ajax/ufi/upload/",
                headers=headers,
                params=params,
                data=data,
                files=files,
                cookies=cookies,
                timeout=120,
            )
        if r.status_code != 200 or r.text.strip().startswith("<!"):
            return {"success": False, "photo_id": None,
                    "reason": f"HTTP {r.status_code}: {r.text[:200]}"}
        # Strip Facebook's 'for (;;);' anti-hijacking prefix before parsing
        text = _strip_fb_prefix(r.text)
        try:
            rj = _json.loads(text)
        except Exception as e:
            return {"success": False, "photo_id": None,
                    "reason": f"JSON parse error: {e}; body={r.text[:200]}"}
        # Try possible response shapes
        photo_id = (
            (rj.get("payload") or {}).get("fbid")
            or (rj.get("payload") or {}).get("photo_id")
            or (rj.get("data") or {}).get("id")
            or rj.get("fbid")
            or rj.get("photo_id")
            or rj.get("media_id")
        )
        if photo_id:
            return {"success": True, "photo_id": str(photo_id), "reason": None}
        return {"success": False, "photo_id": None,
                "reason": f"no photo_id in response: {text[:300]}"}
    except Exception as exc:
        return {"success": False, "photo_id": None, "reason": str(exc)}


def comment_post(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    post_id: str,
    comment_text: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    image_url: Optional[str] = None,
) -> bool:
    """Add comment to post."""
    return comment_post_result(
        fb_dtsg,
        lsd,
        jazoest,
        post_id,
        comment_text,
        cookies,
        user_agent,
        image_url,
    )["success"]


def comment_post_result(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    post_id: str,
    comment_text: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    c_user: str = "",
    post_url: str = "",
    doc_id: Optional[str] = None,
    photo_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Post a comment via useCometUFICreateCommentMutation.

    Pass photo_id (from upload_comment_photo_result) to attach an image.
    """
    import json as _json
    import uuid as _uuid

    referer = post_url or FACEBOOK_ORIGIN + "/"
    effective_doc_id = doc_id or "26136887842641090"

    variables = _json.dumps({
        "feedLocation": "POST_PERMALINK_DIALOG",
        "feedbackSource": 2,
        "groupID": None,
        "input": {
            "actor_id": c_user,
            "client_mutation_id": "1",
            "attachments": [{"media": {"id": photo_id}}] if photo_id else None,
            "feedback_id": post_id,
            "formatting_style": None,
            "message": {"ranges": [], "text": comment_text},
            "attribution_id_v2": None,
            "vod_video_timestamp": None,
            "is_tracking_encrypted": False,
            "tracking": [],
            "feedback_source": "OBJECT",
            "idempotence_token": f"client:{_uuid.uuid4()}",
            "session_id": str(_uuid.uuid4()),
        },
        "inviteShortLinkKey": None,
        "renderLocation": None,
        "scale": 1,
        "useDefaultActor": False,
        "focusCommentID": None,
        "__relay_internal__pv__groups_comet_use_glvrelayprovider": True,
        "__relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider": False,
        "__relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider": False,
        "__relay_internal__pv__IsWorkUserrelayprovider": False,
        "__relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider": "ORIGINAL",
    }, separators=(",", ":"))

    data = {
        "av": c_user,
        "__user": c_user,
        "fb_dtsg": fb_dtsg,
        "lsd": lsd,
        "jazoest": jazoest,
        "variables": variables,
        "doc_id": effective_doc_id,
        "fb_api_caller_class": "RelayModern",
        "fb_api_req_friendly_name": "useCometUFICreateCommentMutation",
        "server_timestamps": "true",
    }
    headers = _make_headers(cookies, user_agent, lsd=lsd, referer=referer)
    headers["Content-Type"] = "application/x-www-form-urlencoded"
    headers["X-FB-Friendly-Name"] = "useCometUFICreateCommentMutation"

    try:
        r = requests.post(
            FACEBOOK_ORIGIN + "/api/graphql/",
            headers=headers, data=data, cookies=cookies, timeout=30,
        )
        if r.status_code == 200 and not r.text.strip().startswith("<!"):
            try:
                rj = r.json()
                errors = rj.get("errors") or []
                if errors:
                    return {"success": False, "status_code": 200,
                            "reason": errors[0].get("message", str(errors)),
                            "comment_id": None, "feedback_id": post_id}
                comment_create = (rj.get("data") or {}).get("comment_create")
                if comment_create is not None:
                    try:
                        comment_id = (
                            comment_create
                            .get("feedback_comment_edge", {})
                            .get("node", {})
                            .get("legacy_fbid")
                        )
                    except Exception:
                        comment_id = None
                    # Extract post_id from feedback_id = base64("feedback:POST_ID_COMMENT_ID")
                    extracted_post_id = None
                    try:
                        import base64 as _b64
                        decoded = _b64.b64decode(post_id + "==").decode("utf-8", errors="ignore")
                        # decoded = "feedback:122118332247177690_..." — take part after "feedback:" and before "_"
                        if decoded.startswith("feedback:") and "_" in decoded:
                            extracted_post_id = decoded.split("feedback:")[1].split("_")[0]
                    except Exception:
                        pass
                    return {"success": True, "status_code": 200,
                            "reason": None, "comment_id": comment_id,
                            "feedback_id": post_id, "post_id": extracted_post_id}
                return {"success": False, "status_code": 200,
                        "reason": f"comment_create=null resp={_summarize_response_text(r.text)}",
                        "comment_id": None, "feedback_id": post_id}
            except Exception:
                return {"success": True, "status_code": 200,
                        "reason": None, "comment_id": None, "feedback_id": post_id}
        return {"success": False, "status_code": r.status_code,
                "reason": _summarize_response_text(r.text),
                "comment_id": None, "feedback_id": post_id}
    except Exception as exc:
        return {"success": False, "status_code": None, "reason": str(exc),
                "comment_id": None, "feedback_id": post_id}


def react_to_comment_result(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    comment_feedback_id: str,
    reaction_type: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    c_user: str = "",
    post_url: str = "",
    doc_id: Optional[str] = None,
) -> Dict[str, Any]:
    """React to a comment via CometUFIFeedbackReactMutation.

    comment_feedback_id must be base64("feedback:{post_id}_{comment_id}").
    Uses the same mutation as react_to_post_result.
    """
    return react_to_post_result(
        fb_dtsg=fb_dtsg,
        lsd=lsd,
        jazoest=jazoest,
        post_id=comment_feedback_id,
        numeric_id="",
        reaction_type=reaction_type,
        cookies=cookies,
        user_agent=user_agent,
        c_user=c_user,
        post_url=post_url,
        doc_id=doc_id,
    )


def react_to_comment(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    comment_id: str,
    feedback_id: str,
    reaction_type: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
) -> bool:
    """Like/react to a comment (legacy, kept for compat)."""
    url = FACEBOOK_ORIGIN + "/reaction/profile/browser/"
    headers = _make_headers(cookies, user_agent)
    headers["Content-Type"] = "application/x-www-form-urlencoded"

    data = {
        "fb_dtsg": fb_dtsg,
        "lsd": lsd,
        "jazoest": jazoest,
        "feedback_id": feedback_id,
        "comment_id": comment_id,
        "reaction_type": reaction_type,
    }
    try:
        r = requests.post(url, headers=headers, data=data, cookies=cookies, timeout=30)
        success = r.status_code == 200 and "error" not in r.text.lower()
        return success
    except Exception:
        return False


def reply_to_comment(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    comment_id: str,
    feedback_id: str,
    reply_text: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
) -> bool:
    """Reply to a comment (legacy compat wrapper)."""
    return reply_to_comment_result(
        fb_dtsg,
        lsd,
        jazoest,
        comment_id,
        feedback_id,
        reply_text,
        cookies,
        user_agent,
    )["success"]


def reply_to_comment_result(
    fb_dtsg: str,
    lsd: str,
    jazoest: str,
    comment_id: str,
    feedback_id: str,
    reply_text: str,
    cookies: Dict[str, str],
    user_agent: Optional[str] = None,
    c_user: str = "",
    post_url: str = "",
    doc_id: Optional[str] = None,
    post_id: str = "",
    photo_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Reply to a comment via useCometUFICreateCommentMutation.

    comment_id   — numeric comment legacy_fbid (e.g. '1359127875933415')
    post_id      — numeric post id (e.g. '122118332247177690')
    feedback_id  — pre-built base64 comment feedback id; if empty, built from
                   post_id + comment_id automatically.

    The mutation is identical to comment_post_result but with two extra fields:
      feedback_id              → base64("feedback:{post_id}_{comment_id}")
      reply_comment_parent_fbid → base64("comment:{post_id}_{comment_id}")
      reply_target_clicked      → true
    """
    import json as _json
    import uuid as _uuid
    import base64 as _b64

    # Build feedback_id and reply_comment_parent_fbid from numeric IDs when
    # they are not pre-built by the caller.
    if post_id and comment_id and not feedback_id:
        feedback_id = _b64.b64encode(
            f"feedback:{post_id}_{comment_id}".encode()
        ).decode()

    if post_id and comment_id:
        reply_parent_fbid = _b64.b64encode(
            f"comment:{post_id}_{comment_id}".encode()
        ).decode()
    else:
        # Fallback: try to derive from the already-encoded feedback_id
        # by replacing "feedback:" prefix with "comment:" in the decoded form.
        try:
            decoded = _b64.b64decode(feedback_id).decode()
            reply_parent_fbid = _b64.b64encode(
                decoded.replace("feedback:", "comment:", 1).encode()
            ).decode()
        except Exception:
            reply_parent_fbid = ""

    referer = post_url or FACEBOOK_ORIGIN + "/"
    effective_doc_id = doc_id or "26136887842641090"

    variables = _json.dumps({
        "feedLocation": "POST_PERMALINK_DIALOG",
        "feedbackSource": 2,
        "groupID": None,
        "input": {
            "actor_id": c_user,
            "client_mutation_id": "1",
            "attachments": [{"media": {"id": photo_id}}] if photo_id else None,
            "feedback_id": feedback_id,
            "formatting_style": None,
            "message": {"ranges": [], "text": reply_text},
            "reply_comment_parent_fbid": reply_parent_fbid,
            "reply_target_clicked": True,
            "attribution_id_v2": None,
            "vod_video_timestamp": None,
            "is_tracking_encrypted": False,
            "tracking": [],
            "feedback_source": "OBJECT",
            "idempotence_token": f"client:{_uuid.uuid4()}",
            "session_id": str(_uuid.uuid4()),
        },
        "inviteShortLinkKey": None,
        "renderLocation": None,
        "scale": 1,
        "useDefaultActor": False,
        "focusCommentID": None,
        "__relay_internal__pv__groups_comet_use_glvrelayprovider": True,
        "__relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider": False,
        "__relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider": False,
        "__relay_internal__pv__IsWorkUserrelayprovider": False,
        "__relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider": "ORIGINAL",
    }, separators=(",", ":"))

    data = {
        "av": c_user,
        "__user": c_user,
        "fb_dtsg": fb_dtsg,
        "lsd": lsd,
        "jazoest": jazoest,
        "variables": variables,
        "doc_id": effective_doc_id,
        "fb_api_caller_class": "RelayModern",
        "fb_api_req_friendly_name": "useCometUFICreateCommentMutation",
        "server_timestamps": "true",
    }
    headers = _make_headers(cookies, user_agent, lsd=lsd, referer=referer)
    headers["Content-Type"] = "application/x-www-form-urlencoded"
    headers["X-FB-Friendly-Name"] = "useCometUFICreateCommentMutation"

    try:
        r = requests.post(
            FACEBOOK_ORIGIN + "/api/graphql/",
            headers=headers, data=data, cookies=cookies, timeout=30,
        )
        if r.status_code == 200 and not r.text.strip().startswith("<!"):
            try:
                rj = r.json()
                errors = rj.get("errors") or []
                if errors:
                    return {"success": False, "status_code": 200,
                            "reason": errors[0].get("message", str(errors)),
                            "comment_id": None, "feedback_id": feedback_id}
                comment_create = (rj.get("data") or {}).get("comment_create")
                if comment_create is not None:
                    try:
                        new_comment_id = (
                            comment_create
                            .get("feedback_comment_edge", {})
                            .get("node", {})
                            .get("legacy_fbid")
                        )
                    except Exception:
                        new_comment_id = None
                    # Extract post_id from feedback_id = base64("feedback:POST_ID_COMMENT_ID")
                    extracted_post_id = None
                    try:
                        import base64 as _b64
                        decoded = _b64.b64decode(feedback_id + "==").decode("utf-8", errors="ignore")
                        if decoded.startswith("feedback:") and "_" in decoded:
                            extracted_post_id = decoded.split("feedback:")[1].split("_")[0]
                    except Exception:
                        pass
                    return {"success": True, "status_code": 200,
                            "reason": None, "comment_id": new_comment_id,
                            "feedback_id": feedback_id, "post_id": extracted_post_id}
                return {"success": False, "status_code": 200,
                        "reason": f"comment_create=null resp={_summarize_response_text(r.text)}",
                        "comment_id": None, "feedback_id": feedback_id}
            except Exception:
                return {"success": True, "status_code": 200,
                        "reason": None, "comment_id": None, "feedback_id": feedback_id}
        return {"success": False, "status_code": r.status_code,
                "reason": _summarize_response_text(r.text),
                "comment_id": None, "feedback_id": feedback_id}
    except Exception as exc:
        return {"success": False, "status_code": None, "reason": str(exc),
                "comment_id": None, "feedback_id": feedback_id}


def get_post_id_from_url(post_url: str) -> Optional[str]:
    """Public helper to get post id from URL."""
    return _parse_post_id_from_url(post_url)
