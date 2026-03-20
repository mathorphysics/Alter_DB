"""
Taiwan Semiconductor Equipment Import Fetcher
Data source: Taiwan Customs Administration (關務署)
             https://portal.sw.nat.gov.tw/APGA/GA30E

CSV format (English export):
  Imports/Exports | Time    | Commodity Code | Description of Good | Value(USD$ 1000)
  Imports         | 2022/1  | 8486           | Machines and...     | 1823251

Value unit: USD thousands → converted to USD millions on output.
"""

import csv
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR         = Path(__file__).parent.parent / "data"
CACHE_PATH       = DATA_DIR / "taiwan_equipment_imports.json"
CACHE_TRADE_PATH = DATA_DIR / "taiwan_equipment_trade.json"
CSV_PATH         = DATA_DIR / "taiwan_equipment_imports.csv"   # used by upload endpoint
IMPORT_CSV_PATH  = DATA_DIR / "import.csv"
EXPORT_CSV_PATH  = DATA_DIR / "export.csv"


# ── CSV file discovery ────────────────────────────────────────────────────────

def _find_csv() -> Optional[Path]:
    """Return the first CSV file in the data directory, or None."""
    csvs = sorted(DATA_DIR.glob("*.csv"))
    return csvs[0] if csvs else None


# ── Encoding detection ────────────────────────────────────────────────────────

def _read_raw(path: Path) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp950", "big5"):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, LookupError):
            continue
    raise ValueError(f"Cannot decode {path.name}")


# ── Date parsing ──────────────────────────────────────────────────────────────

def _parse_time(time_str: str) -> Optional[str]:
    """
    Parse the Time column into 'YYYY-MM'.

    Handles:
      '2022/1'   → '2022-01'
      '2022/01'  → '2022-01'
      '202201'   → '2022-01'   (6-digit combined)
      '11301'    → '2024-01'   (ROC 3-digit + 2-digit month)
    """
    s = time_str.strip()

    # Format: YYYY/M or YYYY/MM
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 2:
            try:
                year, month = int(parts[0]), int(parts[1])
                # ROC year
                if year < 200:
                    year += 1911
                if 1990 <= year <= 2100 and 1 <= month <= 12:
                    return f"{year}-{month:02d}"
            except ValueError:
                pass

    # Format: YYYYMM (6 digits Western)
    if len(s) == 6 and s.isdigit():
        year, month = int(s[:4]), int(s[4:])
        if 1990 <= year <= 2100 and 1 <= month <= 12:
            return f"{year}-{month:02d}"

    # Format: YYYМM (5 digits ROC)
    if len(s) == 5 and s.isdigit():
        year, month = int(s[:3]) + 1911, int(s[3:])
        if 1 <= month <= 12:
            return f"{year}-{month:02d}"

    return None


# ── Column finder ─────────────────────────────────────────────────────────────

def _find_col(headers: List[str], keywords: List[str]) -> Optional[int]:
    kw = [k.lower() for k in keywords]
    for i, h in enumerate(headers):
        if any(k in h.lower() for k in kw):
            return i
    return None


# ── Main parser ───────────────────────────────────────────────────────────────

def parse_csv(path: Path) -> List[Dict]:
    """
    Parse the Taiwan Customs CSV export into a clean monthly time-series.

    Returns list of dicts sorted ascending by date:
        date   : "YYYY-MM"
        label  : "Jan 2022"
        value  : float, USD Millions (rounded to 1 decimal)
    """
    raw     = _read_raw(path)
    rows    = list(csv.reader(raw.splitlines()))
    headers = [h.strip() for h in rows[0]]

    logger.info("Columns: %s", headers)

    # Locate columns
    time_col = _find_col(headers, ["time", "年月", "period", "date", "month", "year/month"])
    val_col  = _find_col(headers, ["value", "金額", "amount", "usd", "千元"])

    if time_col is None:
        raise ValueError(f"Cannot find date/time column. Headers: {headers}")
    if val_col is None:
        raise ValueError(f"Cannot find value column. Headers: {headers}")

    logger.info("time_col=%d (%s)  val_col=%d (%s)",
                time_col, headers[time_col], val_col, headers[val_col])

    totals: Dict[str, float] = {}

    for row in rows[1:]:
        if not any(c.strip() for c in row):
            continue
        if len(row) <= max(time_col, val_col):
            continue

        date = _parse_time(row[time_col])
        if not date:
            continue

        val_str = row[val_col].strip().replace(",", "")
        if not val_str or not any(c.isdigit() for c in val_str):
            continue
        try:
            value_m = float(val_str) / 1_000   # USD thousands → USD millions
        except ValueError:
            continue

        totals[date] = totals.get(date, 0.0) + value_m

    if not totals:
        raise ValueError("Parsed 0 data points — check CSV format.")

    output = []
    for date in sorted(totals):
        y, m = int(date[:4]), int(date[5:])
        output.append({
            "date":  date,
            "label": datetime(y, m, 1).strftime("%b %Y"),
            "value": round(totals[date], 1),
        })

    logger.info("Parsed %d monthly points from %s", len(output), path.name)
    return output


# ── Cache ─────────────────────────────────────────────────────────────────────

def save_cache(data: List[Dict]) -> None:
    CACHE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def load_cache() -> Optional[List[Dict]]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def save_trade_cache(imports: List[Dict], exports: List[Dict]) -> None:
    CACHE_TRADE_PATH.write_text(
        json.dumps({"imports": imports, "exports": exports}, ensure_ascii=False, indent=2)
    )

def load_trade_cache() -> Optional[Dict]:
    return json.loads(CACHE_TRADE_PATH.read_text()) if CACHE_TRADE_PATH.exists() else None


# ── Entry point ───────────────────────────────────────────────────────────────

def fetch_equipment_trade() -> Dict:
    """Return combined imports + exports monthly series from import.csv / export.csv."""
    if IMPORT_CSV_PATH.exists() and EXPORT_CSV_PATH.exists():
        imports = parse_csv(IMPORT_CSV_PATH)
        exports = parse_csv(EXPORT_CSV_PATH)
        save_trade_cache(imports, exports)
        return {"imports": imports, "exports": exports}

    cached = load_trade_cache()
    if cached:
        return cached

    raise FileNotFoundError(
        "import.csv and export.csv not found in server/data/. "
        "Download from https://portal.sw.nat.gov.tw/APGA/GA30E and place both files there."
    )


def fetch_equipment_imports() -> List[Dict]:
    if IMPORT_CSV_PATH.exists():
        data = parse_csv(IMPORT_CSV_PATH)
        save_cache(data)
        return data

    cached = load_cache()
    if cached:
        return cached

    raise FileNotFoundError(
        "No CSV found in server/data/. "
        "Download from https://portal.sw.nat.gov.tw/APGA/GA30E "
        "(HS 8486, Monthly, Imports) and place the file in server/data/."
    )
