"""
Intel Federal Funding Tracker — USAspending + CHIPS Act Milestones
===================================================================
Two-layer data architecture:

Layer 1 ─ USAspending.gov API (live, auto-refreshed monthly)
  What's available: Intel Federal LLC DoD R&D contracts, any Intel Corporation grants.
  NOTE: The CHIPS Act Direct Funding Agreements ($7.86B) are a new legal instrument
  (P.L. 117-167) that NIST reports via CHIPS.gov, NOT via USAspending standard award
  types. They will appear here once the reporting pipeline is updated.

Layer 2 ─ CHIPS Act Milestone Ledger (static, manually versioned)
  Public government announcements with committed/signed/disbursed status.
  These are updated when new press releases occur — not real-time API data.

Combined output lets investors track:
  - "Committed":  CHIPS.gov announced awards (largest signal, leading indicator)
  - "Obligated":  Signed/finalized Direct Funding Agreements (confirmed binding)
  - "Disbursed":  Actual outlays as Intel hits capex milestones (lagging, cash-flow impact)

API: https://api.usaspending.gov — free, no key required.

Cached to: server/data/intel_federal_funding.json
"""

import json
import logging
import time
import urllib.request
import urllib.parse
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent.parent / "data"
CACHE_PATH = DATA_DIR / "intel_federal_funding.json"

API_BASE = "https://api.usaspending.gov/api/v2"

# ── Layer 2: Static CHIPS Act milestone ledger ────────────────────────────────
# Source: NIST/DOC press releases, Intel 8-K filings, White House announcements.
# Status values: "announced" | "preliminary" | "signed" | "disbursed"
#
# Update this table when new announcements occur.
CHIPS_MILESTONES = [
    {
        "date":        "2022-08-09",
        "event":       "CHIPS and Science Act Signed",
        "amount_b":    52.7,       # Total CHIPS for America manufacturing incentives authorized
        "recipient":   "Industry-wide",
        "agency":      "NIST / Department of Commerce",
        "status":      "authorized",
        "description": "P.L. 117-167 authorizes $52.7B for US semiconductor manufacturing, "
                       "R&D, and workforce. Intel is the expected largest single beneficiary.",
        "source":      "White House / Congress",
    },
    {
        "date":        "2023-09-21",
        "event":       "Intel CHIPS Act Notice of Funding Opportunity Application",
        "amount_b":    None,
        "recipient":   "Intel Corporation",
        "agency":      "NIST",
        "status":      "application",
        "description": "Intel submits CHIPS for America direct funding application for "
                       "planned fabs in Ohio (New Albany), Arizona (Chandler), Oregon D1X.",
        "source":      "Intel press release",
    },
    {
        "date":        "2024-03-20",
        "event":       "CHIPS Act Preliminary Memorandum of Terms (PMT)",
        "amount_b":    8.5,
        "recipient":   "Intel Corporation",
        "agency":      "NIST / Department of Commerce",
        "status":      "preliminary",
        "description": "DOC announces up to $8.5B in direct funding + up to $11B in CHIPS "
                       "Act loans for Intel. Covers Ohio (2 fabs), Arizona, Oregon D1X R&D. "
                       "PMT is non-binding; triggers due diligence / negotiation phase.",
        "source":      "commerce.gov / chipsinamerica.gov",
    },
    {
        "date":        "2024-11-26",
        "event":       "CHIPS Act Direct Funding Agreement — SIGNED",
        "amount_b":    7.86,
        "recipient":   "Intel Corporation",
        "agency":      "NIST / Department of Commerce",
        "status":      "signed",
        "description": "Intel signs final binding Direct Funding Agreement for $7.86B grant "
                       "across OH / AZ / OR facilities. Reduced from $8.5B PMT; $3B in "
                       "federal loans also confirmed. Disbursements tied to capital milestones. "
                       "Note: Award not yet in USAspending standard search API as of 2026.",
        "source":      "Intel 8-K 2024-11-26 / commerce.gov",
    },
    {
        "date":        "2025-01-01",
        "event":       "Estimated first disbursement tranche (milestone-based)",
        "amount_b":    None,       # Intel has not disclosed exact tranche sizes
        "recipient":   "Intel Corporation",
        "agency":      "NIST / Department of Commerce",
        "status":      "expected",
        "description": "Intel expected to begin receiving grant disbursements as it hits "
                       "capex milestones (fab construction spend, equipment delivery). "
                       "Track via Intel quarterly earnings call commentary on CHIPS receipts.",
        "source":      "Intel investor relations guidance",
    },
]

# ── Layer 1: USAspending API helpers ─────────────────────────────────────────

# Award type groups — must be queried separately (API constraint)
CONTRACT_CODES = ["A", "B", "C", "D"]
GRANT_CODES    = ["02", "03", "04", "05"]

# Intel entities known to hold federal awards
INTEL_RECIPIENTS = [
    "INTEL FEDERAL LLC",
    "INTEL CORPORATION",
    "INTEL GOVERNMENT TECHNOLOGIES",
]

CHIPS_ACT_DATE = "2022-08-09"

CONTRACT_FIELDS = [
    "Award ID", "Recipient Name", "Last Modified Date",
    "Award Amount", "Total Outlays",
    "Funding Agency", "Awarding Sub Agency",
    "Description", "Place of Performance State Code",
]
GRANT_FIELDS = [
    "Award ID", "Recipient Name", "Base Obligation Date",
    "Award Amount", "Total Outlays",
    "Funding Agency", "Awarding Sub Agency",
    "Description", "cfda_program_title", "Award Type",
]


def _post(path: str, payload: dict) -> dict:
    url  = API_BASE + path
    body = json.dumps(payload).encode()
    req  = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _fetch_awards(recipient: str, award_codes: List[str], fields: List[str]) -> List[dict]:
    """Fetch all awards for one recipient and one award-type group."""
    all_results = []
    page = 1

    while True:
        payload = {
            "filters": {
                "recipient_search_text": [recipient],
                "award_type_codes":      award_codes,
                "time_period": [{
                    "start_date": CHIPS_ACT_DATE,
                    "end_date":   date.today().strftime("%Y-%m-%d"),
                }],
            },
            "fields":  fields,
            "sort":    "Award Amount",
            "order":   "desc",
            "limit":   100,
            "page":    page,
        }
        try:
            resp = _post("/search/spending_by_award/", payload)
        except Exception as exc:
            logger.warning("USAspending %s page %d: %s", recipient, page, exc)
            break

        results = resp.get("results", [])
        # Filter strictly for Intel entities
        for r in results:
            name = (r.get("Recipient Name") or "").upper()
            if any(k in name for k in ["INTEL FEDERAL", "INTEL CORPORATION",
                                        "INTEL GOVERNMENT"]):
                all_results.append(r)

        # Pagination
        meta = resp.get("page_metadata", {})
        if not meta.get("hasNext", False):
            break
        page += 1
        time.sleep(0.4)

    return all_results


def _normalise(r: dict, award_category: str) -> dict:
    """Normalise a raw USAspending result into a common schema."""
    date_field = "Last Modified Date" if award_category == "contract" else "Base Obligation Date"
    amount     = r.get("Award Amount") or 0
    outlays    = r.get("Total Outlays") or 0

    return {
        "award_id":       r.get("Award ID") or "",
        "recipient":      r.get("Recipient Name") or "",
        "action_date":    (r.get(date_field) or "")[:10],
        "amount_usd":     round(float(amount), 2),
        "outlays_usd":    round(float(outlays), 2),
        "funding_agency": r.get("Funding Agency") or r.get("Awarding Sub Agency") or "",
        "sub_agency":     r.get("Awarding Sub Agency") or "",
        "award_type":     award_category,
        "cfda":           r.get("cfda_program_title") or "",
        "description":    (r.get("Description") or "")[:200],
        "state":          r.get("Place of Performance State Code") or "",
        "data_source":    "USAspending.gov",
    }


def fetch_intel_usaspending() -> List[dict]:
    """Pull Intel federal contracts + grants from USAspending since CHIPS Act signing."""
    seen: Dict[str, dict] = {}

    for recipient in INTEL_RECIPIENTS:
        # Contracts
        logger.info("Fetching contracts: %s", recipient)
        for r in _fetch_awards(recipient, CONTRACT_CODES, CONTRACT_FIELDS):
            aid = r.get("Award ID", f"c-{len(seen)}")
            seen[aid] = _normalise(r, "contract")
        time.sleep(0.5)

        # Grants
        logger.info("Fetching grants: %s", recipient)
        for r in _fetch_awards(recipient, GRANT_CODES, GRANT_FIELDS):
            aid = r.get("Award ID", f"g-{len(seen)}")
            seen[aid] = _normalise(r, "grant")
        time.sleep(0.5)

    result = sorted(seen.values(), key=lambda r: r["action_date"] or "0", reverse=True)
    return result


def fetch_intel_federal_funding() -> dict:
    """
    Build the combined Intel federal funding dataset:
      - Layer 1: USAspending live API (contracts + grants)
      - Layer 2: CHIPS Act milestone ledger (static, manually versioned)
    """
    logger.info("=== Intel Federal Funding Refresh ===")

    live_awards = fetch_intel_usaspending()

    total_obligated = sum(r["amount_usd"] for r in live_awards)
    total_outlays   = sum(r["outlays_usd"] for r in live_awards if r["outlays_usd"])
    dod_total       = sum(r["amount_usd"] for r in live_awards if "Defense" in r["funding_agency"])
    commerce_total  = sum(r["amount_usd"] for r in live_awards if "Commerce" in r["funding_agency"])

    # CHIPS Act headline figures (from milestone ledger)
    chips_signed  = next((m for m in CHIPS_MILESTONES if m["status"] == "signed"), None)
    chips_amount  = chips_signed["amount_b"] * 1e9 if chips_signed else 0

    output = {
        "as_of":                 datetime.now().strftime("%Y-%m-%d"),
        "chips_act_date":        CHIPS_ACT_DATE,
        # CHIPS Act summary (Layer 2)
        "chips_grant_signed_b":  chips_signed["amount_b"] if chips_signed else None,
        "chips_grant_date":      chips_signed["date"] if chips_signed else None,
        "chips_milestones":      CHIPS_MILESTONES,
        # USAspending live summary (Layer 1)
        "usaspending_count":     len(live_awards),
        "usaspending_total_b":   round(total_obligated / 1e9, 3),
        "usaspending_outlays_b": round(total_outlays / 1e9, 3),
        "dod_total_b":           round(dod_total / 1e9, 3),
        "commerce_total_b":      round(commerce_total / 1e9, 3),
        # Note explaining the data gap
        "api_note": (
            "The $7.86B CHIPS Act Direct Funding Agreement (signed 2024-11-26) is NOT "
            "available via USAspending standard search API — NIST reports these via "
            "CHIPS.gov / a separate pipeline. USAspending awards below reflect DoD R&D "
            "contracts and small grants only. Monitor Intel 10-Q for actual CHIPS receipts."
        ),
        "live_awards": live_awards,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    logger.info(
        "Cached: %d live awards ($%.1fM obligated) + %d CHIPS milestones",
        len(live_awards), total_obligated / 1e6, len(CHIPS_MILESTONES),
    )
    return output


def load_intel_funding() -> Optional[dict]:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else None


def get_intel_funding() -> dict:
    cached = load_intel_funding()
    if cached:
        return cached
    return fetch_intel_federal_funding()


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s  %(message)s")
    try:
        data = fetch_intel_federal_funding()
        print(f"\n{'='*72}")
        print("Intel Federal Funding Tracker")
        print(f"{'='*72}")
        print(f"CHIPS Act grant (signed)  : ${data['chips_grant_signed_b']:.2f}B"
              f"  [{data['chips_grant_date']}]  ← NOT in USAspending API")
        print(f"USAspending live awards   : {data['usaspending_count']} awards  "
              f"${data['usaspending_total_b']*1e3:.1f}M obligated")
        print(f"  DoD R&D contracts       : ${data['dod_total_b']*1e3:.1f}M")
        print(f"  Commerce grants         : ${data['commerce_total_b']*1e3:.1f}M")
        print(f"\nNote: {data['api_note'][:80]}…")
        if data['live_awards']:
            print(f"\n{'Date':<12}  {'Amount':>10}  {'Type':<8}  {'Agency':<30}  Desc")
            print("-" * 80)
            for a in data['live_awards'][:15]:
                amt = f"${a['amount_usd']/1e6:.1f}M"
                print(f"{a['action_date']:<12}  {amt:>10}  {a['award_type']:<8}  "
                      f"{a['funding_agency'][:30]:<30}  {a['description'][:40]}")
        print(f"\nCHIPS Act Milestones:")
        for m in data['chips_milestones']:
            amt = f"${m['amount_b']:.2f}B" if m['amount_b'] else "   TBD"
            print(f"  {m['date']}  {amt}  [{m['status'].upper():<12}]  {m['event']}")
    except Exception as e:
        logger.error("Failed: %s", e)
        sys.exit(1)
