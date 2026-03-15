"""Extract fb_dtsg, lsd, jazoest from Facebook DOM via Selenium."""
import re
from typing import Optional, Dict
from selenium import webdriver


def extract_tokens(driver: webdriver.Chrome) -> Optional[Dict[str, str]]:
    """
    Extract fb_dtsg, lsd, jazoest from page using JavaScript.
    Returns dict with keys: fb_dtsg, lsd, jazoest or None if not found.
    """
    try:
        # fb_dtsg - often in input[name="fb_dtsg"] or in DTSGInitialData
        fb_dtsg = driver.execute_script("""
            var el = document.querySelector('input[name="fb_dtsg"]');
            if (el) return el.value;
            if (typeof require !== 'undefined') {
                try {
                    var dtsg = require('DTSGInitialData').token;
                    if (dtsg) return dtsg;
                } catch(e) {}
            }
            var scripts = document.getElementsByTagName('script');
            for (var i = 0; i < scripts.length; i++) {
                var m = scripts[i].textContent.match(/"fb_dtsg":"([^"]+)"/);
                if (m) return m[1];
            }
            return null;
        """)

        # lsd - often in input[name="lsd"] or in page
        lsd = driver.execute_script("""
            var el = document.querySelector('input[name="lsd"]');
            if (el) return el.value;
            var scripts = document.getElementsByTagName('script');
            for (var i = 0; i < scripts.length; i++) {
                var m = scripts[i].textContent.match(/"lsd":"([^"]+)"/);
                if (m) return m[1];
            }
            return null;
        """)

        # jazoest
        jazoest = driver.execute_script("""
            var el = document.querySelector('input[name="jazoest"]');
            if (el) return el.value;
            var scripts = document.getElementsByTagName('script');
            for (var i = 0; i < scripts.length; i++) {
                var m = scripts[i].textContent.match(/"jazoest":"([^"]+)"/);
                if (m) return m[1];
            }
            return null;
        """)

        if not fb_dtsg:
            # Fallback: regex on page source
            html = driver.page_source
            m = re.search(r'"fb_dtsg":"([^"]+)"', html)
            if m:
                fb_dtsg = m.group(1)
            m = re.search(r'name="fb_dtsg"\s+value="([^"]+)"', html)
            if m:
                fb_dtsg = m.group(1)
        if not lsd:
            html = driver.page_source
            m = re.search(r'"lsd":"([^"]+)"', html)
            if m:
                lsd = m.group(1)
        if not jazoest:
            html = driver.page_source
            m = re.search(r'"jazoest":"([^"]+)"', html)
            if m:
                jazoest = m.group(1)

        if fb_dtsg and lsd and jazoest:
            return {"fb_dtsg": fb_dtsg, "lsd": lsd, "jazoest": jazoest}
        if fb_dtsg:
            return {"fb_dtsg": fb_dtsg, "lsd": lsd or "", "jazoest": jazoest or ""}
        return None
    except Exception:
        return None
