"""
Taiwan Customs Portal — Automated CSV Downloader
Data source: https://portal.sw.nat.gov.tw/APGA/GA30E

Uses Playwright (headless Chromium) to fill the query form and download the
monthly HS-8486 Import CSV.  CAPTCHA is solved with ddddocr (OCR).

Dependencies:
    playwright>=1.40.0
    ddddocr>=1.4.4

First-time setup:
    pip install playwright ddddocr
    playwright install chromium
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
PORTAL_URL = "https://portal.sw.nat.gov.tw/APGA/GA30E"

MAX_CAPTCHA_ATTEMPTS = 5


# ── CAPTCHA solver ────────────────────────────────────────────────────────────

def _solve_image_bytes(img_bytes: bytes) -> str:
    try:
        import ddddocr  # type: ignore
    except ImportError as exc:
        raise ImportError("ddddocr not installed. Run: pip install ddddocr") from exc
    ocr = ddddocr.DdddOcr(show_ad=False)
    return ocr.classification(img_bytes).strip()


# ── Core async downloader ─────────────────────────────────────────────────────

async def _download_async(
    start_year:  int = 2022,
    start_month: int = 1,
    end_year:    Optional[int] = None,
    end_month:   Optional[int] = None,
    headless:    bool = True,
) -> Path:
    from playwright.async_api import async_playwright, TimeoutError as PWTimeout  # type: ignore

    now = datetime.now()
    if end_year  is None: end_year  = now.year
    if end_month is None: end_month = now.month

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        ctx     = await browser.new_context(accept_downloads=True)
        page    = await ctx.new_page()

        saved_path: Optional[Path] = None

        for attempt in range(1, MAX_CAPTCHA_ATTEMPTS + 1):
            logger.info("CAPTCHA attempt %d / %d", attempt, MAX_CAPTCHA_ATTEMPTS)

            # ── Navigate fresh each attempt (page may have changed after submit) ──
            logger.info("Navigating to %s", PORTAL_URL)
            await page.goto(PORTAL_URL, wait_until="networkidle", timeout=40_000)

            # ── 1. Total Imports (checkbox, value=3) ──────────────────────────
            await page.check("#ImportTotal")

            # ── 2. Monthly periodicity ────────────────────────────────────────
            await page.check("#REPORT_TYPE_1")

            # ── 3. Period via JS (month selects are hidden until Monthly chosen) ─
            await page.evaluate(f"""() => {{
                function setSelect(id, val) {{
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.value = String(val);
                    el.dispatchEvent(new Event('change', {{bubbles: true}}));
                }}
                setSelect('START_YEAR',  {start_year});
                setSelect('START_MONTH', {start_month});
                setSelect('END_YEAR',    {end_year});
                setSelect('END_MONTH',   {end_month});
            }}""")

            # ── 4. HS code type → detailed, fill 8486 ────────────────────────
            await page.check("#HS_TYPE_2")
            await page.fill("#goodsCodeValue", "8486")

            # ── 5. Country → World ────────────────────────────────────────────
            await page.check("#COUNTRY_TYPE_0")

            # ── 6. Measure → USD only ─────────────────────────────────────────
            for chk_id in ["Statistics2", "Statistics3", "Statistics4", "Statistics5"]:
                if await page.is_checked(f"#{chk_id}"):
                    await page.uncheck(f"#{chk_id}")
            await page.check("#Statistics1")

            # ── 7. Export mode → CSV ──────────────────────────────────────────
            await page.check("#EXPORT_TYPE_4")

            # ── 8. Find CAPTCHA image (nearest img to #checkNo) ───────────────
            captcha_img_src = await page.evaluate("""() => {
                const input = document.querySelector('#checkNo');
                if (!input) return null;
                let el = input.parentElement;
                for (let i = 0; i < 6; i++) {
                    if (!el) break;
                    const img = el.querySelector('img');
                    if (img) { img.id = '__captcha_img__'; return img.src; }
                    el = el.parentElement;
                }
                return null;
            }""")

            if captcha_img_src is None:
                raise RuntimeError("Cannot locate CAPTCHA image on the page.")
            logger.info("CAPTCHA image src: %s", captcha_img_src)

            captcha_el = await page.wait_for_selector("#__captcha_img__", timeout=8_000)
            img_bytes  = await captcha_el.screenshot()

            # Save CAPTCHA image for debugging
            (DATA_DIR / f"debug_captcha_{attempt}.png").write_bytes(img_bytes)

            text = _solve_image_bytes(img_bytes)
            logger.info("OCR result: %r", text)

            # Fill CAPTCHA input via JS (may also be hidden/restricted)
            await page.evaluate(f"""() => {{
                const el = document.querySelector('#checkNo');
                if (el) el.value = {text!r};
            }}""")

            # ── 9. Click the LAST Submit button (first one is for goods search) ─
            try:
                async with page.expect_download(timeout=25_000) as dl_info:
                    submit_buttons = page.locator("button:has-text('Submit')")
                    count = await submit_buttons.count()
                    logger.info("Found %d Submit button(s), clicking last", count)
                    await submit_buttons.last.click(timeout=5_000)

                dl        = await dl_info.value
                filename  = dl.suggested_filename or f"taiwan_customs_{datetime.now():%Y%m%d_%H%M%S}.csv"
                save_path = DATA_DIR / filename
                await dl.save_as(str(save_path))
                saved_path = save_path
                logger.info("Saved: %s", save_path)
                break

            except PWTimeout:
                # Save screenshot to see what the page shows after submit
                shot = DATA_DIR / f"debug_post_submit_{attempt}.png"
                await page.screenshot(path=str(shot), full_page=True)
                logger.warning(
                    "No download triggered (attempt %d). Screenshot: %s", attempt, shot
                )
                # Loop continues — fresh page.goto() at top of loop

        await browser.close()

    if saved_path is None:
        raise RuntimeError(
            f"Failed to download CSV after {MAX_CAPTCHA_ATTEMPTS} CAPTCHA attempts. "
            "Run with headless=False to debug: "
            "python fetchers/auto_download.py --no-headless"
        )
    return saved_path


# ── Public sync wrapper ───────────────────────────────────────────────────────

def download_csv(
    start_year:  int = 2022,
    start_month: int = 1,
    end_year:    Optional[int] = None,
    end_month:   Optional[int] = None,
    headless:    bool = True,
) -> Path:
    return asyncio.run(
        _download_async(
            start_year=start_year,
            start_month=start_month,
            end_year=end_year,
            end_month=end_month,
            headless=headless,
        )
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse, sys
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
    )
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year",  type=int, default=2022)
    parser.add_argument("--start-month", type=int, default=1)
    parser.add_argument("--end-year",    type=int, default=None)
    parser.add_argument("--end-month",   type=int, default=None)
    parser.add_argument("--no-headless", action="store_true")
    args = parser.parse_args()

    try:
        path = download_csv(
            start_year=args.start_year,
            start_month=args.start_month,
            end_year=args.end_year,
            end_month=args.end_month,
            headless=not args.no_headless,
        )
        print(f"Downloaded: {path}")
        sys.exit(0)
    except Exception as exc:
        logger.error("Download failed: %s", exc)
        sys.exit(1)
