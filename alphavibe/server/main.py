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
from fetchers.comtrade_korea import get_korea_trade, fetch_korea_equipment_trade
from fetchers.comtrade_japan_materials import get_japan_materials, fetch_japan_korea_materials
from fetchers.samsung_patents import get_patents, refresh_from_xlsx
from fetchers.census_intel_oregon import get_intel_oregon, fetch_intel_oregon_equipment
from fetchers.usaspending_intel import get_intel_funding, fetch_intel_federal_funding
from fetchers.fred import get_fred_macro, fetch_fred_macro

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
import re

def _is_allowed_origin(origin: str) -> bool:
    if origin in ("http://localhost:5173", "http://localhost:5174"):
        return True
    if re.search(r'https://[a-z0-9-]+(\.vercel\.app)$', origin):
        return True
    extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    return origin in extra

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://[a-zA-Z0-9\-]+\.vercel\.app",
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
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


# ── GET: Korea HS-848620 equipment inflow ─────────────────────────────────────

class KoreaTradePoint(BaseModel):
    period:      str
    label:       str
    Netherlands: Optional[float] = None
    USA:         Optional[float] = None

class KoreaEquipmentResponse(BaseModel):
    title:   str
    unit:    str
    source:  str
    hs_code: str
    as_of:   str
    results: List[KoreaTradePoint]

@app.get(
    "/alt-data/v1/samsung/korea-equipment-inflow",
    response_model=KoreaEquipmentResponse,
    summary="Korea HS-848620 Equipment Imports from NL & USA (UN Comtrade)",
    tags=["Alt Data — Samsung"],
)
def get_korea_equipment():
    try:
        data = get_korea_trade()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return KoreaEquipmentResponse(
        title   = "Korea Semiconductor Equipment Inflow",
        unit    = "USD Millions",
        source  = "UN Comtrade — HS 848620",
        hs_code = "848620",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        results = data,
    )

@app.post(
    "/alt-data/v1/refresh/korea-equipment-inflow",
    response_model=KoreaEquipmentResponse,
    summary="Re-fetch Korea equipment inflow from UN Comtrade",
    tags=["Alt Data — Samsung"],
)
def refresh_korea_equipment():
    try:
        data = fetch_korea_equipment_trade(months=24)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return KoreaEquipmentResponse(
        title   = "Korea Semiconductor Equipment Inflow",
        unit    = "USD Millions",
        source  = "UN Comtrade — HS 848620",
        hs_code = "848620",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        results = data,
    )


# ── GET: Japan → Korea materials flow ────────────────────────────────────────

class JapanMaterialsPoint(BaseModel):
    period:       str
    label:        str
    SiliconWafers: Optional[float] = None
    Photoresist:   Optional[float] = None

class JapanMaterialsResponse(BaseModel):
    title:   str
    unit:    str
    source:  str
    as_of:   str
    results: List[JapanMaterialsPoint]

@app.get(
    "/alt-data/v1/samsung/japan-korea-materials",
    response_model=JapanMaterialsResponse,
    summary="Japan → Korea semiconductor materials (HS 381800 / 370790)",
    tags=["Alt Data — Samsung"],
)
def get_japan_materials_endpoint():
    try:
        data = get_japan_materials()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return JapanMaterialsResponse(
        title   = "Japan → Korea Semiconductor Materials",
        unit    = "USD Millions",
        source  = "UN Comtrade — HS 381800 / 370790",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        results = data,
    )

@app.post(
    "/alt-data/v1/refresh/japan-korea-materials",
    response_model=JapanMaterialsResponse,
    summary="Re-fetch Japan→Korea materials from UN Comtrade",
    tags=["Alt Data — Samsung"],
)
def refresh_japan_materials():
    try:
        data = fetch_japan_korea_materials(months=24)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return JapanMaterialsResponse(
        title   = "Japan → Korea Semiconductor Materials",
        unit    = "USD Millions",
        source  = "UN Comtrade — HS 381800 / 370790",
        as_of   = datetime.now().strftime("%Y-%m-%d"),
        results = data,
    )


# ── GET: Samsung patent filing trend ─────────────────────────────────────────

class PatentPoint(BaseModel):
    period: str
    label:  str
    count:  int

class SamsungPatentsResponse(BaseModel):
    title:           str
    source:          str
    as_of:           str
    count:           int
    timeseries:      List[PatentPoint]
    recent_advanced: List[dict]

@app.get(
    "/alt-data/v1/samsung/patents",
    response_model=SamsungPatentsResponse,
    summary="Samsung semiconductor patent filing trend (KIPRIS H01L)",
    tags=["Alt Data — Samsung"],
)
def get_samsung_patents():
    try:
        data = get_patents()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return SamsungPatentsResponse(
        title           = "Samsung Semiconductor Patent Filings",
        source          = f"KIPRIS — H01L · {data.get('source_file', '')}",
        as_of           = datetime.now().strftime("%Y-%m-%d"),
        count           = len(data.get("timeseries", [])),
        timeseries      = data.get("timeseries", []),
        recent_advanced = [],
    )

@app.post(
    "/alt-data/v1/refresh/samsung-patents",
    response_model=SamsungPatentsResponse,
    summary="Re-parse latest KIPRIS xlsx from server/data/",
    tags=["Alt Data — Samsung"],
)
def refresh_samsung_patents():
    try:
        data = refresh_from_xlsx()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return SamsungPatentsResponse(
        title           = "Samsung Semiconductor Patent Filings",
        source          = f"KIPRIS — H01L · {data.get('source_file', '')}",
        as_of           = datetime.now().strftime("%Y-%m-%d"),
        count           = len(data.get("timeseries", [])),
        timeseries      = data.get("timeseries", []),
        recent_advanced = [],
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


# ── GET: Intel Oregon HS-848620 equipment inflow ─────────────────────────────

class IntelOregonPoint(BaseModel):
    period:  str
    label:   str
    value:   float              # USD Millions (GEN_VAL_MO)
    air_val: float              # Air freight portion (USD M)
    ves_val: float              # Vessel portion (USD M)
    air_pct: Optional[float]    # % of value shipped by air
    flagged: bool               # Possible High-NA EUV delivery

class IntelOregonResponse(BaseModel):
    title:       str
    unit:        str
    source:      str
    hs_code:     str
    description: str
    as_of:       str
    count:       int
    results:     List[IntelOregonPoint]

@app.get(
    "/alt-data/v1/intel/oregon-equipment-inflow",
    response_model=IntelOregonResponse,
    summary="Netherlands → Oregon HS-848620 Equipment Imports (US Census statehs)",
    tags=["Alt Data — Intel"],
)
def get_intel_oregon_endpoint():
    try:
        data = get_intel_oregon()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return IntelOregonResponse(
        title       = "ASML → Intel D1X Equipment Inflow (Oregon)",
        unit        = "USD Millions",
        source      = "US Census Bureau — statehs · HTS 848620",
        hs_code     = "848620",
        description = "Monthly semiconductor equipment imports from Netherlands to Oregon. "
                      "Proxy for ASML EUV/High-NA deliveries to Intel D1X (Hillsboro, OR). "
                      "100% air freight share confirms precision instrument shipments.",
        as_of       = datetime.now().strftime("%Y-%m-%d"),
        count       = len(data),
        results     = data,
    )

@app.post(
    "/alt-data/v1/refresh/intel-oregon-equipment",
    response_model=IntelOregonResponse,
    summary="Re-fetch Intel Oregon equipment data from US Census Bureau API",
    tags=["Alt Data — Intel"],
)
def refresh_intel_oregon():
    try:
        data = fetch_intel_oregon_equipment(months=36)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return IntelOregonResponse(
        title       = "ASML → Intel D1X Equipment Inflow (Oregon)",
        unit        = "USD Millions",
        source      = "US Census Bureau — statehs · HTS 848620",
        hs_code     = "848620",
        description = "Monthly semiconductor equipment imports from Netherlands to Oregon.",
        as_of       = datetime.now().strftime("%Y-%m-%d"),
        count       = len(data),
        results     = data,
    )


# ── GET: Intel CHIPS Act Federal Funding ──────────────────────────────────────

class ChipsMilestone(BaseModel):
    date:        str
    event:       str
    amount_b:    Optional[float]
    recipient:   str
    agency:      str
    status:      str
    description: str
    source:      str

class IntelAward(BaseModel):
    award_id:       str
    recipient:      str
    action_date:    str
    amount_usd:     float
    outlays_usd:    float
    funding_agency: str
    sub_agency:     str
    award_type:     str
    cfda:           str
    description:    str
    state:          str
    data_source:    str

class IntelFundingResponse(BaseModel):
    as_of:                  str
    chips_act_date:         str
    chips_grant_signed_b:   Optional[float]
    chips_grant_date:       Optional[str]
    chips_milestones:       List[ChipsMilestone]
    usaspending_count:      int
    usaspending_total_b:    float
    usaspending_outlays_b:  float
    dod_total_b:            float
    commerce_total_b:       float
    api_note:               str
    live_awards:            List[IntelAward]

class FredObservation(BaseModel):
    date:  str
    value: float

class FredSeries(BaseModel):
    id:           str
    label:        str
    unit:         str
    description:  str
    observations: List[FredObservation]
    error:        Optional[str] = None

class FredMacroResponse(BaseModel):
    as_of:                str
    capacity_utilization: FredSeries
    industrial_production: FredSeries
    durable_goods_orders:              FredSeries
    mfg_employment:       FredSeries
    pce_durables:         FredSeries


@app.get(
    "/alt-data/v1/intel/chips-act-funding",
    response_model=IntelFundingResponse,
    summary="Intel CHIPS Act Federal Funding — USAspending API + static milestone ledger",
    tags=["Alt Data — Intel"],
)
def get_intel_chips_funding():
    try:
        data = get_intel_funding()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return data

@app.post(
    "/alt-data/v1/refresh/intel-chips-funding",
    response_model=IntelFundingResponse,
    summary="Re-fetch Intel federal awards from USAspending.gov",
    tags=["Alt Data — Intel"],
)
def refresh_intel_chips_funding():
    try:
        data = fetch_intel_federal_funding()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return data


@app.get(
    "/alt-data/v1/macro/fred",
    response_model=FredMacroResponse,
    summary="FRED Macro Indicators — Semiconductor & Manufacturing",
    tags=["Alt Data — Macro"],
)
def get_macro_fred():
    try:
        data = get_fred_macro()
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return data

@app.post(
    "/alt-data/v1/refresh/macro-fred",
    summary="Refresh FRED macro cache",
    tags=["Alt Data — Macro"],
)
def refresh_macro_fred():
    try:
        data = fetch_fred_macro()
        return {"message": "FRED macro cache refreshed", "as_of": data.get("as_of")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


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
