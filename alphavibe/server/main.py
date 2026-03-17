"""
SemiResearch — Alternative Data API  (port 3001)

Endpoints:
  GET  /alt-data/v1/tsmc/equipment-imports        — return parsed time-series
  POST /alt-data/v1/upload/taiwan-equipment-imports — upload CSV from MOF
  GET  /health
"""

import logging
from datetime import datetime
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fetchers.taiwan_customs import CSV_PATH, fetch_equipment_imports, parse_csv, save_cache

load_dotenv()
logging.basicConfig(level=logging.INFO)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SemiResearch Alt-Data API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}

# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
