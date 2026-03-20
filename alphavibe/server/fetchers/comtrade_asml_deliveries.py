"""
ASML Equipment Delivery Tracker
Tracks HS-848620 (semiconductor mfg equipment) exports FROM Netherlands
to the four key customer regions.

Proxy logic:
  NL → TW (490)  ASML → TSMC (Hsinchu / Tainan fabs)
  NL → KR (410)  ASML → Samsung (Pyeongtaek / Hwaseong)
  NL → CN (156)  ASML DUV → SMIC — monitors export-control cut-off
  NL → US (842)  ASML → Intel D1X (Oregon) — cross-check vs census_intel_oregon

Data source: UN Comtrade Public API (no auth required)
  https://comtradeapi.un.org/public/v1/preview/C/M/HS

Reporter : Netherlands (528)
Flow     : X (exports)
HS Code  : 848620
Unit     : USD Millions

Cached to: server/data/asml_deliveries.json
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
CACHE_PATH = DATA_DIR / "asml_deliveries.json"

COMTRADE_URL = "https://comtradeapi.un.org/public/v1/preview/C/M/HS"

REPORTER_NL = 528
HS_CODE     = "848620"

PARTNERS = {
    "Taiwan": 490,
    "Korea":  410,
    "China":  156,
    "USA":    842,
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


def _fetch_chunk(partner_code: int, periods: List[str]) -> List[dict]:
    period_str = ",".join(periods)
    url = (
        f"{COMTRADE_URL}"
        f"?reporterCode={REPORTER_NL}"
        f"&partnerCode={partner_code}"
        f"&cmdCode={HS_CODE}"
        f"&flowCode=X"
        f"&period={period_str}"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("data", [])


def _fetch_partner(partner_code: int, periods: List[str]) -> List[dict]:
    """Fetch all months for one destination, chunked to ≤12 per request."""
    results = []
    for i in range(0, len(periods), 12):
        chunk = periods[i:i + 12]
        results.extend(_fetch_chunk(partner_code, chunk))
        if i + 12 < len(periods):
            time.sleep(1.5)
    return results


def fetch_asml_deliveries(months: int = 24) -> List[Dict]:
    periods = _periods_yyyymm(months)
    merged: Dict[str, Dict] = {}

    for country, code in PARTNERS.items():
        try:
            logger.info("Fetching UN Comtrade NL → %s HS-848620", country)
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
            logger.warning("Failed to fetch NL → %s: %s", country, exc)

        time.sleep(1.5)   # UN Comtrade free tier: be polite

    result = sorted(merged.values(), key=lambda r: r["period"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("Cached %d periods → %s", len(result), CACHE_PATH)
    return result


def load_asml_deliveries() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_asml_deliveries() -> List[Dict]:
    cached = load_asml_deliveries()
    if cached:
        return cached
    return fetch_asml_deliveries()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_asml_deliveries(months=24)
        print(f"\nFetched {len(data)} months\n")
        header = f"{'Period':<10}  {'Taiwan':>10}  {'Korea':>10}  {'China':>10}  {'USA':>10}"
        print(header)
        print("-" * len(header))
        for row in data:
            print(
                f"{row['period']:<10}"
                f"  ${row.get('Taiwan', 0):>7.1f}M"
                f"  ${row.get('Korea',  0):>7.1f}M"
                f"  ${row.get('China',  0):>7.1f}M"
                f"  ${row.get('USA',    0):>7.1f}M"
            )
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
