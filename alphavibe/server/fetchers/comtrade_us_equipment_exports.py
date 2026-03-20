"""
US Semiconductor Equipment Export Tracker
Tracks HS-848620 exports FROM USA to Taiwan, Korea, and China.

Proxy logic:
  US → TW (490)  AMAT / Lam Research / KLA → TSMC
  US → KR (410)  AMAT / Lam Research / KLA → Samsung
  US → CN (156)  Entity-list impact tracker — watch for cliff-drop as
                 BIS restrictions tighten (AMAT/Lam/KLA China exposure)

Data source: UN Comtrade Public API (no auth required)
  https://comtradeapi.un.org/public/v1/preview/C/M/HS

Reporter : USA (842)
Flow     : X (exports)
HS Code  : 848620
Unit     : USD Millions

Cached to: server/data/us_equipment_exports.json
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
CACHE_PATH = DATA_DIR / "us_equipment_exports.json"

COMTRADE_URL = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"

REPORTER_US = 842
HS_CODE     = "848620"

PARTNERS = {
    "Taiwan": 490,
    "Korea":  410,
    "China":  156,
}

MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun",
              "Jul","Aug","Sep","Oct","Nov","Dec"]


def _periods_yyyymm(months: int = 24) -> List[str]:
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


def _fetch_chunk(partner_code: int, periods: List[str]) -> List[dict]:
    period_str = ",".join(periods)
    url = (
        f"{COMTRADE_URL}"
        f"?reporterCode={REPORTER_US}"
        f"&partnerCode={partner_code}"
        f"&cmdCode={HS_CODE}"
        f"&flowCode=X"
        f"&period={period_str}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("data", [])


def _fetch_partner(partner_code: int, periods: List[str]) -> List[dict]:
    results = []
    for i in range(0, len(periods), 12):
        chunk = periods[i:i + 12]
        results.extend(_fetch_chunk(partner_code, chunk))
        if i + 12 < len(periods):
            time.sleep(1.5)
    return results


def fetch_us_equipment_exports(months: int = 24) -> List[Dict]:
    periods = _periods_yyyymm(months)
    merged: Dict[str, Dict] = {}

    for country, code in PARTNERS.items():
        try:
            logger.info("Fetching UN Comtrade US → %s HS-848620", country)
            records = _fetch_partner(code, periods)
            logger.info("  %d records received", len(records))

            for rec in records:
                raw = str(rec.get("period", ""))
                if len(raw) != 6:
                    continue
                iso, lbl = _period_to_label(raw)
                if iso not in merged:
                    merged[iso] = {"period": iso, "label": lbl}
                val_usd = rec.get("primaryValue") or 0
                merged[iso][country] = round(val_usd / 1e6, 2)

        except Exception as exc:
            logger.warning("Failed to fetch US → %s: %s", country, exc)

        time.sleep(1.5)

    result = sorted(merged.values(), key=lambda r: r["period"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("Cached %d periods → %s", len(result), CACHE_PATH)
    return result


def load_us_equipment_exports() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_us_equipment_exports() -> List[Dict]:
    cached = load_us_equipment_exports()
    if cached:
        return cached
    return fetch_us_equipment_exports()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_us_equipment_exports(months=24)
        print(f"\nFetched {len(data)} months\n")
        header = f"{'Period':<10}  {'Taiwan':>10}  {'Korea':>10}  {'China':>10}"
        print(header)
        print("-" * len(header))
        for row in data:
            print(
                f"{row['period']:<10}"
                f"  ${row.get('Taiwan', 0):>7.1f}M"
                f"  ${row.get('Korea',  0):>7.1f}M"
                f"  ${row.get('China',  0):>7.1f}M"
            )
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
