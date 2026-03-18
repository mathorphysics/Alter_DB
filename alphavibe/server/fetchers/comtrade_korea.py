"""
Korea HS-848620 Equipment Inflow Index
Tracks semiconductor manufacturing equipment (HS 848620) exports TO South Korea
from the Netherlands and USA — proxy for Samsung Foundry capex.

Data source: UN Comtrade Public API (no auth required)
  https://comtradeapi.un.org/public/v1/preview/C/M/HS

Reporters : Netherlands (528), USA (842)
Partner   : South Korea (410)
Flow      : X (exports)
Unit      : USD Millions

Cached to : server/data/korea_equipment_trade.json
"""

import json
import logging
import time
import urllib.request
import urllib.parse
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "korea_equipment_trade.json"

COMTRADE_URL = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"

REPORTERS = {
    "Netherlands": 528,
    "USA":         842,
}
PARTNER_KR = 410
HS_CODE    = "848620"

MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun",
              "Jul","Aug","Sep","Oct","Nov","Dec"]


def _periods_yyyymm(months: int = 24) -> List[str]:
    """Return last N months as ['YYYYMM', ...] in ascending order.
    Starts 3 months back to account for UN Comtrade reporting lag."""
    today = date.today()
    result = []
    year, month = today.year, today.month
    # Skip 3 most recent months (reporting lag)
    for _ in range(3):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    for _ in range(months):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
        result.append(f"{year}{month:02d}")
    return list(reversed(result))


def _period_to_label(yyyymm: str) -> tuple[str, str]:
    """'202301' → ('2023-01', 'Jan 2023')"""
    y, m = yyyymm[:4], yyyymm[4:]
    label = f"{MONTH_ABBR[int(m)-1]} {y}"
    return f"{y}-{m}", label


def _fetch_chunk(reporter_code: int, periods: List[str]) -> List[dict]:
    """Fetch one chunk (≤12 months) for one reporter."""
    period_str = ",".join(periods)
    url = (
        f"{COMTRADE_URL}"
        f"?reporterCode={reporter_code}"
        f"&partnerCode={PARTNER_KR}"
        f"&cmdCode={HS_CODE}"
        f"&flowCode=X"
        f"&period={period_str}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("data", [])


def _fetch_reporter(reporter_code: int, periods: List[str]) -> List[dict]:
    """Fetch all months for one reporter, in chunks of 12."""
    CHUNK = 12
    results = []
    for i in range(0, len(periods), CHUNK):
        chunk = periods[i:i + CHUNK]
        results.extend(_fetch_chunk(reporter_code, chunk))
        if i + CHUNK < len(periods):
            time.sleep(1.5)
    return results


def fetch_korea_equipment_trade(months: int = 24) -> List[Dict]:
    periods = _periods_yyyymm(months)
    merged: Dict[str, Dict] = {}

    for country, code in REPORTERS.items():
        try:
            logger.info("Fetching UN Comtrade for %s → Korea", country)
            records = _fetch_reporter(code, periods)
            logger.info("  %d records received", len(records))

            for rec in records:
                raw_period = str(rec.get("period", ""))
                if len(raw_period) != 6:
                    continue
                iso, lbl = _period_to_label(raw_period)
                if iso not in merged:
                    merged[iso] = {"period": iso, "label": lbl}
                val_usd = rec.get("primaryValue") or 0
                merged[iso][country] = round(val_usd / 1e6, 2)

        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", country, exc)

        time.sleep(1.5)   # UN Comtrade free tier: be polite

    result = sorted(merged.values(), key=lambda r: r["period"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("Cached %d periods → %s", len(result), CACHE_PATH)
    return result


def load_korea_trade() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_korea_trade() -> List[Dict]:
    cached = load_korea_trade()
    if cached:
        return cached
    return fetch_korea_equipment_trade()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_korea_equipment_trade(months=24)
        print(f"\nFetched {len(data)} months\n")
        header = f"{'Period':<10}  {'Netherlands':>14}  {'USA':>14}"
        print(header)
        print("-" * len(header))
        for row in data:
            print(
                f"{row['period']:<10}"
                f"  ${row.get('Netherlands', 0):>10.1f}M"
                f"  ${row.get('USA', 0):>10.1f}M"
            )
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
