"""
TSMC Monthly Revenue Scraper
Source: https://investor.tsmc.com/english/monthly-revenue/{year}

Uses Playwright to bypass 403 (site blocks plain HTTP requests).
Data is cached to server/data/tsmc_monthly_revenue.json.

Columns scraped (NT$ Millions):
  date   : "YYYY-MM"
  label  : "Jan 2025"
  revenue: float  (NT$ Millions)
  mom    : float or None  (MoM % change)
  yoy    : float or None  (YoY % change)
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "tsmc_monthly_revenue.json"

BASE_URL = "https://investor.tsmc.com/english/monthly-revenue/{year}"

MONTHS = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
    'may': 5, 'jun': 6, 'jul': 7, 'aug': 8,
    'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_num(s: str) -> Optional[float]:
    """Parse a number string like '176,450' or '-3.5%' → float or None."""
    cleaned = re.sub(r'[,%]', '', s.strip())
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_month_label(s: str) -> Optional[int]:
    """'Jan' / 'January' / '01' → 1-12."""
    s = s.strip().lower()
    # Try abbreviated month name
    for abbr, num in MONTHS.items():
        if s.startswith(abbr):
            return num
    # Try numeric
    try:
        m = int(s)
        if 1 <= m <= 12:
            return m
    except ValueError:
        pass
    return None


# ── Playwright scraper ────────────────────────────────────────────────────────

async def _scrape_year(page, year: int) -> List[Dict]:
    url = BASE_URL.format(year=year)
    logger.info("Scraping %s", url)
    await page.goto(url, wait_until="networkidle", timeout=30_000)

    # Wait for table content to load
    await page.wait_for_timeout(1_500)

    # Extract all table rows via JS
    rows_data = await page.evaluate("""() => {
        const results = [];
        const tables = document.querySelectorAll('table');
        if (!tables.length) return results;

        // Use the first (or largest) table
        let target = tables[0];
        for (const t of tables) {
            if (t.querySelectorAll('tr').length > target.querySelectorAll('tr').length)
                target = t;
        }

        const rows = target.querySelectorAll('tr');
        for (const row of rows) {
            const cells = [...row.querySelectorAll('td, th')].map(c => c.innerText.trim());
            if (cells.length >= 2) results.push(cells);
        }
        return results;
    }""")

    if not rows_data:
        # Fallback: try to find any table-like structure
        rows_data = await page.evaluate("""() => {
            const results = [];
            // Look for divs/spans that might contain the data
            const rows = document.querySelectorAll('[class*="row"], [class*="Row"], tr');
            for (const row of rows) {
                const cells = [...row.querySelectorAll('td, th, [class*="cell"], [class*="Cell"]')]
                    .map(c => c.innerText.trim());
                if (cells.length >= 2) results.push(cells);
            }
            return results;
        }""")

    parsed = []
    for cells in rows_data:
        # Skip header rows
        if not cells or not cells[0]:
            continue
        month_num = _parse_month_label(cells[0])
        if month_num is None:
            continue

        # Try to get revenue (usually column 1 or 2)
        revenue = None
        for col in cells[1:]:
            v = _parse_num(col)
            if v and v > 1000:   # revenue in NT$M should be large
                revenue = v
                break
        if revenue is None:
            continue

        date = f"{year}-{month_num:02d}"
        parsed.append({
            "date":    date,
            "label":   datetime(year, month_num, 1).strftime("%b %Y"),
            "revenue": revenue,
            "mom":     _parse_num(cells[2]) if len(cells) > 2 else None,
            "yoy":     _parse_num(cells[3]) if len(cells) > 3 else None,
        })

    logger.info("Year %d: scraped %d months", year, len(parsed))
    return parsed


async def _scrape_async(years: List[int]) -> List[Dict]:
    from playwright.async_api import async_playwright  # type: ignore

    all_data: List[Dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx  = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = await ctx.new_page()

        for year in years:
            try:
                rows = await _scrape_year(page, year)
                all_data.extend(rows)
            except Exception as exc:
                logger.warning("Failed to scrape year %d: %s", year, exc)

        await browser.close()

    # Sort by date, deduplicate
    seen = set()
    unique = []
    for row in sorted(all_data, key=lambda r: r["date"]):
        if row["date"] not in seen:
            seen.add(row["date"])
            unique.append(row)

    return unique


# ── Public API ────────────────────────────────────────────────────────────────

def scrape_revenue(years: Optional[List[int]] = None) -> List[Dict]:
    """
    Scrape TSMC monthly revenue for the given years.
    Defaults to the last 3 calendar years up to the current year.
    Saves result to cache and returns the data.
    """
    if years is None:
        now = datetime.now()
        years = list(range(now.year - 2, now.year + 1))

    data = asyncio.run(_scrape_async(years))

    if not data:
        raise RuntimeError("Scraped 0 data points from TSMC investor page.")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    logger.info("Cached %d monthly revenue points → %s", len(data), CACHE_PATH)
    return data


def load_revenue() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def fetch_revenue() -> List[Dict]:
    """Return cached data if available, otherwise scrape."""
    cached = load_revenue()
    if cached:
        return cached
    return scrape_revenue()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")

    now = datetime.now()
    years = list(range(now.year - 2, now.year + 1))
    logger.info("Scraping years: %s", years)

    try:
        data = scrape_revenue(years)
        print(f"Scraped {len(data)} months")
        for row in data[-6:]:
            print(f"  {row['label']:12}  NT${row['revenue']:>12,.0f}M"
                  f"  MoM={row['mom']}%  YoY={row['yoy']}%")
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
