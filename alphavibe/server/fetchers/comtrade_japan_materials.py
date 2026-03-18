"""
Japan → Korea Materials Flow
Tracks key semiconductor materials exported from Japan to South Korea:
  - Silicon Wafers  (HS 381800)
  - Photoresist     (HS 370790)

Used as a proxy for Samsung Foundry / SK Hynix fab activity.

Data source: UN Comtrade Public API (no auth required)
  https://comtradeapi.un.org/public/v1/preview/C/M/HS

Reporter : Japan (392)
Partner  : South Korea (410)
Flow     : X (exports)
Unit     : USD Millions

Cached to: server/data/japan_korea_materials.json
"""

import json
import logging
import time
import urllib.request
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "japan_korea_materials.json"

COMTRADE_URL = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"

REPORTER_JP = 392
PARTNER_KR  = 410

HS_CODES = {
    "SiliconWafers": "381800",
    "Photoresist":   "370790",
}

MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun",
              "Jul","Aug","Sep","Oct","Nov","Dec"]


def _periods_yyyymm(months: int = 24) -> List[str]:
    """Return last N months (with 3-month reporting lag) as YYYYMM strings."""
    today = date.today()
    year, month = today.year, today.month
    for _ in range(3):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    result = []
    for _ in range(months):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
        result.append(f"{year}{month:02d}")
    return list(reversed(result))


def _period_to_label(yyyymm: str) -> tuple[str, str]:
    y, m = yyyymm[:4], yyyymm[4:]
    return f"{y}-{m}", f"{MONTH_ABBR[int(m)-1]} {y}"


def _fetch_chunk(hs_code: str, periods: List[str]) -> List[dict]:
    period_str = ",".join(periods)
    url = (
        f"{COMTRADE_URL}"
        f"?reporterCode={REPORTER_JP}"
        f"&partnerCode={PARTNER_KR}"
        f"&cmdCode={hs_code}"
        f"&flowCode=X"
        f"&period={period_str}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("data", [])


def _fetch_hs(hs_code: str, periods: List[str]) -> List[dict]:
    """Fetch all months for one HS code, in chunks of 12."""
    results = []
    for i in range(0, len(periods), 12):
        chunk = periods[i:i + 12]
        results.extend(_fetch_chunk(hs_code, chunk))
        if i + 12 < len(periods):
            time.sleep(1.5)
    return results


def fetch_japan_korea_materials(months: int = 24) -> List[Dict]:
    periods = _periods_yyyymm(months)
    merged: Dict[str, Dict] = {}

    for col_name, hs_code in HS_CODES.items():
        try:
            logger.info("Fetching UN Comtrade JP→KR HS %s (%s)", hs_code, col_name)
            records = _fetch_hs(hs_code, periods)
            logger.info("  %d records received", len(records))

            for rec in records:
                raw = str(rec.get("period", ""))
                if len(raw) != 6:
                    continue
                iso, lbl = _period_to_label(raw)
                if iso not in merged:
                    merged[iso] = {"period": iso, "label": lbl}
                val_usd = rec.get("primaryValue") or 0
                merged[iso][col_name] = round(val_usd / 1e6, 2)

        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", col_name, exc)

        time.sleep(1.5)

    result = sorted(merged.values(), key=lambda r: r["period"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("Cached %d periods → %s", len(result), CACHE_PATH)
    return result


def load_japan_materials() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_japan_materials() -> List[Dict]:
    cached = load_japan_materials()
    if cached:
        return cached
    return fetch_japan_korea_materials()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_japan_korea_materials(months=24)
        print(f"\nFetched {len(data)} months\n")
        header = f"{'Period':<10}  {'SiliconWafers':>16}  {'Photoresist':>14}"
        print(header)
        print("-" * len(header))
        for row in data:
            print(
                f"{row['period']:<10}"
                f"  ${row.get('SiliconWafers', 0):>12.1f}M"
                f"  ${row.get('Photoresist',  0):>12.1f}M"
            )
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
