#!/usr/bin/env python3
"""
Monthly cron script — auto-download Taiwan Customs HS-8486 data.

Usage (run directly):
    python cron_refresh.py

Scheduled (macOS launchd):
    See com.alterdb.taiwan-customs-refresh.plist in this directory.

The script:
  1. Downloads the latest CSV from portal.sw.nat.gov.tw/APGA/GA30E
  2. Parses it and updates the JSON cache
  3. Logs outcome to server/data/cron.log
"""

import logging
import sys
from pathlib import Path

# ── Logging to file + stdout ──────────────────────────────────────────────────
LOG_PATH = Path(__file__).parent / "data" / "cron.log"
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# ── Ensure server package is importable ──────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

from fetchers.auto_download import download_csv          # noqa: E402
from fetchers.taiwan_customs import parse_csv, save_cache  # noqa: E402
from fetchers.tsmc_revenue import scrape_revenue          # noqa: E402
from fetchers.fabless_inventory import fetch_fabless_inventory  # noqa: E402
from fetchers.comtrade_korea import fetch_korea_equipment_trade  # noqa: E402
from fetchers.comtrade_japan_materials import fetch_japan_korea_materials  # noqa: E402
from fetchers.samsung_patents import refresh_from_xlsx  # noqa: E402
from fetchers.census_intel_oregon import fetch_intel_oregon_equipment  # noqa: E402
from fetchers.usaspending_intel import fetch_intel_federal_funding     # noqa: E402


def main() -> int:
    exit_code = 0

    # ── 1. Taiwan Customs HS-8486 trade data ──────────────────────────────────
    logger.info("=== Taiwan Customs monthly refresh started ===")
    try:
        csv_path = download_csv()
        logger.info("Downloaded: %s", csv_path.name)
        data = parse_csv(csv_path)
        save_cache(data)
        date_range = f"{data[0]['label']} → {data[-1]['label']}" if data else "n/a"
        logger.info("Cached %d months  (%s)", len(data), date_range)
    except Exception as exc:
        logger.error("Taiwan Customs refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 2. TSMC monthly revenue ────────────────────────────────────────────────
    logger.info("=== TSMC revenue refresh started ===")
    try:
        data = scrape_revenue()
        date_range = f"{data[0]['label']} → {data[-1]['label']}" if data else "n/a"
        logger.info("Cached %d months  (%s)", len(data), date_range)
    except Exception as exc:
        logger.error("TSMC revenue refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 3. Fabless Inventory Index (AAPL / NVDA / AMZN via SEC EDGAR) ────────────
    logger.info("=== Fabless Inventory refresh started ===")
    try:
        data = fetch_fabless_inventory(years=4)
        logger.info("Cached %d quarters", len(data))
    except Exception as exc:
        logger.error("Fabless Inventory refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 4. Korea HS-848620 Equipment Inflow (UN Comtrade) ─────────────────────
    logger.info("=== Korea equipment inflow refresh started ===")
    try:
        data = fetch_korea_equipment_trade(months=24)
        logger.info("Cached %d months", len(data))
    except Exception as exc:
        logger.error("Korea equipment refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 5. Japan → Korea materials (UN Comtrade) ──────────────────────────────
    logger.info("=== Japan→Korea materials refresh started ===")
    try:
        data = fetch_japan_korea_materials(months=24)
        logger.info("Cached %d months", len(data))
    except Exception as exc:
        logger.error("Japan materials refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 6. Samsung patent filing trend (PatentsView) ──────────────────────────
    logger.info("=== Samsung patents refresh started ===")
    try:
        data = fetch_samsung_patents(years=5)
        logger.info("Cached %d months", len(data.get("timeseries", [])))
    except Exception as exc:
        logger.error("Samsung patents refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 7. Intel D1X Oregon — Netherlands→OR HS-848620 (US Census statehs) ──────
    logger.info("=== Intel Oregon equipment inflow refresh started ===")
    try:
        data = fetch_intel_oregon_equipment(months=36)
        flagged = sum(1 for r in data if r.get("flagged"))
        logger.info("Cached %d months  (%d flagged as possible EUV delivery)", len(data), flagged)
    except Exception as exc:
        logger.error("Intel Oregon refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    # ── 8. Intel CHIPS Act Federal Funding (USAspending + milestone ledger) ──────
    logger.info("=== Intel CHIPS Act funding refresh started ===")
    try:
        data = fetch_intel_federal_funding()
        logger.info(
            "Cached %d live awards ($%.1fM) + %d CHIPS milestones",
            data["usaspending_count"],
            data["usaspending_total_b"] * 1000,
            len(data["chips_milestones"]),
        )
    except Exception as exc:
        logger.error("Intel CHIPS funding refresh FAILED: %s", exc, exc_info=True)
        exit_code = 1

    logger.info("=== Refresh complete (exit=%d) ===", exit_code)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
