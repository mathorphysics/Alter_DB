"""
SemiResearch — Alternative Data API  (port 3001)

Endpoints:
  GET  /alt-data/v1/tsmc/equipment-imports        — return parsed time-series
  POST /alt-data/v1/upload/taiwan-equipment-imports — upload CSV from MOF
  GET  /health
"""

import logging
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fetchers.taiwan_customs import CSV_PATH, fetch_equipment_imports, fetch_equipment_trade, parse_csv, save_cache
from fetchers.tsmc_revenue import fetch_revenue, scrape_revenue
from fetchers.fabless_inventory import get_inventory, fetch_fabless_inventory

try:
    from fetchers.auto_download import download_csv as _auto_download_csv
except ImportError:
    _auto_download_csv = None

load_dotenv()
logging.basicConfig(level=logging.INFO)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SemiResearch Alt-Data API",
    version="0.2.0",
)

import os

_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"] + _extra_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Schemas ───────────────────────────────────────────────────────────────────

class DataPoint(BaseModel):
    date:  str    # "YYYY-MM"
    label: str    # "Jan 2024"
    value: float  # USD Millions

class EquipmentImportResponse(BaseModel):
    title:   str
    unit:    str
    source:  str
    hs_code: str
    as_of:   str
    count:   int
    results: List[DataPoint]

class UploadResponse(BaseModel):
    message: str
    rows_parsed: int
    date_range: str

class EquipmentTradeResponse(BaseModel):
    title:   str
    unit:    str
    source:  str
    hs_code: str
    as_of:   str
    imports: List[DataPoint]
    exports: List[DataPoint]

class RefreshResponse(BaseModel):
    message: str
    csv_file: str
    rows_parsed: int
    date_range: str

# ── GET: equipment imports ────────────────────────────────────────────────────

@app.get(
    "/alt-data/v1/tsmc/equipment-imports",
    response_model=EquipmentImportResponse,
    summary="Taiwan HS-8486 Monthly Import Value",
    tags=["Alt Data — TSMC"],
)
def get_equipment_imports():
    try:
        data = fetch_equipment_imports()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return EquipmentImportResponse(
        title   = "Taiwan Semiconductor Equipment Import Value",
        unit    = "USD Millions",
        source  = "Taiwan Customs Administration — HS Code 8486",
        hs_code = "8486",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        count   = len(data),
        results = data,
    )

# ── GET: equipment trade (imports + exports) ──────────────────────────────────

@app.get(
    "/alt-data/v1/tsmc/equipment-trade",
    response_model=EquipmentTradeResponse,
    summary="Taiwan HS-8486 Monthly Import & Export Value",
    tags=["Alt Data — TSMC"],
)
def get_equipment_trade():
    try:
        data = fetch_equipment_trade()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return EquipmentTradeResponse(
        title   = "Taiwan Semiconductor Equipment Trade",
        unit    = "USD Millions",
        source  = "Taiwan Customs Administration — HS Code 8486",
        hs_code = "8486",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        imports = data["imports"],
        exports = data["exports"],
    )


# ── POST: upload CSV ──────────────────────────────────────────────────────────

@app.post(
    "/alt-data/v1/upload/taiwan-equipment-imports",
    response_model=UploadResponse,
    summary="Upload Taiwan Customs CSV (HS 8486, monthly imports)",
    tags=["Alt Data — TSMC"],
)
async def upload_equipment_csv(file: UploadFile = File(...)):
    # Save uploaded file to data/
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    CSV_PATH.write_bytes(content)

    # Parse and cache
    try:
        data = parse_csv(CSV_PATH)
    except Exception as e:
        CSV_PATH.unlink(missing_ok=True)   # remove corrupt file
        raise HTTPException(status_code=422, detail=f"Parse error: {e}")

    save_cache(data)

    date_range = f"{data[0]['label']} → {data[-1]['label']}" if data else "n/a"

    return UploadResponse(
        message     = "CSV uploaded and parsed successfully.",
        rows_parsed = len(data),
        date_range  = date_range,
    )

# ── GET: TSMC monthly revenue ─────────────────────────────────────────────────

class RevenuePoint(BaseModel):
    date:    str
    label:   str
    revenue: float
    mom:     Optional[float] = None
    yoy:     Optional[float] = None

class TsmcRevenueResponse(BaseModel):
    title:   str
    unit:    str
    source:  str
    as_of:   str
    count:   int
    results: List[RevenuePoint]

@app.get(
    "/alt-data/v1/tsmc/monthly-revenue",
    response_model=TsmcRevenueResponse,
    summary="TSMC Monthly Revenue (NT$ Millions, 3 years)",
    tags=["Alt Data — TSMC"],
)
def get_tsmc_revenue():
    try:
        data = fetch_revenue()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return TsmcRevenueResponse(
        title   = "TSMC Monthly Revenue",
        unit    = "NT$ Millions",
        source  = "investor.tsmc.com",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        count   = len(data),
        results = data,
    )

@app.post(
    "/alt-data/v1/refresh/tsmc-revenue",
    response_model=TsmcRevenueResponse,
    summary="Re-scrape TSMC monthly revenue from investor.tsmc.com",
    tags=["Alt Data — TSMC"],
)
def refresh_tsmc_revenue():
    try:
        data = scrape_revenue()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return TsmcRevenueResponse(
        title   = "TSMC Monthly Revenue",
        unit    = "NT$ Millions",
        source  = "investor.tsmc.com",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        count   = len(data),
        results = data,
    )


# ── GET: Fabless Inventory Index ──────────────────────────────────────────────

class InventoryPoint(BaseModel):
    period:       str
    Apple_Mobile: Optional[float] = None
    Nvidia_HPC:   Optional[float] = None
    Amazon_CSP:   Optional[float] = None

class FablessInventoryResponse(BaseModel):
    title:       str
    unit:        str
    description: str
    as_of:       str
    count:       int
    results:     List[InventoryPoint]

@app.get(
    "/alt-data/v1/tsmc/fabless-inventory",
    response_model=FablessInventoryResponse,
    summary="Top Fabless Inventory Index — AAPL / NVDA / AMZN quarterly inventory",
    tags=["Alt Data — TSMC"],
)
def get_fabless_inventory():
    try:
        data = get_inventory()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return FablessInventoryResponse(
        title       = "Top Fabless Inventory Index",
        unit        = "Billions USD",
        description = "Quarterly inventory levels for TSMC's key downstream customers",
        as_of       = datetime.now().strftime("%Y-%m-%d"),
        count       = len(data),
        results     = data,
    )

@app.post(
    "/alt-data/v1/refresh/fabless-inventory",
    response_model=FablessInventoryResponse,
    summary="Re-fetch fabless inventory from yfinance",
    tags=["Alt Data — TSMC"],
)
def refresh_fabless_inventory():
    try:
        data = fetch_fabless_inventory(years=4)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return FablessInventoryResponse(
        title       = "Top Fabless Inventory Index",
        unit        = "Billions USD",
        description = "Quarterly inventory levels for TSMC's key downstream customers",
        as_of       = datetime.now().strftime("%Y-%m-%d"),
        count       = len(data),
        results     = data,
    )


# ── POST: auto-refresh via portal scrape ─────────────────────────────────────

@app.post(
    "/alt-data/v1/refresh/taiwan-equipment-imports",
    response_model=RefreshResponse,
    summary="Auto-download latest HS-8486 CSV from Taiwan Customs portal",
    tags=["Alt Data — TSMC"],
)
def refresh_equipment_imports():
    """
    Launches a headless Chromium browser to fill the GA30E query form,
    solves the CAPTCHA with OCR, downloads the CSV, and re-caches the data.
    """
    try:
        csv_path = _auto_download_csv()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Auto-download failed: {e}")

    try:
        data = parse_csv(csv_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parse error: {e}")

    save_cache(data)
    date_range = f"{data[0]['label']} → {data[-1]['label']}" if data else "n/a"

    return RefreshResponse(
        message     = "CSV auto-downloaded and parsed successfully.",
        csv_file    = csv_path.name,
        rows_parsed = len(data),
        date_range  = date_range,
    )


# ── Equity endpoints (yfinance, mimics OpenBB response shape) ─────────────────

import yfinance as yf

@app.get("/api/v1/equity/price/quote", tags=["Equity"])
def equity_quote(symbol: str, provider: str = "yfinance"):
    try:
        info = yf.Ticker(symbol).fast_info
        return {"results": [{
            "symbol":     symbol.upper(),
            "last_price": getattr(info, "last_price", None),
            "prev_close": getattr(info, "previous_close", None),
        }]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/equity/profile", tags=["Equity"])
def equity_profile(symbol: str, provider: str = "yfinance"):
    try:
        info = yf.Ticker(symbol).info
        return {"results": [{
            "symbol":            symbol.upper(),
            "name":              info.get("longName") or info.get("shortName"),
            "sector":            info.get("sector"),
            "industry_category": info.get("industry"),
            "hq_country":        info.get("country"),
            "stock_exchange":    info.get("exchange"),
        }]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/equity/fundamental/metrics", tags=["Equity"])
def equity_metrics(symbol: str, provider: str = "yfinance", period: str = "annual", limit: int = 1):
    try:
        info = yf.Ticker(symbol).info
        raw_de = info.get("debtToEquity")
        return {"results": [{
            "symbol":                symbol.upper(),
            "market_cap":            info.get("marketCap"),
            "pe_ratio":              info.get("trailingPE"),
            "enterprise_to_ebitda":  info.get("enterpriseToEbitda"),
            "profit_margin":         info.get("profitMargins"),
            "revenue_growth":        info.get("revenueGrowth"),
            "return_on_equity":      info.get("returnOnEquity"),
            "debt_to_equity":        raw_de / 100 if raw_de is not None else None,
        }]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/equity/price/historical", tags=["Equity"])
def equity_historical(
    symbol: str,
    provider: str = "yfinance",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    interval: str = "1d",
):
    try:
        df = yf.Ticker(symbol).history(start=start_date, end=end_date, interval=interval)
        results = [
            {
                "date":   str(idx.date()),
                "open":   row["Open"],
                "high":   row["High"],
                "low":    row["Low"],
                "close":  row["Close"],
                "volume": int(row["Volume"]),
            }
            for idx, row in df.iterrows()
        ]
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}

# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
