"""Browser management with Selenium: start, cookies, user-agent."""
import json
import os
import random
import time
import tempfile
import zipfile
from typing import Optional, Dict, Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
try:
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    ChromeDriverManager = None
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

FACEBOOK_URL = "https://www.facebook.com"


def _build_proxy_string(proxy: Optional[Dict[str, Any]]) -> Optional[str]:
    if not proxy:
        return None
    ip, port = proxy.get("ip"), proxy.get("port")
    return f"{ip}:{port}"


def _has_proxy_auth(proxy: Optional[Dict[str, Any]]) -> bool:
    if not proxy:
        return False
    return bool(proxy.get("login") and proxy.get("password"))


def _create_proxy_auth_extension(proxy: Dict[str, Any]) -> str:
    """Create a temporary Chrome extension that configures an authenticated HTTP proxy."""
    ip = proxy.get("ip")
    port = int(proxy.get("port"))
    login = proxy.get("login")
    password = proxy.get("password")
    login_js = str(login).replace("\\", "\\\\").replace("'", "\\'")
    password_js = str(password).replace("\\", "\\\\").replace("'", "\\'")

    manifest = {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "SMM Panel Proxy Auth",
        "permissions": [
            "proxy",
            "tabs",
            "unlimitedStorage",
            "storage",
            "<all_urls>",
            "webRequest",
            "webRequestBlocking",
        ],
        "background": {
            "scripts": ["background.js"],
        },
        "minimum_chrome_version": "88.0.0",
    }

    background_js = f"""
var config = {{
    mode: 'fixed_servers',
    rules: {{
        singleProxy: {{
            scheme: 'http',
            host: '{ip}',
            port: {port}
        }},
        bypassList: ['localhost', '127.0.0.1']
    }}
}};

chrome.proxy.settings.set({{value: config, scope: 'regular'}}, function() {{}});

chrome.webRequest.onAuthRequired.addListener(
    function() {{
        return {{
            authCredentials: {{
                username: '{login_js}',
                password: '{password_js}'
            }}
        }};
    }},
    {{urls: ['<all_urls>']}},
    ['blocking']
);
"""

    temp_dir = tempfile.mkdtemp(prefix="smm_proxy_")
    extension_path = os.path.join(temp_dir, "proxy_auth.zip")
    with zipfile.ZipFile(extension_path, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("background.js", background_js)
    return extension_path


def start_browser(
    proxy: Optional[Dict[str, Any]] = None,
    user_agent: Optional[str] = None,
    headless: bool = True,
) -> webdriver.Chrome:
    """Start Chrome with optional proxy and user agent."""
    options = Options()
    proxy_extension = None
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    width = random.randint(1280, 1920)
    height = random.randint(768, 1080)
    options.add_argument(f"--window-size={width},{height}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    if user_agent:
        options.add_argument(f"--user-agent={user_agent}")

    if proxy:
        proxy_str = _build_proxy_string(proxy)
        if _has_proxy_auth(proxy):
            proxy_extension = _create_proxy_auth_extension(proxy)
            options.add_extension(proxy_extension)
        elif proxy_str:
            options.add_argument(f"--proxy-server=http://{proxy_str}")

    if ChromeDriverManager is not None:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
    else:
        driver = webdriver.Chrome(options=options)

    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })

    return driver


def set_user_agent(driver: webdriver.Chrome, user_agent: str) -> None:
    """Set user agent via CDP (Chrome DevTools Protocol)."""
    try:
        driver.execute_cdp_cmd("Network.setUserAgentOverride", {"userAgent": user_agent})
    except Exception:
        pass


def load_cookies(driver: webdriver.Chrome, cookies_json: str) -> None:
    """Load cookies from JSON string (list of cookie dicts)."""
    driver.get("https://www.facebook.com")
    time.sleep(1)
    try:
        cookies = json.loads(cookies_json) if isinstance(cookies_json, str) else cookies_json
        for c in cookies:
            if isinstance(c, dict):
                name = c.get("name")
                value = c.get("value")
                domain = c.get("domain", ".facebook.com")
                if name and value:
                    try:
                        driver.add_cookie({
                            "name": name,
                            "value": value,
                            "domain": domain,
                        })
                    except Exception:
                        pass
    except (json.JSONDecodeError, TypeError):
        pass


def open_facebook(driver: webdriver.Chrome) -> None:
    """Open Facebook main page."""
    driver.get(FACEBOOK_URL)
    time.sleep(2)


def is_logged_in(driver: webdriver.Chrome, timeout: int = 10) -> bool:
    """Check if user is logged in (look for feed or profile indicators)."""
    try:
        driver.get("https://www.facebook.com")
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(2)
        # Logged-in page often has "feed" or specific elements
        page_source = driver.page_source.lower()
        if "login" in driver.current_url and "facebook.com/login" in driver.current_url:
            return False
        if "c_user" in driver.get_cookies() or any("c_user" in str(c) for c in driver.get_cookies()):
            return True
        # Alternative: check for news feed placeholder
        if "stories" in page_source or "feed" in page_source or "home" in page_source:
            return True
        return False
    except Exception:
        return False


def close_browser(driver: webdriver.Chrome) -> None:
    """Close browser."""
    try:
        driver.quit()
    except Exception:
        pass
