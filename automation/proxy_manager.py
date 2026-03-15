"""Proxy management: rotate, check, assign."""
import time
import requests
from typing import Optional, Dict, Any


def rotate_proxy(proxy: Dict[str, Any]) -> bool:
    """
    Send GET request to rotate_url and wait rotate_delay seconds.
    Returns True if rotation request returned 200.
    """
    rotate_url = proxy.get("rotate_url")
    if not rotate_url or not rotate_url.strip():
        return True  # No rotation needed

    try:
        r = requests.get(rotate_url, timeout=30)
        if r.status_code != 200:
            return False
    except Exception:
        return False

    delay = proxy.get("rotate_delay") or 0
    if delay > 0:
        time.sleep(delay)
    return True


def check_proxy(proxy: Dict[str, Any], test_url: str = "https://httpbin.org/ip") -> bool:
    """Check if proxy is working by making a request through it."""
    ip, port = proxy.get("ip"), proxy.get("port")
    login, password = proxy.get("login"), proxy.get("password")

    proxies = {}
    if login and password:
        proxies["http"] = f"http://{login}:{password}@{ip}:{port}"
        proxies["https"] = f"http://{login}:{password}@{ip}:{port}"
    else:
        proxies["http"] = f"http://{ip}:{port}"
        proxies["https"] = f"http://{ip}:{port}"

    try:
        r = requests.get(test_url, proxies=proxies, timeout=15)
        return r.status_code == 200
    except Exception:
        return False


def assign_proxy(account: Dict[str, Any], proxies_by_id: Dict[int, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Get proxy dict for account. account should have proxy_id, proxies_by_id maps id -> proxy dict.
    """
    proxy_id = account.get("proxy_id")
    if not proxy_id:
        return None
    return proxies_by_id.get(proxy_id)


def get_proxy_dict(proxy_orm) -> Dict[str, Any]:
    """Convert ORM proxy to dict for automation modules."""
    return {
        "id": proxy_orm.id,
        "ip": proxy_orm.ip,
        "port": proxy_orm.port,
        "login": proxy_orm.login,
        "password": proxy_orm.password,
        "rotate_url": proxy_orm.rotate_url,
        "rotate_delay": proxy_orm.rotate_delay or 0,
    }
