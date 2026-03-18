"""
Top Fabless Inventory Index
Tracks quarterly inventory for TSMC's three key downstream customers:
  - Apple  (AAPL) — Mobile     CIK 0000320193
  - Nvidia (NVDA) — HPC        CIK 0001045810
  - Amazon (AMZN) — CSP        CIK 0001018724

Data source: SEC EDGAR XBRL Company Facts API (free, no API key)
  https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json

Output unit: Billions USD

Cached to: server/data/fabless_inventory.json

Response format (Recharts-ready):
  [
    { "period": "2022-Q1", "Apple_Mobile": 7.5, "Nvidia_HPC": 3.1, "Amazon_CSP": 28.5 },
    ...
  ]
"""

import json
import logging
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "fabless_inventory.json"

SEC_URL    = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SEC_HEADER = {"User-Agent": "AlterDB research@alterdb.com"}

TICKERS = {
    "Apple_Mobile": {"cik": "0000320193", "ticker": "AAPL"},
    "Nvidia_HPC":   {"cik": "0001045810", "ticker": "NVDA"},
    "Amazon_CSP":   {"cik": "0001018724", "ticker": "AMZN"},
}

# InventoryNet candidates in priority order
INVENTORY_XBRL_TAGS = [
    "InventoryNet",
    "InventoryFinishedGoods",
    "InventoryGross",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_calendar_quarter(date_str: str) -> str:
    """
    '2024-06-29' → '2024-Q2'

    Edge case: Apple's fiscal Q2 sometimes ends on Apr 1-2, which would
    naively map to Q2.  Any date with month=4 and day≤7 is treated as Q1.
    """
    dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    month = dt.month
    if month == 4 and dt.day <= 7:
        month = 3          # pull back into Q1
    q = (month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"


def _fetch_sec_facts(cik: str) -> dict:
    url = SEC_URL.format(cik=cik)
    req = urllib.request.Request(url, headers=SEC_HEADER)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _extract_inventory(facts: dict, years: int = 4) -> Dict[str, float]:
    """
    Extract quarterly inventory series from SEC XBRL facts.
    Returns { "YYYY-QN": value_in_billions }
    """
    us_gaap = facts.get("facts", {}).get("us-gaap", {})

    raw_units = None
    for tag in INVENTORY_XBRL_TAGS:
        if tag in us_gaap:
            raw_units = us_gaap[tag]["units"].get("USD", [])
            logger.debug("Using XBRL tag: %s", tag)
            break

    if raw_units is None:
        raise ValueError("No inventory XBRL tag found in SEC facts.")

    cutoff_year = datetime.now().year - years

    # Keep only 10-Q and 10-K filings, deduplicate by end date (keep latest filed)
    by_date: Dict[str, dict] = {}
    for entry in raw_units:
        if entry.get("form") != "10-Q":
            continue
        end = entry.get("end", "")
        if not end or int(end[:4]) < cutoff_year:
            continue
        # Keep the most recently filed entry for each end date
        if end not in by_date or entry.get("filed", "") > by_date[end].get("filed", ""):
            by_date[end] = entry

    result: Dict[str, float] = {}
    for end, entry in by_date.items():
        quarter = _to_calendar_quarter(end)
        val_b   = round(entry["val"] / 1e9, 2)
        # If multiple end-dates map to same quarter, keep the larger value
        if quarter not in result or val_b > result[quarter]:
            result[quarter] = val_b

    return result


# ── Main builder ──────────────────────────────────────────────────────────────

def fetch_fabless_inventory(years: int = 4) -> List[Dict]:
    merged: Dict[str, Dict] = {}

    for col_name, info in TICKERS.items():
        try:
            logger.info("Fetching SEC facts for %s (%s)", info["ticker"], info["cik"])
            facts  = _fetch_sec_facts(info["cik"])
            series = _extract_inventory(facts, years=years)
            logger.info("%s: %d quarters", col_name, len(series))

            for period, val in series.items():
                if period not in merged:
                    merged[period] = {"period": period}
                merged[period][col_name] = val

            time.sleep(0.3)   # be polite to SEC servers

        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", col_name, exc)

    if not merged:
        raise RuntimeError("No inventory data fetched from SEC EDGAR.")

    result = sorted(merged.values(), key=lambda r: r["period"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("Cached %d periods → %s", len(result), CACHE_PATH)
    return result


def load_inventory() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_inventory() -> List[Dict]:
    cached = load_inventory()
    if cached:
        return cached
    return fetch_fabless_inventory()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")

    try:
        data = fetch_fabless_inventory(years=4)
        print(f"\nFetched {len(data)} quarters\n")
        header = f"{'Period':<12} {'Apple_Mobile':>14} {'Nvidia_HPC':>12} {'Amazon_CSP':>12}"
        print(header)
        print("-" * len(header))
        for row in data:
            print(
                f"{row['period']:<12}"
                f"  ${row.get('Apple_Mobile', 0):>10.2f}B"
                f"  ${row.get('Nvidia_HPC',  0):>10.2f}B"
                f"  ${row.get('Amazon_CSP',  0):>10.2f}B"
            )
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
