"""
FRED (Federal Reserve Economic Data) fetcher
Data source: https://api.stlouisfed.org/fred/
API key: free at https://fred.stlouisfed.org/docs/api/api_key.html
Set FRED_API_KEY in server/.env
"""

import json
import logging
import os
import ssl
import urllib.request
import urllib.parse
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "fred_macro.json"

# Series to fetch
SERIES = {
    "capacity_utilization": {
        "id":    "CAPUTLG334S",
        "label": "Semiconductor Capacity Utilization",
        "unit":  "%",
        "description": "Capacity Utilization: Computer and Electronic Products",
    },
    "industrial_production": {
        "id":    "INDPRO",
        "label": "Industrial Production Index",
        "unit":  "Index (2017=100)",
        "description": "Board of Governors of the Federal Reserve System: Industrial Production: Total Index",
    },
    "durable_goods_orders": {
        "id":    "DGORDER",
        "label": "Durable Goods New Orders",
        "unit":  "Billions USD",
        "description": "Manufacturers' New Orders: Durable Goods — leading demand indicator",
    },
    "mfg_employment": {
        "id":    "MANEMP",
        "label": "Manufacturing Employment",
        "unit":  "Thousands",
        "description": "All Employees, Manufacturing",
    },
    "pce_durables": {
        "id":    "PCEDG",
        "label": "PCE: Durable Goods",
        "unit":  "Billions USD",
        "description": "Personal Consumption Expenditures: Durable Goods",
    },
}

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


def _fetch_series(series_id: str, api_key: str, start: str = "2015-01-01") -> List[Dict]:
    """Fetch observations for one FRED series. Returns list of {date, value}."""
    params = urllib.parse.urlencode({
        "series_id":         series_id,
        "api_key":           api_key,
        "file_type":         "json",
        "sort_order":        "asc",
        "observation_start": start,
    })
    url = f"{FRED_BASE}?{params}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
        data = json.loads(resp.read())

    out = []
    for obs in data.get("observations", []):
        val_str = obs.get("value", ".")
        if val_str == ".":
            continue
        try:
            out.append({"date": obs["date"][:7], "value": round(float(val_str), 2)})
        except (ValueError, KeyError):
            continue
    return out


def fetch_fred_macro(start: str = "2015-01-01") -> Dict:
    """Fetch all FRED macro series and return combined payload. Caches to disk."""
    api_key = os.getenv("FRED_API_KEY", "")
    if not api_key:
        # Fall back to cache if no key configured
        cached = load_fred_cache()
        if cached:
            logger.warning("FRED_API_KEY not set — returning cached data")
            return cached
        raise EnvironmentError(
            "FRED_API_KEY not set. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html "
            "and add it to server/.env"
        )

    result = {}
    for key, meta in SERIES.items():
        try:
            logger.info("Fetching FRED series %s (%s)", meta["id"], meta["label"])
            observations = _fetch_series(meta["id"], api_key, start)
            result[key] = {
                "id":          meta["id"],
                "label":       meta["label"],
                "unit":        meta["unit"],
                "description": meta["description"],
                "observations": observations,
            }
            logger.info("  %d observations", len(observations))
        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", meta["id"], exc)
            result[key] = {
                "id":          meta["id"],
                "label":       meta["label"],
                "unit":        meta["unit"],
                "description": meta["description"],
                "observations": [],
                "error":       str(exc),
            }

    result["as_of"] = datetime.now().strftime("%Y-%m-%d")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    logger.info("FRED macro cache saved → %s", CACHE_PATH)
    return result


def load_fred_cache() -> Optional[Dict]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return None


def get_fred_macro() -> Dict:
    cached = load_fred_cache()
    if cached:
        return cached
    return fetch_fred_macro()
