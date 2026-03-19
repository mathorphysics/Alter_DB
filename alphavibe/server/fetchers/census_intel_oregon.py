"""
Intel D1X (Oregon) Equipment Inflow Index
==========================================
Tracks ASML semiconductor equipment (HS-848620) imports from the Netherlands
to Oregon via the US Census Bureau International Trade API (statehs endpoint).

Signal logic:
  - Oregon is home to Intel's D1X R&D campus (Hillsboro, OR)
  - HTS 848620 = "Machines/apparatus for semiconductor device manufacturing"
  - 100% air freight share confirms high-value precision equipment (EUV ships by charter)
  - Monthly spike ≥ $300M or 3× 3-month rolling avg → possible High-NA EUV delivery

Data source: US Census Bureau — State-Level HS Imports (free, no key required)
  https://api.census.gov/data/timeseries/intltrade/imports/statehs
  API key (optional, removes 500 req/day cap): api.census.gov/data/key_signup.html

Cached to: server/data/intel_oregon_equipment.json
"""

import json
import logging
import os
import time
import urllib.request
import urllib.parse
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "intel_oregon_equipment.json"

CENSUS_URL          = "https://api.census.gov/data/timeseries/intltrade/imports/statehs"
NETHERLANDS_CTY     = "4210"   # Census Bureau country code for Netherlands
OREGON_STATE        = "OR"
HTS_CODE            = "848620" # HS-6: semiconductor mfg equipment

SPIKE_THRESHOLD_M   = 300.0    # USD millions — absolute flag threshold
MOM_MULTIPLIER      = 3.0      # flag if value > 3× 3-month rolling average

MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun",
              "Jul","Aug","Sep","Oct","Nov","Dec"]


def _date_range(months: int = 36) -> List[tuple[str, str]]:
    """Return (year, 'MM') pairs for past N months, oldest first.
    Uses previous month as end (current month rarely finalized)."""
    today = date.today()
    year, month = today.year, today.month
    month -= 1
    if month == 0:
        month = 12
        year -= 1
    result = []
    for _ in range(months):
        result.append((str(year), f"{month:02d}"))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(result))


def _period_to_label(year: str, month: str) -> tuple[str, str]:
    """('2025', '01') → ('2025-01', 'Jan 2025')"""
    return f"{year}-{month}", f"{MONTH_ABBR[int(month)-1]} {year}"


def _fetch_month(year: str, month: str, api_key: Optional[str] = None) -> Optional[dict]:
    """Call Census statehs API for one month. Returns raw first data row or None."""
    fields = "GEN_VAL_MO,AIR_VAL_MO,VES_VAL_MO,I_COMMODITY_SDESC,CTY_NAME"
    params: dict = {
        "get":          fields,
        "STATE":        OREGON_STATE,
        "I_COMMODITY":  HTS_CODE,
        "CTY_CODE":     NETHERLANDS_CTY,
        "time":         f"{year}-{month}",
    }
    if api_key:
        params["key"] = api_key

    url = CENSUS_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return None
            raw = json.loads(resp.read())
            if not raw or len(raw) < 2:
                return None
            headers, *rows = raw
            if not rows:
                return None
            return dict(zip(headers, rows[0]))
    except Exception as exc:
        logger.debug("Census API %s-%s: %s", year, month, exc)
        return None


def _rolling_avg(values: List[float], idx: int, window: int = 3) -> Optional[float]:
    """3-month rolling average ending at idx-1 (lagged by 1)."""
    start = idx - window
    if start < 0:
        return None
    subset = values[start:idx]
    if not subset or all(v == 0 for v in subset):
        return None
    return sum(subset) / len(subset)


def fetch_intel_oregon_equipment(months: int = 36) -> List[Dict]:
    """
    Fetch Census Bureau statehs data for Netherlands→Oregon HTS-848620.
    Returns list of monthly dicts with anomaly flag pre-computed.
    """
    api_key = os.getenv("CENSUS_API_KEY")     # optional: set in .env
    dates   = _date_range(months)
    records = []

    for year, month in dates:
        row = _fetch_month(year, month, api_key)
        period, label = _period_to_label(year, month)

        gen_val = float(row["GEN_VAL_MO"] or 0) / 1e6 if row else 0.0
        air_val = float(row["AIR_VAL_MO"] or 0) / 1e6 if row else 0.0
        ves_val = float(row["VES_VAL_MO"] or 0) / 1e6 if row else 0.0

        total_transport = air_val + ves_val
        air_pct = round(air_val / total_transport * 100, 1) if total_transport > 0 else None

        records.append({
            "period":  period,
            "label":   label,
            "value":   round(gen_val, 2),
            "air_val": round(air_val, 2),
            "ves_val": round(ves_val, 2),
            "air_pct": air_pct,
            "flagged": False,    # filled in second pass
        })
        time.sleep(0.25)

    # Second pass: compute anomaly flags with rolling context
    vals = [r["value"] for r in records]
    for i, rec in enumerate(records):
        v = rec["value"]
        if v <= 0:
            continue
        # Flag 1: absolute threshold
        flag_abs = v >= SPIKE_THRESHOLD_M
        # Flag 2: MoM spike vs 3-month rolling average
        avg = _rolling_avg(vals, i)
        flag_mom = avg is not None and v > avg * MOM_MULTIPLIER and v > 50.0
        # Flag 3: high-value air-dominant month (EUV always flies)
        flag_air = (rec["air_pct"] is not None and rec["air_pct"] > 90 and v > 50.0)
        rec["flagged"] = bool(flag_abs or flag_mom or flag_air)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2))
    logger.info("Cached %d months → %s", len(records), CACHE_PATH)
    return records


def load_intel_oregon() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_intel_oregon() -> List[Dict]:
    cached = load_intel_oregon()
    if cached:
        return cached
    return fetch_intel_oregon_equipment()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_intel_oregon_equipment(months=36)
        flagged = [r for r in data if r["flagged"]]
        print(f"\nFetched {len(data)} months — {len(flagged)} flagged\n")
        header = f"{'Period':<10}  {'Value':>12}  {'Air%':>6}  {'Flag'}"
        print(header)
        print("-" * len(header))
        for row in data:
            flag = "*** FLAG ***" if row["flagged"] else ""
            air  = f"{row['air_pct']:.0f}%" if row["air_pct"] is not None else "  n/a"
            print(f"{row['period']:<10}  ${row['value']:>9.1f}M  {air:>6}  {flag}")
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
