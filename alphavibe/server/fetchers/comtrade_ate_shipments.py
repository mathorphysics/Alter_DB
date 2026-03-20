"""
ATE (Automatic Test Equipment) Shipment Tracker
Tracks HS-903180 (instruments/appliances for checking semiconductor devices)
exports from Japan and USA to three key OSAT / foundry regions.

Proxy logic:
  Japan → TW  Advantest → ASE Group / Powertech (PTI) Taiwan
  USA   → TW  Teradyne  → ASE Group / Amkor Taiwan
  Japan → KR  Advantest → Samsung OSAT / Amkor Korea
  USA   → KR  Teradyne  → Samsung OSAT
  Japan → CN  Advantest → JCET / Tongfu Microelectronics
  USA   → CN  Teradyne  → JCET (monitors China advanced-packaging ramp)

ATE equipment lead times are 12-18 months, making inflows a leading
indicator for OSAT capacity ramp — especially critical for CoWoS/HBM
back-end production bottlenecks that constrain AI chip supply.

Data source: UN Comtrade Public API (no auth required)
  https://comtradeapi.un.org/public/v1/preview/C/M/HS

HS Code  : 903180
Flow     : X (exports)
Unit     : USD Millions

Cached to: server/data/ate_shipments.json
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
CACHE_PATH = DATA_DIR / "ate_shipments.json"

COMTRADE_URL = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"

HS_CODE = "903180"

# (reporter_code, reporter_label, partner_code, partner_label)
# Column key: f"{reporter_label}_{partner_label}"
FLOWS = [
    (392, "Japan", 490, "TW"),   # Advantest → Taiwan
    (842, "USA",   490, "TW"),   # Teradyne  → Taiwan
    (392, "Japan", 410, "KR"),   # Advantest → Korea
    (842, "USA",   410, "KR"),   # Teradyne  → Korea
    (392, "Japan", 156, "CN"),   # Advantest → China
    (842, "USA",   156, "CN"),   # Teradyne  → China
]

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


def _fetch_chunk(reporter: int, partner: int, periods: List[str]) -> List[dict]:
    period_str = ",".join(periods)
    url = (
        f"{COMTRADE_URL}"
        f"?reporterCode={reporter}"
        f"&partnerCode={partner}"
        f"&cmdCode={HS_CODE}"
        f"&flowCode=X"
        f"&period={period_str}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("data", [])


def _fetch_flow(reporter: int, partner: int, periods: List[str]) -> List[dict]:
    results = []
    for i in range(0, len(periods), 12):
        chunk = periods[i:i + 12]
        results.extend(_fetch_chunk(reporter, partner, chunk))
        if i + 12 < len(periods):
            time.sleep(1.5)
    return results


def fetch_ate_shipments(months: int = 24) -> List[Dict]:
    periods = _periods_yyyymm(months)
    merged: Dict[str, Dict] = {}

    for (reporter_code, reporter_name, partner_code, partner_name) in FLOWS:
        col = f"{reporter_name}_{partner_name}"
        try:
            logger.info(
                "Fetching UN Comtrade %s → %s HS-%s (ATE)",
                reporter_name, partner_name, HS_CODE,
            )
            records = _fetch_flow(reporter_code, partner_code, periods)
            logger.info("  %d records received", len(records))

            for rec in records:
                raw = str(rec.get("period", ""))
                if len(raw) != 6:
                    continue
                iso, lbl = _period_to_label(raw)
                if iso not in merged:
                    merged[iso] = {"period": iso, "label": lbl}
                val_usd = rec.get("primaryValue") or 0
                merged[iso][col] = round(val_usd / 1e6, 2)

        except Exception as exc:
            logger.warning("Failed to fetch %s → %s: %s", reporter_name, partner_name, exc)

        time.sleep(1.5)

    result = sorted(merged.values(), key=lambda r: r["period"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("Cached %d periods → %s", len(result), CACHE_PATH)
    return result


def load_ate_shipments() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_ate_shipments() -> List[Dict]:
    cached = load_ate_shipments()
    if cached:
        return cached
    return fetch_ate_shipments()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_ate_shipments(months=24)
        print(f"\nFetched {len(data)} months\n")
        cols = ["Japan_TW", "USA_TW", "Japan_KR", "USA_KR", "Japan_CN", "USA_CN"]
        header = f"{'Period':<10}" + "".join(f"  {c:>12}" for c in cols)
        print(header)
        print("-" * len(header))
        for row in data:
            line = f"{row['period']:<10}"
            for c in cols:
                line += f"  ${row.get(c, 0):>9.1f}M"
            print(line)
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
