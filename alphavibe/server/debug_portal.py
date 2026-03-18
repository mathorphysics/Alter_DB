"""
Debug script — inspect the Taiwan Customs portal GA30E form structure.
Dumps all form fields, buttons, and takes a screenshot.

Run:
    python alphavibe/server/debug_portal.py
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

DATA_DIR   = Path(__file__).parent / "data"
PORTAL_URL = "https://portal.sw.nat.gov.tw/APGA/GA30E"


async def main():
    from playwright.async_api import async_playwright

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)   # visible window
        ctx     = await browser.new_context()
        page    = await ctx.new_page()

        print(f"Loading {PORTAL_URL} ...")
        await page.goto(PORTAL_URL, wait_until="networkidle", timeout=40_000)

        # Full-page screenshot
        shot_path = DATA_DIR / "debug_screenshot.png"
        await page.screenshot(path=str(shot_path), full_page=True)
        print(f"Screenshot saved: {shot_path}")

        # Dump all input / select / button / textarea elements
        elements = await page.evaluate("""() => {
            const tags = ['input', 'select', 'button', 'textarea', 'a'];
            const result = [];
            for (const tag of tags) {
                for (const el of document.querySelectorAll(tag)) {
                    result.push({
                        tag:         el.tagName.toLowerCase(),
                        type:        el.type || '',
                        name:        el.name || '',
                        id:          el.id || '',
                        value:       el.value || '',
                        placeholder: el.placeholder || '',
                        text:        (el.innerText || '').trim().slice(0, 60),
                        className:   el.className || '',
                        onclick:     (el.getAttribute('onclick') || '').slice(0, 80),
                        src:         el.src || '',
                    });
                }
            }
            return result;
        }""")

        dump_path = DATA_DIR / "debug_elements.json"
        dump_path.write_text(json.dumps(elements, ensure_ascii=False, indent=2))
        print(f"Elements dump saved: {dump_path}")
        print(f"\nTotal elements found: {len(elements)}")

        # Print a summary
        for el in elements:
            tag  = el["tag"]
            typ  = el["type"]
            name = el["name"]
            eid  = el["id"]
            val  = el["value"]
            txt  = el["text"]
            src  = el["src"]
            if tag == "input":
                print(f"  <input type={typ!r:10} name={name!r:25} id={eid!r:25} value={val!r}")
            elif tag == "select":
                print(f"  <select             name={name!r:25} id={eid!r}")
            elif tag == "button":
                print(f"  <button             text={txt!r}")
            elif tag == "img" and "captcha" in src.lower():
                print(f"  <img (CAPTCHA)      src={src!r}")

        print("\nBrowser will stay open for 30 seconds so you can inspect.")
        await page.wait_for_timeout(30_000)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
