"""
ASML → Intel D1X (Oregon) Semiconductor Equipment Import Tracker
================================================================
Alt Data: US Census Bureau International Trade API (statehs endpoint)

Strategy Logic:
  - ASML (Netherlands) ships High-NA EUV lithography machines to Intel's D1X
    fab in Hillsboro, Oregon. Each machine costs ~$350M+.
  - HTS 848620: "Machines/apparatus for semiconductor mfg" (HS-6 level)
  - Signal: Monthly spike in Netherlands→Oregon 848620 imports = likely delivery
  - Secondary signal: AIR_VAL_MO dominance (ASML uses chartered AN-124 / 747F
    cargo planes — these machines are NOT shipped by sea)

OpenBB Note:
  OpenBB does NOT currently wrap the Census Bureau `statehs` endpoint.
  This script calls the Census API directly. The `obb.economy.trade_balance`
  endpoints are country-level only and lack HTS/state granularity.

API Reference:
  https://api.census.gov/data/timeseries/intltrade/imports/statehs
  Free key signup: https://api.census.gov/data/key_signup.html (500 req/day without key)

Usage:
  pip install requests pandas numpy
  python asml_intel_d1x_tracker.py
  python asml_intel_d1x_tracker.py --api-key YOUR_KEY --months 36
"""

import argparse
import time
from datetime import datetime

import numpy as np
import pandas as pd
import requests
from dateutil.relativedelta import relativedelta

# ── Constants ────────────────────────────────────────────────────────────────

API_BASE = "https://api.census.gov/data/timeseries/intltrade/imports/statehs"

NETHERLANDS_CTY_CODE = "4210"   # Census Bureau country code for Netherlands
OREGON_STATE = "OR"             # Census Bureau uses 2-char postal codes for statehs
HTS_CODE = "848620"             # HS-6: Machines/apparatus for semiconductor mfg
                                # (statehs only goes to HS-6 granularity)

# Anomaly detection thresholds
HIGH_NA_EUV_PRICE_USD = 350_000_000   # ~$350M per High-NA EUV unit (ASML list price)
SPIKE_THRESHOLD_USD   = 300_000_000   # Flag any month ≥ $300M
MOM_SPIKE_MULTIPLIER  = 3.0           # Flag if MoM > 3× 3-month rolling avg

# Fields to request from Census API
GET_FIELDS = ",".join([
    "STATE",
    "I_COMMODITY",
    "I_COMMODITY_SDESC",
    "CTY_CODE",
    "CTY_NAME",
    "GEN_VAL_MO",      # General imports customs value (monthly) — headline figure
    "GEN_VAL_YR",      # Year-to-date cumulative
    "AIR_VAL_MO",      # Air freight value — ASML ships EUV by charter cargo plane
    "VES_VAL_MO",      # Vessel value — should be near-zero for EUV deliveries
])

# ── Date helpers ─────────────────────────────────────────────────────────────

def get_date_range(months: int = 36) -> list[tuple[str, str]]:
    """
    Return (year, month) pairs for the past N months, oldest first.
    Uses previous month as end point (current month rarely finalized).
    """
    end = datetime.now().replace(day=1) - relativedelta(months=1)
    dates = []
    for i in range(months - 1, -1, -1):
        d = end - relativedelta(months=i)
        dates.append((str(d.year), f"{d.month:02d}"))
    return dates

# ── API fetcher ───────────────────────────────────────────────────────────────

def fetch_month(year: str, month: str, api_key: str | None = None) -> list | None:
    """
    Fetch one month of statehs data for Oregon × Netherlands × HTS 848620.
    Returns raw JSON list-of-lists, or None on failure.
    """
    params: dict = {
        "get": GET_FIELDS,
        "STATE": OREGON_STATE,
        "I_COMMODITY": HTS_CODE,
        "CTY_CODE": NETHERLANDS_CTY_CODE,
        "time": f"{year}-{month}",
    }
    if api_key:
        params["key"] = api_key

    try:
        r = requests.get(API_BASE, params=params, timeout=30)
        if r.status_code == 204:
            return None                       # No data for this period
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        print(f"  HTTP {r.status_code} — {e}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

# ── Parser ────────────────────────────────────────────────────────────────────

def parse_response(raw: list) -> pd.DataFrame:
    """Convert Census API list-of-lists → DataFrame."""
    if not raw or len(raw) < 2:
        return pd.DataFrame()
    headers, *rows = raw
    df = pd.DataFrame(rows, columns=headers)

    # Numeric coercion
    for col in ["GEN_VAL_MO", "GEN_VAL_YR", "AIR_VAL_MO", "VES_VAL_MO"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    return df

# ── Anomaly detection ─────────────────────────────────────────────────────────

def detect_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add Possible_High_NA_Delivery flag (bool) with detection logic:
      1. Absolute threshold: monthly customs value ≥ $300M
      2. MoM spike:          monthly value > 3× 3-month rolling average

    High-NA EUV context:
      - ASML TWINSCAN EXE:5000 (High-NA) = ~$350M/unit
      - Standard EUV NXE:3800 = ~$180M/unit
      - A single $300M+ month almost certainly contains ≥1 EUV delivery
    """
    rolling_avg = df["GEN_VAL_MO"].rolling(3, min_periods=1).mean().shift(1)

    flag_absolute = df["GEN_VAL_MO"] >= SPIKE_THRESHOLD_USD
    flag_mom_spike = (df["GEN_VAL_MO"] > rolling_avg * MOM_SPIKE_MULTIPLIER) & (
        df["GEN_VAL_MO"] > 50_000_000  # ignore noise on low-base months
    )

    df["Possible_High_NA_Delivery"] = flag_absolute | flag_mom_spike

    # Air dominance ratio: EUV always flies, never sails
    has_air = "AIR_VAL_MO" in df.columns and "VES_VAL_MO" in df.columns
    if has_air:
        total_transport = df["AIR_VAL_MO"] + df["VES_VAL_MO"]
        df["Air_Pct"] = np.where(
            total_transport > 0,
            df["AIR_VAL_MO"] / total_transport * 100,
            np.nan,
        ).round(1)
        # Upgrade flag: high-value months that arrived by air (strong EUV signal)
        df["Possible_High_NA_Delivery"] = df["Possible_High_NA_Delivery"] | (
            (df["Air_Pct"] > 90) & (df["GEN_VAL_MO"] > 50_000_000)
        )

    return df

# ── Main ──────────────────────────────────────────────────────────────────────

def main(months: int = 36, api_key: str | None = None, output_csv: str = "asml_intel_d1x_tracker.csv"):

    print("=" * 70)
    print("  ASML → Intel D1X (Oregon) | HTS 848620 | Alt Data Tracker")
    print("=" * 70)
    print(f"  HTS Code  : {HTS_CODE} (Semiconductor Mfg Equipment, HS-6)")
    print(f"  Origin    : Netherlands (CTY_CODE={NETHERLANDS_CTY_CODE})")
    print(f"  Dest      : Oregon ({OREGON_STATE})")
    print(f"  Period    : {months} months")
    print(f"  API Key   : {'Provided' if api_key else 'None (500 req/day limit)'}")
    print("=" * 70)

    # ── Fetch ──
    dates = get_date_range(months)
    records: list[pd.DataFrame] = []

    for year, month in dates:
        label = f"{year}-{month}"
        print(f"  Fetching {label} ...", end=" ", flush=True)
        raw = fetch_month(year, month, api_key)
        if raw is None:
            print("no data")
        else:
            df_month = parse_response(raw)
            if df_month.empty:
                print("empty")
            else:
                records.append(df_month)
                val = df_month["GEN_VAL_MO"].sum()
                print(f"${val:,.0f}")
        time.sleep(0.25)   # ~4 req/sec — well within Census rate limits

    if not records:
        print("\n[ERROR] No data returned. Verify API key and parameters.")
        print(f"  Manual test URL:\n  {API_BASE}?get={GET_FIELDS}&STATE={OREGON_STATE}"
              f"&I_COMMODITY={HTS_CODE}&CTY_CODE={NETHERLANDS_CTY_CODE}&time=2024-01")
        return None

    # ── Assemble monthly time series ──
    raw_df = pd.concat(records, ignore_index=True)

    # Aggregate (in case API returns multiple rows per month)
    monthly = (
        raw_df
        .assign(Period=lambda d: pd.to_datetime(d["time"]))
        .groupby("Period", as_index=False)
        .agg(
            GEN_VAL_MO=("GEN_VAL_MO", "sum"),
            GEN_VAL_YR=("GEN_VAL_YR", "sum"),
            AIR_VAL_MO=("AIR_VAL_MO", "sum"),
            VES_VAL_MO=("VES_VAL_MO", "sum"),
            HTS_Desc=("I_COMMODITY_SDESC", "first"),
            Country=("CTY_NAME", "first"),
            State=("STATE", "first"),
        )
        .sort_values("Period")
        .reset_index(drop=True)
    )

    # MoM metrics
    monthly["MoM_Change_USD"] = monthly["GEN_VAL_MO"].diff()
    monthly["MoM_Change_Pct"] = monthly["GEN_VAL_MO"].pct_change() * 100

    # Anomaly detection
    monthly = detect_anomalies(monthly)

    # ── Display ──
    print("\n" + "=" * 70)
    print("  Monthly Import Summary (USD)")
    print("=" * 70)

    display = monthly[["Period", "GEN_VAL_MO", "MoM_Change_USD", "MoM_Change_Pct",
                        "AIR_VAL_MO", "VES_VAL_MO",
                        *( ["Air_Pct"] if "Air_Pct" in monthly.columns else []),
                        "Possible_High_NA_Delivery"]].copy()

    # Human-readable dollar formatting
    for col in ["GEN_VAL_MO", "MoM_Change_USD", "AIR_VAL_MO", "VES_VAL_MO"]:
        display[col] = display[col].apply(lambda v: f"${v/1e6:>8.1f}M" if pd.notna(v) else "       N/A")
    display["MoM_Change_Pct"] = display["MoM_Change_Pct"].apply(
        lambda v: f"{v:+.1f}%" if pd.notna(v) else "    N/A"
    )
    display["Period"] = display["Period"].dt.strftime("%Y-%m")
    display["Possible_High_NA_Delivery"] = display["Possible_High_NA_Delivery"].map(
        {True: "*** FLAG ***", False: ""}
    )

    pd.set_option("display.max_rows", None)
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 120)
    print(display.to_string(index=False))

    # ── Flagged months summary ──
    flagged = monthly[monthly["Possible_High_NA_Delivery"]]
    print(f"\n{'─'*70}")
    print(f"  FLAGGED MONTHS — Possible High-NA / EUV Delivery  "
          f"(threshold: ${SPIKE_THRESHOLD_USD/1e6:.0f}M or {MOM_SPIKE_MULTIPLIER}× 3-mo avg)")
    print(f"{'─'*70}")
    if flagged.empty:
        print("  None detected in this window.")
        print("  Interpretation: No large-format EUV deliveries visible in this period,")
        print("  OR shipments routed through non-Oregon ports of entry.")
    else:
        for _, row in flagged.iterrows():
            air_note = ""
            if "Air_Pct" in row and pd.notna(row["Air_Pct"]):
                air_note = f"  air={row['Air_Pct']:.0f}%"
            print(f"  {row['Period'].strftime('%Y-%m')}:  "
                  f"${row['GEN_VAL_MO']/1e6:.1f}M  "
                  f"(MoM {row['MoM_Change_Pct']:+.1f}%)"
                  f"{air_note}")
        print(f"\n  Est. deliverable units @ $350M/unit: "
              f"{flagged['GEN_VAL_MO'].sum() / HIGH_NA_EUV_PRICE_USD:.1f}")

    # ── Statistics ──
    total = monthly["GEN_VAL_MO"].sum()
    peak  = monthly.loc[monthly["GEN_VAL_MO"].idxmax()]
    print(f"\n  36-month total : ${total/1e6:.1f}M")
    print(f"  Peak month     : {peak['Period'].strftime('%Y-%m')} — ${peak['GEN_VAL_MO']/1e6:.1f}M")
    print(f"  Flagged months : {flagged.shape[0]} / {monthly.shape[0]}")

    # ── Save ──
    monthly.to_csv(output_csv, index=False)
    print(f"\n  Saved: {output_csv}")
    print("=" * 70)

    return monthly


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Track ASML EUV deliveries to Intel D1X via US Census import data"
    )
    parser.add_argument(
        "--api-key", default=None,
        help="Census Bureau API key (free at api.census.gov/data/key_signup.html)"
    )
    parser.add_argument(
        "--months", type=int, default=36,
        help="Number of months to look back (default: 36)"
    )
    parser.add_argument(
        "--output", default="asml_intel_d1x_tracker.csv",
        help="Output CSV filename"
    )
    args = parser.parse_args()
    main(months=args.months, api_key=args.api_key, output_csv=args.output)
