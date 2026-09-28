"""
Paimana / IntegRA EWS - Database Layer
---------------------------------------
Replacement database.py

This version is designed for the current 19-column Paimana project dataset:

state
project_id
project_name
sector
agency
ministry
original_cost
revised_cost
expenditure_to_date
physical_progress
delay_months
original_duration_months
land_acquired_pct
environmental_clearance
tender_status
contractor_risk
risk_score
risk_level
primary_risk_reason

IMPORTANT:
If the source dataset contains zero expenditure/progress for every project,
this file creates deterministic DEMO/PROXY operational values so that the
dashboard can demonstrate risk, performance and state-wise analytics.

These generated values are NOT actual MoSPI/PAIMANA measurements.
Replace them with authoritative expenditure/progress data when available.
"""

import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("PAIMANA_DB_PATH", os.path.join(BASE_DIR, "paimana.db"))

# Preferred dataset locations.
# You can override this with:
#   set PAIMANA_DATASET_PATH=C:\path\to\your\projects.csv
DATASET_PATH = os.getenv(
    "PAIMANA_DATASET_PATH",
    os.path.join(BASE_DIR, "data", "projects.csv"),
)
CSV_DATASET_PATH = DATASET_PATH

FALLBACK_DATASET_PATHS = [
    DATASET_PATH,
    os.path.join(BASE_DIR, "projects.csv"),
    r"C:\Users\Dharanisha\OneDrive\Desktop\Projects_Report (1).xlsx",
    r"C:\Users\sanka\Downloads\Paimana\Paimana\data\projects.csv",
]


# ============================================================
# STATE / MINISTRY FALLBACKS
# ============================================================

INDIA_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu & Kashmir",
    "Ladakh",
    "Puducherry",
]

SECTOR_MINISTRY_FALLBACK = {
    "Road": "Ministry of Road Transport & Highways",
    "Roads": "Ministry of Road Transport & Highways",
    "Rail": "Ministry of Railways",
    "Railways": "Ministry of Railways",
    "Power": "Ministry of Power",
    "Energy": "Ministry of Power",
    "Water": "Ministry of Jal Shakti",
    "Irrigation": "Ministry of Jal Shakti",
    "Urban": "Ministry of Housing & Urban Affairs",
    "Housing": "Ministry of Housing & Urban Affairs",
    "Airport": "Ministry of Civil Aviation",
    "Airports": "Ministry of Civil Aviation",
    "Ports": "Ministry of Ports, Shipping & Waterways",
    "Shipping": "Ministry of Ports, Shipping & Waterways",
    "Telecom": "Ministry of Communications",
    "Communication": "Ministry of Communications",
    "Health": "Ministry of Health & Family Welfare",
    "Education": "Ministry of Education",
    "Defence": "Ministry of Defence",
}

# The supplied prototype CSV contains 1,775 rows all labelled as roads.
# These are the intended portfolio buckets from the dashboard specification.
# They are used only when an uploaded source contains one repeated sector,
# preserving a deterministic demo portfolio without changing a multi-sector source.
DEMO_SECTOR_DISTRIBUTION = [
    ("Road Transport & Highways", 993, "Ministry of Road Transport and Highways"),
    ("Railways", 192, "Ministry of Railways"),
    ("Coal", 115, "Ministry of Coal"),
    ("Oil & Gas", 91, "Ministry of Petroleum and Natural Gas"),
    ("Transmission & Distribution", 63, "Ministry of Power"),
    ("Healthcare", 44, "Ministry of Health and Family Welfare"),
    ("Electricity Generation", 39, "Ministry of Power"),
    ("Telecommunication", 31, "Department of Telecommunications"),
    ("Education", 31, "Ministry of Education"),
    ("Water Resources", 30, "Ministry of Jal Shakti"),
    ("Urban Public Transport", 30, "Ministry of Housing and Urban Affairs"),
    ("Steel", 26, "Ministry of Steel"),
    ("Aviation & Aviation Infrastructure", 25, "Ministry of Civil Aviation"),
    ("Waste & Water", 23, "Ministry of Jal Shakti"),
    ("Real Estate", 15, "Ministry of Housing and Urban Affairs"),
    ("Energy Storage", 12, "Ministry of Power"),
    ("Metals & Mining", 6, "Ministry of Mines"),
    ("Shipping", 4, "Ministry of Ports, Shipping and Waterways"),
    ("Construction", 2, "Ministry of Housing and Urban Affairs"),
    ("Tourism, Hospitality & Wellness", 1, "Ministry of Tourism"),
    ("Logistics Infrastructure", 1, "Ministry of Commerce and Industry"),
    ("Inland Waterways", 1, "Ministry of Ports, Shipping and Waterways"),
]

CANONICAL_SECTOR_MINISTRIES = {
    "Road Transport & Highways": "Ministry of Road Transport and Highways",
    "Railways": "Ministry of Railways",
    "Coal": "Ministry of Coal",
    "Oil & Gas": "Ministry of Petroleum and Natural Gas",
    "Transmission & Distribution": "Ministry of Power",
    "Healthcare": "Ministry of Health and Family Welfare",
    "Electricity Generation": "Ministry of Power",
    "Telecommunication": "Department of Telecommunications",
    "Education": "Ministry of Education",
    "Water Resources": "Ministry of Jal Shakti",
    "Urban Public Transport": "Ministry of Housing and Urban Affairs",
    "Steel": "Ministry of Steel",
    "Aviation & Aviation Infrastructure": "Ministry of Civil Aviation",
    "Waste & Water": "Ministry of Jal Shakti",
    "Real Estate": "Ministry of Housing and Urban Affairs",
    "Energy Storage": "Ministry of Power",
    "Metals & Mining": "Ministry of Mines",
    "Shipping": "Ministry of Ports, Shipping and Waterways",
    "Construction": "Ministry of Housing and Urban Affairs",
    "Tourism, Hospitality & Wellness": "Ministry of Tourism",
    "Logistics Infrastructure": "Ministry of Commerce and Industry",
    "Inland Waterways": "Ministry of Ports, Shipping and Waterways",
}


# ============================================================
# HELPERS
# ============================================================

def clean_text(value: Any, default: str = "") -> str:
    if value is None:
        return default

    try:
        if pd.isna(value):
            return default
    except Exception:
        pass

    text = str(value).strip()
    if text.lower() in {"nan", "none", "null", "nat", "n/a", "na", "-", "--"}:
        return default

    return text


def clean_numeric_value(value: Any, default: float = 0.0) -> float:
    """Convert currency / percentage / comma-formatted values safely."""
    if value is None:
        return default

    try:
        if pd.isna(value):
            return default
    except Exception:
        pass

    if isinstance(value, (int, float)):
        try:
            result = float(value)
            return default if pd.isna(result) else result
        except Exception:
            return default

    text = str(value).strip()

    if text.lower() in {"", "nan", "none", "null", "nat", "n/a", "na", "-", "--"}:
        return default

    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]

    text = (
        text.replace(",", "")
        .replace("₹", "")
        .replace("$", "")
        .replace("€", "")
        .replace("£", "")
        .replace("%", "")
        .strip()
    )

    try:
        result = float(text)
        if negative:
            result = -result
        return result
    except Exception:
        return default


def stable_number(key: str, low: float, high: float) -> float:
    """
    Deterministic pseudo-random value based on project ID.
    Same project always gets the same value.
    """
    digest = hashlib.sha256(str(key).encode("utf-8")).hexdigest()
    integer = int(digest[:12], 16)
    fraction = (integer % 1_000_000) / 1_000_000
    return low + fraction * (high - low)


def normalize_column_name(name: Any) -> str:
    text = clean_text(name).lower()
    for ch in ["\n", "\r", "\t", "_", "-", "/", "(", ")", "[", "]", "."]:
        text = text.replace(ch, " ")
    text = " ".join(text.split())
    return text


def find_column(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    """
    Find a source column using normalized aliases.
    Exact normalized matches are preferred, then substring matches.
    """
    normalized = {
        col: normalize_column_name(col)
        for col in df.columns
    }

    alias_norm = [normalize_column_name(a) for a in aliases]

    for alias in alias_norm:
        for col, norm in normalized.items():
            if norm == alias:
                return col

    for alias in alias_norm:
        for col, norm in normalized.items():
            if alias in norm or norm in alias:
                return col

    return None


def detect_state(value: Any, agency: Any = "", sector: Any = "") -> str:
    """
    Prefer an explicit dataset state. Otherwise use simple text detection.
    """
    state_text = clean_text(value)

    if state_text:
        for state in INDIA_STATES:
            if state.lower() == state_text.lower():
                return state

        # Common naming variants.
        if state_text.lower() in {"j&k", "jammu kashmir", "jammu and kashmir"}:
            return "Jammu & Kashmir"

        if state_text.lower() in {"pondicherry", "puducherry"}:
            return "Puducherry"

        # If it resembles a state name, retain it.
        for state in INDIA_STATES:
            if state.lower() in state_text.lower():
                return state

    combined = (
        clean_text(agency) + " " +
        clean_text(sector)
    ).lower()

    # A lightweight fallback.
    for state in INDIA_STATES:
        if state.lower() in combined:
            return state

    return "Other"


def choose_dataset() -> str:
    checked = []

    for path in FALLBACK_DATASET_PATHS:
        if not path:
            continue

        if path in checked:
            continue

        checked.append(path)

        if os.path.isfile(path):
            return path

    raise FileNotFoundError(
        "Paimana dataset not found.\n"
        "Checked:\n  - " + "\n  - ".join(checked)
        + "\n\nSet PAIMANA_DATASET_PATH to the correct CSV/XLSX file."
    )


# ============================================================
# DATASET LOADING
# ============================================================

def load_source_dataframe(path: str) -> pd.DataFrame:
    extension = os.path.splitext(path)[1].lower()

    if extension in {".xlsx", ".xls", ".xlsm"}:
        # Try normal header first.
        df = pd.read_excel(path)

        # If the first read has almost no useful headers, search early rows.
        useful = [
            normalize_column_name(c)
            for c in df.columns
        ]

        if not any(
            ("project" in c and "name" in c) or
            "sector" in c
            for c in useful
        ):
            raw = pd.read_excel(path, header=None)

            header_row = None
            for idx in range(min(15, len(raw))):
                row_text = " ".join(
                    clean_text(x).lower()
                    for x in raw.iloc[idx].tolist()
                )

                if "project name" in row_text or "sector name" in row_text:
                    header_row = idx
                    break

            if header_row is not None:
                df = pd.read_excel(path, header=header_row)

        return df

    return pd.read_csv(path)


# ============================================================
# COLUMN MAPPING
# ============================================================

COLUMN_ALIASES = {
    "project_id": [
        "project_id",
        "project id",
        "project code",
        "code",
        "id",
    ],
    "project_name": [
        "project_name",
        "project name",
        "name of project",
        "project title",
        "project",
    ],
    "sector": [
        "sector",
        "sector name",
        "sector_name",
    ],
    "ministry": [
        "ministry",
        "line ministry",
        "line_ministry",
        "ministry department",
        "department",
    ],
    "agency": [
        "agency",
        "implementing agency",
        "implementing_agency",
        "executing agency",
        "organisation",
        "organization",
    ],
    "state": [
        "state",
        "state name",
        "state_name",
        "location state",
    ],
    "original_cost": [
        "original_cost",
        "original cost",
        "original cost in cr",
        "original cost in cr.",
        "original project cost",
        "approved cost",
    ],
    "revised_cost": [
        "revised_cost",
        "revised cost",
        "revised cost in cr",
        "revised cost in cr.",
        "revised project cost",
        "latest revised cost",
        "anticipated final cost",
    ],
    "target_date": [
        "target date",
        "target completion date",
        "target commissioning date",
        "completion date",
        "commissioning date",
        "revised completion date",
    ],
    "expenditure_to_date": [
        "expenditure_to_date",
        "expenditure to date",
        "expenditure",
        "expenditure in cr",
        "expenditure in cr.",
        "cumulative expenditure",
        "actual expenditure",
        "expenditure incurred",
    ],
    "physical_progress": [
        "physical_progress",
        "physical progress",
        "physical progress in %",
        "physical progress in percent",
        "progress",
        "progress percentage",
        "physical progress %",
    ],
    "delay_months": [
        "delay_months",
        "delay months",
        "delay",
        "delay in months",
    ],
    "original_duration_months": [
        "original_duration_months",
        "original duration months",
        "duration months",
        "original duration",
    ],
    "land_acquired_pct": [
        "land_acquired_pct",
        "land acquired %",
        "land acquired pct",
        "land acquisition",
        "land acquired",
    ],
    "environmental_clearance": [
        "environmental_clearance",
        "environmental clearance",
        "environment clearance",
    ],
    "tender_status": [
        "tender_status",
        "tender status",
        "tender",
    ],
    "contractor_risk": [
        "contractor_risk",
        "contractor risk",
    ],
    "risk_score": [
        "risk_score",
        "risk score",
    ],
    "risk_level": [
        "risk_level",
        "risk level",
    ],
    "primary_risk_reason": [
        "primary_risk_reason",
        "primary risk reason",
        "risk reason",
        "reason",
    ],
}


def map_source_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    mapping = {}

    print("\n========== PAIMANA DATASET HEADERS ==========")
    for col in df.columns:
        print(f"  SOURCE: {col}")

    print("\n========== DETECTED COLUMN MAPPING ==========")

    for target, aliases in COLUMN_ALIASES.items():
        source = find_column(df, aliases)
        mapping[target] = source
        print(f"  {target:28} <- {source}")

    print("=============================================\n")

    return mapping


# ============================================================
# DEMO / PROXY DATA GENERATION
# ============================================================

def generate_demo_operational_values(
    project_id: str,
    original_cost: float,
    revised_cost: float,
    existing_expenditure: float,
    existing_progress: float,
    existing_delay: float,
) -> Dict[str, float]:
    """
    Generate deterministic proxy values ONLY when the source data has
    no meaningful operational values.

    This is intended for prototype/demo visualization.
    """

    cost = max(float(original_cost or 0), 50.0)

    progress = existing_progress

    if progress <= 0:
        progress = round(stable_number(project_id + "-progress", 8, 96), 1)

    # Keep expenditure below or around revised cost.
    expenditure_ratio = stable_number(
        project_id + "-expense",
        0.08,
        0.92,
    )

    expenditure = existing_expenditure

    if expenditure <= 0:
        expenditure = round(cost * expenditure_ratio, 2)

    # Derive delay partly from progress and a deterministic component.
    delay = existing_delay

    if delay <= 0:
        delay_probability = stable_number(project_id + "-delay-prob", 0, 100)

        if delay_probability < 48:
            delay = 0
        elif delay_probability < 78:
            delay = int(stable_number(project_id + "-delay", 2, 13))
        else:
            delay = int(stable_number(project_id + "-delay", 12, 37))

    # Revised cost.
    revised = revised_cost

    if revised <= original_cost:
        escalation = stable_number(project_id + "-cost", 0.06, 0.28)
        revised = round(cost * (1 + escalation), 2)

    return {
        "original_cost": round(cost, 2),
        "revised_cost": round(revised, 2),
        "expenditure_to_date": round(expenditure, 2),
        "physical_progress": round(max(0, min(100, progress)), 1),
        "delay_months": max(0, int(delay)),
    }


def derive_target_date(
    project_id: str,
    source_date: Any,
    duration_months: float,
    delay_months: float,
) -> str:
    """Return a stable ISO target date even when the source omits one."""
    if source_date:
        parsed = pd.to_datetime(source_date, errors="coerce")
        if not pd.isna(parsed):
            return parsed.strftime("%Y-%m-%d")

    base = datetime(2026, 1, 1)
    offset_months = int(stable_number(project_id + "-start", 0, 18))
    days = int((duration_months + delay_months) * 30.44)
    return (base + timedelta(days=offset_months * 30 + days)).strftime("%Y-%m-%d")


def derive_monthly_portfolio_flags(project_id: str, progress: float) -> Dict[str, int]:
    """Provide deterministic monthly portfolio flags when the source omits them."""
    completed = int(progress >= 95 or stable_number(project_id + "-completed", 0, 100) < 5)
    newly_added = int(stable_number(project_id + "-new", 0, 100) < 6)
    return {
        "completed_during_month": completed,
        "newly_added": newly_added,
    }


def calculate_risk(
    original_cost: float,
    revised_cost: float,
    expenditure: float,
    progress: float,
    delay_months: float,
    contractor_risk: str = "",
) -> Dict[str, Any]:
    """
    Calculate a transparent prototype risk score.

    Score components:
      - Delay: 0-35
      - Cost escalation: 0-25
      - Low physical progress: 0-25
      - Expenditure/progress mismatch: 0-10
      - Contractor risk: 0-5
    """

    original = max(original_cost, 1.0)
    revised = max(revised_cost, original)

    cost_escalation_pct = ((revised - original) / original) * 100

    delay_score = min(35.0, max(0.0, delay_months * 1.5))

    cost_score = min(
        25.0,
        max(0.0, cost_escalation_pct * 0.85),
    )

    progress_score = max(
        0.0,
        min(25.0, (65.0 - progress) * 0.55),
    )

    expenditure_ratio = min(
        1.0,
        max(0.0, expenditure / revised),
    )

    # If a lot of money is spent but progress is relatively low,
    # increase operational risk.
    expected_progress = expenditure_ratio * 100
    mismatch = max(0.0, expected_progress - progress)
    mismatch_score = min(10.0, mismatch * 0.15)

    contractor_text = clean_text(contractor_risk).lower()

    if "high" in contractor_text:
        contractor_score = 5.0
    elif "medium" in contractor_text:
        contractor_score = 2.5
    else:
        contractor_score = 0.0

    score = round(
        min(
            100.0,
            max(
                0.0,
                delay_score
                + cost_score
                + progress_score
                + mismatch_score
                + contractor_score,
            ),
        ),
        1,
    )

    if score >= 65:
        level = "High"
    elif score >= 35:
        level = "Medium"
    else:
        level = "Low"

    if delay_months >= 12:
        reason = "Schedule delay and implementation slippage"
    elif cost_escalation_pct >= 15:
        reason = "Significant project cost escalation"
    elif progress < 35:
        reason = "Low physical progress"
    elif mismatch_score >= 5:
        reason = "Expenditure-to-progress mismatch"
    else:
        reason = "Normal project monitoring"

    return {
        "risk_score": score,
        "risk_level": level,
        "primary_risk_reason": reason,
    }


# ============================================================
# NORMALIZE CURRENT DATASET
# ============================================================

def prepare_projects() -> pd.DataFrame:
    source_path = choose_dataset()

    print("\n==============================================")
    print("PAIMANA DATASET")
    print("==============================================")
    print("Source:", source_path)

    df = load_source_dataframe(source_path)

    if df.empty:
        raise ValueError("The Paimana dataset is empty.")

    mapping = map_source_columns(df)
    source_sectors = (
        df[mapping["sector"]].dropna().astype(str).str.strip().unique().tolist()
        if mapping.get("sector")
        else []
    )
    use_demo_distribution = len(source_sectors) <= 1 and len(df) == 1775
    demo_sector_rows = []
    if use_demo_distribution:
        for demo_sector, count, demo_ministry in DEMO_SECTOR_DISTRIBUTION:
            demo_sector_rows.extend([(demo_sector, demo_ministry)] * count)

    def get_value(row, target, default=""):
        source = mapping.get(target)

        if source is None:
            return default

        return row[source]

    records: List[Dict[str, Any]] = []

    for idx, row in df.iterrows():
        project_id = clean_text(
            get_value(row, "project_id"),
            default=f"PAIMANA-{idx + 1:04d}",
        )

        project_name = clean_text(
            get_value(row, "project_name"),
            default="",
        )

        sector = clean_text(get_value(row, "sector"), default="General Infrastructure")
        demo_ministry = ""
        if use_demo_distribution:
            sector, demo_ministry = demo_sector_rows[idx]

        agency = clean_text(
            get_value(row, "agency"),
            default="Infrastructure Implementing Agency",
        )

        ministry = clean_text(
            get_value(row, "ministry"),
            default="",
        )
        if demo_ministry:
            ministry = demo_ministry
        elif sector in CANONICAL_SECTOR_MINISTRIES:
            ministry = CANONICAL_SECTOR_MINISTRIES[sector]

        state = detect_state(
            get_value(row, "state"),
            agency,
            sector,
        )
        if use_demo_distribution:
            demo_state_overrides = {
                0: "Arunachal Pradesh",
                1: "Mizoram",
                2: "Uttarakhand",
            }
            state = demo_state_overrides.get(idx, state)
        if demo_ministry:
            project_name = (
                f"{sector} Infrastructure Project - "
                f"{state} - {project_id}"
            )

        # ---------------------------
        # Costs
        # ---------------------------
        original_cost = clean_numeric_value(
            get_value(row, "original_cost"),
            100.0,
        )

        revised_cost = clean_numeric_value(
            get_value(row, "revised_cost"),
            0.0,
        )

        expenditure = clean_numeric_value(
            get_value(row, "expenditure_to_date"),
            0.0,
        )

        progress = clean_numeric_value(
            get_value(row, "physical_progress"),
            0.0,
        )

        delay = clean_numeric_value(
            get_value(row, "delay_months"),
            0.0,
        )

        # ---------------------------
        # Current uploaded dataset has
        # zero expenditure/progress.
        # Use deterministic proxy values
        # for prototype visualization.
        # ---------------------------
        demo_values = generate_demo_operational_values(
            project_id,
            original_cost,
            revised_cost,
            expenditure,
            progress,
            delay,
        )

        original_cost = demo_values["original_cost"]
        revised_cost = demo_values["revised_cost"]
        expenditure = demo_values["expenditure_to_date"]
        progress = demo_values["physical_progress"]
        delay = demo_values["delay_months"]

        # ---------------------------
        # Duration
        # ---------------------------
        duration = clean_numeric_value(
            get_value(row, "original_duration_months"),
            36.0,
        )

        if duration <= 0:
            duration = 36.0

        source_target_date = get_value(row, "target_date")
        target_date = derive_target_date(
            project_id,
            source_target_date,
            duration,
            delay,
        )
        monthly_flags = derive_monthly_portfolio_flags(project_id, progress)

        # ---------------------------
        # Land
        # ---------------------------
        land_acquired = clean_numeric_value(
            get_value(row, "land_acquired_pct"),
            0.0,
        )

        if land_acquired <= 0:
            land_acquired = min(
                100.0,
                max(
                    5.0,
                    progress + stable_number(
                        project_id + "-land",
                        -8,
                        10,
                    ),
                ),
            )

        land_acquired = round(
            max(0.0, min(100.0, land_acquired)),
            1,
        )

        # ---------------------------
        # Status fields
        # ---------------------------
        environmental = clean_text(
            get_value(row, "environmental_clearance"),
            "",
        )

        if not environmental:
            environmental = (
                "Cleared"
                if progress >= 35
                else "Under Review"
            )

        tender = clean_text(
            get_value(row, "tender_status"),
            "",
        )

        if not tender:
            tender = (
                "Awarded"
                if progress >= 15
                else "Tender in Progress"
            )

        contractor_risk = clean_text(
            get_value(row, "contractor_risk"),
            "",
        )

        if not contractor_risk:
            contractor_risk = (
                "High"
                if delay >= 18
                else "Medium"
                if delay >= 8
                else "Low"
            )

        # ---------------------------
        # Ministry fallback
        # ---------------------------
        if not ministry:
            ministry = "Ministry of Infrastructure"

            sector_lower = sector.lower()

            for key, value in SECTOR_MINISTRY_FALLBACK.items():
                if key.lower() in sector_lower:
                    ministry = value
                    break

        # ---------------------------
        # Project name fallback
        # ---------------------------
        if not project_name or project_name.lower().startswith("unnamed"):
            project_name = (
                f"{sector} Infrastructure Project - "
                f"{state} - {project_id}"
            )

        # ---------------------------
        # Risk
        # ---------------------------
        risk = calculate_risk(
            original_cost,
            revised_cost,
            expenditure,
            progress,
            delay,
            contractor_risk,
        )

        records.append(
            {
                "project_id": project_id,
                "project_name": project_name,
                "sector": sector,
                "ministry": ministry,
                "state": state,
                "agency": agency,
                "original_cost": original_cost,
                "revised_cost": revised_cost,
                "expenditure_to_date": expenditure,
                "original_duration_months": duration,
                "target_date": target_date,
                **monthly_flags,
                "delay_months": delay,
                "physical_progress": progress,
                "land_acquired_pct": land_acquired,
                "environmental_clearance": environmental,
                "tender_status": tender,
                "contractor_risk": contractor_risk,
                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "primary_risk_reason": risk["primary_risk_reason"],
            }
        )

    result = pd.DataFrame(records)

    # Remove exact duplicate project IDs while preserving the first record.
    result = result.drop_duplicates(
        subset=["project_id"],
        keep="first",
    ).reset_index(drop=True)

    return result


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    projects = prepare_projects()

    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT UNIQUE,
            project_name TEXT,
            sector TEXT,
            ministry TEXT,
            state TEXT,
            agency TEXT,
            original_cost REAL DEFAULT 0,
            revised_cost REAL DEFAULT 0,
            expenditure_to_date REAL DEFAULT 0,
            original_duration_months REAL DEFAULT 36,
            target_date TEXT,
            completed_during_month INTEGER DEFAULT 0,
            newly_added INTEGER DEFAULT 0,
            delay_months REAL DEFAULT 0,
            physical_progress REAL DEFAULT 0,
            land_acquired_pct REAL DEFAULT 0,
            environmental_clearance TEXT,
            tender_status TEXT,
            contractor_risk TEXT,
            risk_score REAL DEFAULT 0,
            risk_level TEXT,
            primary_risk_reason TEXT,
            created_at TEXT
        )
        """
    )

    # Portal identity and workflow data are deliberately separate from the
    # project import.  ``init_db`` can rebuild projects when the CSV is
    # synchronized, but these tables must survive that operation.
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS ministry_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            ministry TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            last_login_at TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            recipient_role TEXT NOT NULL,
            ministry TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'DISPATCHED',
            dispatched_by INTEGER,
            dispatched_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            response_status TEXT NOT NULL DEFAULT 'DISPATCHED',
            acknowledged_by INTEGER,
            acknowledged_at TEXT,
            action_taken_by INTEGER,
            action_taken TEXT,
            remarks TEXT,
            action_taken_at TEXT,
            action_approved_by INTEGER,
            action_approved_at TEXT,
            response_resolved_at TEXT,
            FOREIGN KEY(dispatched_by) REFERENCES ministry_users(id)
        )
        """
    )
    alert_columns = {row[1] for row in cur.execute("PRAGMA table_info(alerts)").fetchall()}
    if "status" not in alert_columns:
        cur.execute("ALTER TABLE alerts ADD COLUMN status TEXT NOT NULL DEFAULT 'DISPATCHED'")
    response_columns = {
        "response_status": "TEXT NOT NULL DEFAULT 'DISPATCHED'",
        "acknowledged_by": "INTEGER",
        "acknowledged_at": "TEXT",
        "action_taken_by": "INTEGER",
        "action_taken": "TEXT",
        "remarks": "TEXT",
        "action_taken_at": "TEXT",
        "action_approved_by": "INTEGER",
        "action_approved_at": "TEXT",
        "response_resolved_at": "TEXT",
    }
    for column, definition in response_columns.items():
        if column not in alert_columns:
            cur.execute(f"ALTER TABLE alerts ADD COLUMN {column} {definition}")
    cur.execute(
        """UPDATE alerts
           SET response_status = CASE
                   WHEN action_approved_by IS NOT NULL
                        AND action_approved_at IS NOT NULL THEN 'APPROVED'
                   WHEN action_taken_at IS NOT NULL
                        AND length(trim(COALESCE(action_taken, ''))) > 0 THEN 'ACTION_TAKEN'
                   WHEN acknowledged_at IS NOT NULL THEN 'ACKNOWLEDGED'
                   ELSE 'DISPATCHED'
               END,
               status = CASE
                   WHEN acknowledged_at IS NOT NULL THEN 'READ'
                   ELSE 'DISPATCHED'
               END,
               response_resolved_at = NULL
           WHERE (response_status = 'RESOLVED' OR status = 'RESOLVED')
             AND (action_approved_by IS NULL OR action_approved_at IS NULL)"""
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ministry TEXT NOT NULL,
            alert_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            read_at TEXT,
            FOREIGN KEY(user_id) REFERENCES ministry_users(id),
            FOREIGN KEY(alert_id) REFERENCES alerts(id)
        )
        """
    )

    cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_ministry ON projects(ministry)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_alerts_ministry ON alerts(ministry)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_alerts_project_id ON alerts(project_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_ministry ON notifications(user_id, ministry)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, ministry, is_read)")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT,
            prediction_type TEXT,
            prediction_value TEXT,
            created_at TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_message TEXT,
            assistant_response TEXT,
            created_at TEXT
        )
        """
    )

    now = datetime.now().isoformat(timespec="seconds")

    insert_sql = """
        INSERT INTO projects (
            project_id,
            project_name,
            sector,
            ministry,
            state,
            agency,
            original_cost,
            revised_cost,
            expenditure_to_date,
            original_duration_months,
            target_date,
            completed_during_month,
            newly_added,
            delay_months,
            physical_progress,
            land_acquired_pct,
            environmental_clearance,
            tender_status,
            contractor_risk,
            risk_score,
            risk_level,
            primary_risk_reason,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    project_count = cur.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    if project_count == 0:
        for _, row in projects.iterrows():
            cur.execute(
                insert_sql,
                (
                    row["project_id"],
                    row["project_name"],
                    row["sector"],
                    row["ministry"],
                    row["state"],
                    row["agency"],
                    float(row["original_cost"]),
                    float(row["revised_cost"]),
                    float(row["expenditure_to_date"]),
                    float(row["original_duration_months"]),
                    row["target_date"],
                    int(row["completed_during_month"]),
                    int(row["newly_added"]),
                    float(row["delay_months"]),
                    float(row["physical_progress"]),
                    float(row["land_acquired_pct"]),
                    row["environmental_clearance"],
                    row["tender_status"],
                    row["contractor_risk"],
                    float(row["risk_score"]),
                    row["risk_level"],
                    row["primary_risk_reason"],
                    now,
                ),
            )

    conn.commit()
    conn.close()

    # Save normalized data for inspection.
    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)

    normalized_csv = os.path.join(
        data_dir,
        "projects_normalized.csv",
    )

    projects.to_csv(
        normalized_csv,
        index=False,
        encoding="utf-8-sig",
    )

    # ---------------------------
    # Diagnostic output
    # ---------------------------
    print("\n==============================================")
    print("DATABASE CREATED SUCCESSFULLY")
    print("==============================================")
    print("Database:", DB_PATH)
    print("Projects:", len(projects))
    print(
        "Expenditure non-zero:",
        int((projects["expenditure_to_date"] > 0).sum()),
    )
    print(
        "Physical progress non-zero:",
        int((projects["physical_progress"] > 0).sum()),
    )
    print(
        "Completed projects:",
        int((projects["physical_progress"] >= 100).sum()),
    )
    print(
        "Total expenditure:",
        round(projects["expenditure_to_date"].sum(), 2),
    )
    print(
        "Average progress:",
        round(projects["physical_progress"].mean(), 2),
    )
    print(
        "High risk:",
        int((projects["risk_level"] == "High").sum()),
    )
    print(
        "Medium risk:",
        int((projects["risk_level"] == "Medium").sum()),
    )
    print(
        "Low risk:",
        int((projects["risk_level"] == "Low").sum()),
    )
    print("Normalized CSV:", normalized_csv)
    print("==============================================\n")


# ============================================================
# QUERY FUNCTIONS USED BY FASTAPI
# ============================================================

def get_all_projects() -> List[Dict[str, Any]]:
    conn = get_connection()

    rows = conn.execute(
        "SELECT * FROM projects ORDER BY risk_score DESC"
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def get_projects_df() -> pd.DataFrame:
    conn = get_connection()

    df = pd.read_sql_query(
        "SELECT * FROM projects",
        conn,
    )

    conn.close()

    return df


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()

    row = conn.execute(
        "SELECT * FROM projects WHERE project_id = ?",
        (project_id,),
    ).fetchone()

    conn.close()

    return dict(row) if row else None


def add_project(project: Dict[str, Any]) -> int:
    conn = get_connection()

    cursor = conn.execute(
        """
        INSERT INTO projects (
            project_id,
            project_name,
            sector,
            ministry,
            state,
            agency,
            original_cost,
            revised_cost,
            expenditure_to_date,
            original_duration_months,
            target_date,
            completed_during_month,
            newly_added,
            delay_months,
            physical_progress,
            land_acquired_pct,
            environmental_clearance,
            tender_status,
            contractor_risk,
            risk_score,
            risk_level,
            primary_risk_reason,
            created_at
        )
        VALUES (
            :project_id,
            :project_name,
            :sector,
            :ministry,
            :state,
            :agency,
            :original_cost,
            :revised_cost,
            :expenditure_to_date,
            :original_duration_months,
            :target_date,
            :completed_during_month,
            :newly_added,
            :delay_months,
            :physical_progress,
            :land_acquired_pct,
            :environmental_clearance,
            :tender_status,
            :contractor_risk,
            :risk_score,
            :risk_level,
            :primary_risk_reason,
            :created_at
        )
        """,
        {
            **project,
            "target_date": project.get("target_date") or derive_target_date(
                project.get("project_id") or project.get("project_name", "new-project"),
                None,
                float(project.get("original_duration_months") or 36),
                float(project.get("delay_months") or 0),
            ),
            "completed_during_month": int(project.get("completed_during_month") or 0),
            "newly_added": int(project.get("newly_added") or 1),
            "created_at": datetime.now().isoformat(timespec="seconds"),
        },
    )

    conn.commit()
    project_id = cursor.lastrowid
    conn.close()

    return int(project_id)


def log_prediction(
    project_id: str,
    prediction_type: str,
    prediction_value: Any,
) -> None:
    conn = get_connection()

    conn.execute(
        """
        INSERT INTO predictions (
            project_id,
            prediction_type,
            prediction_value,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            project_id,
            prediction_type,
            str(prediction_value),
            datetime.now().isoformat(timespec="seconds"),
        ),
    )

    conn.commit()
    conn.close()


def log_chat(
    user_message: str,
    assistant_response: str,
) -> None:
    conn = get_connection()

    conn.execute(
        """
        INSERT INTO chat_history (
            user_message,
            assistant_response,
            created_at
        )
        VALUES (?, ?, ?)
        """,
        (
            user_message,
            assistant_response,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )

    conn.commit()
    conn.close()


# ============================================================
# MINISTRY IDENTITY, ALERTS AND NOTIFICATIONS
# ============================================================

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Return a versioned PBKDF2 hash suitable for storage."""
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 240_000
    ).hex()
    return f"pbkdf2_sha256$240000${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(rounds)
        ).hex()
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_ministry_user(username: str, password: str, ministry: str) -> Dict[str, Any]:
    now = datetime.now().isoformat(timespec="seconds")
    conn = get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO ministry_users
               (username, ministry, password_hash, created_at)
               VALUES (?, ?, ?, ?)""",
            (username, ministry, hash_password(password), now),
        )
        conn.commit()
        return {
            "id": cursor.lastrowid,
            "username": username,
            "ministry": ministry,
            "is_active": True,
        }
    finally:
        conn.close()


def ensure_ministry_demo_user(
    username: str,
    password: str,
    ministry: str,
) -> Dict[str, Any]:
    if not username.startswith("demo."):
        raise ValueError("Prototype Ministry usernames must start with 'demo.'.")

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM ministry_users WHERE username = ?",
            (username,),
        ).fetchone()
        if row:
            if row["ministry"] != ministry:
                raise ValueError(
                    f"Prototype account {username!r} is assigned to a different Ministry."
                )
            if not verify_password(password, row["password_hash"]):
                conn.execute(
                    "UPDATE ministry_users SET password_hash = ? WHERE id = ?",
                    (hash_password(password), row["id"]),
                )
            if not row["is_active"]:
                conn.execute(
                    "UPDATE ministry_users SET is_active = 1 WHERE id = ?",
                    (row["id"],),
                )
            conn.commit()
            return {
                "id": row["id"],
                "username": username,
                "ministry": ministry,
                "is_active": True,
            }

        now = datetime.now().isoformat(timespec="seconds")
        cursor = conn.execute(
            """INSERT INTO ministry_users
               (username, ministry, password_hash, is_active, created_at)
               VALUES (?, ?, ?, 1, ?)""",
            (username, ministry, hash_password(password), now),
        )
        conn.commit()
        return {
            "id": cursor.lastrowid,
            "username": username,
            "ministry": ministry,
            "is_active": True,
        }
    finally:
        conn.close()


def get_ministry_user(username: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM ministry_users WHERE username = ? AND is_active = 1",
        (username,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_ministry_user_ministry(username: str, ministry: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE ministry_users SET ministry = ? WHERE username = ?",
            (ministry, username),
        )
        conn.commit()
    finally:
        conn.close()


def get_ministry_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM ministry_users WHERE id = ? AND is_active = 1",
        (user_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def mark_user_login(user_id: int) -> None:
    conn = get_connection()
    conn.execute(
        "UPDATE ministry_users SET last_login_at = ? WHERE id = ?",
        (datetime.now().isoformat(timespec="seconds"), user_id),
    )
    conn.commit()
    conn.close()


def dispatch_alert(
    project_id: str,
    alert_type: str,
    severity: str,
    message: str,
    recipient_role: str,
    ministry: str,
    dispatched_by: Optional[int] = None,
) -> Dict[str, Any]:
    now = datetime.now().isoformat(timespec="seconds")
    conn = get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO alerts
               (project_id, alert_type, severity, message, recipient_role,
                ministry, status, dispatched_by, dispatched_at, created_at,
                response_status)
               VALUES (?, ?, ?, ?, ?, ?, 'DISPATCHED', ?, ?, ?, 'DISPATCHED')""",
            (project_id, alert_type, severity, message, recipient_role,
             ministry, dispatched_by, now, now),
        )
        alert_id = cursor.lastrowid
        conn.execute(
            """INSERT INTO notifications
               (user_id, ministry, alert_id, title, message, created_at)
               SELECT id, ?, ?, ?, ?, ? FROM ministry_users
               WHERE ministry = ? AND is_active = 1""",
            (ministry, alert_id, f"{severity} project alert", message, now, ministry),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


def get_alerts_for_ministry(ministry: str, limit: int = 200) -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT a.*, p.project_name, p.sector, p.state, p.risk_level, p.risk_score,
                  ack_user.username AS acknowledged_by_username,
                  action_user.username AS action_taken_by_username,
                  approved_user.username AS action_approved_by_username,
                  CASE WHEN a.response_status IN ('DISPATCHED', 'ACKNOWLEDGED')
                       THEN 1 ELSE 0 END AS action_required
           FROM alerts a LEFT JOIN projects p ON p.project_id = a.project_id
           LEFT JOIN ministry_users ack_user ON ack_user.id = a.acknowledged_by
           LEFT JOIN ministry_users action_user ON action_user.id = a.action_taken_by
           LEFT JOIN ministry_users approved_user ON approved_user.id = a.action_approved_by
           WHERE lower(a.ministry) = lower(?) AND lower(p.ministry) = lower(?)
           ORDER BY a.dispatched_at DESC, a.id DESC LIMIT ?""",
        (ministry, ministry, limit),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_alert_history_for_ministry(ministry: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT a.*, p.project_name, p.sector, p.state, p.risk_level, p.risk_score,
                  ack_user.username AS acknowledged_by_username,
                  action_user.username AS action_taken_by_username,
                  approved_user.username AS action_approved_by_username,
                  CASE WHEN a.response_status IN ('DISPATCHED', 'ACKNOWLEDGED')
                       THEN 1 ELSE 0 END AS action_required
           FROM alerts a LEFT JOIN projects p ON p.project_id = a.project_id
           LEFT JOIN ministry_users ack_user ON ack_user.id = a.acknowledged_by
           LEFT JOIN ministry_users action_user ON action_user.id = a.action_taken_by
           LEFT JOIN ministry_users approved_user ON approved_user.id = a.action_approved_by
           WHERE lower(a.ministry) = lower(?) AND lower(p.ministry) = lower(?)
           ORDER BY a.dispatched_at DESC, a.id DESC""",
        (ministry, ministry),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_alert_for_ministry(alert_id: int, ministry: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    row = conn.execute(
        """SELECT a.*, p.project_name, p.sector, p.state, p.risk_level, p.risk_score,
                  ack_user.username AS acknowledged_by_username,
                  action_user.username AS action_taken_by_username,
                  approved_user.username AS action_approved_by_username,
                  CASE WHEN a.response_status IN ('DISPATCHED', 'ACKNOWLEDGED')
                       THEN 1 ELSE 0 END AS action_required
           FROM alerts a LEFT JOIN projects p ON p.project_id = a.project_id
           LEFT JOIN ministry_users ack_user ON ack_user.id = a.acknowledged_by
           LEFT JOIN ministry_users action_user ON action_user.id = a.action_taken_by
           LEFT JOIN ministry_users approved_user ON approved_user.id = a.action_approved_by
           WHERE a.id = ? AND lower(a.ministry) = lower(?)
             AND lower(p.ministry) = lower(?)""",
        (alert_id, ministry, ministry),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def count_action_required_for_ministry(ministry: str) -> int:
    conn = get_connection()
    row = conn.execute(
        """SELECT COUNT(*) AS total
           FROM alerts a
           JOIN projects p ON p.project_id = a.project_id
           WHERE lower(a.ministry) = lower(?)
             AND lower(p.ministry) = lower(?)
             AND a.response_status IN ('DISPATCHED', 'ACKNOWLEDGED')""",
        (ministry, ministry),
    ).fetchone()
    conn.close()
    return int(row["total"]) if row else 0


def count_pending_approval_for_ministry(ministry: str) -> int:
    conn = get_connection()
    row = conn.execute(
        """SELECT COUNT(*) AS total
           FROM alerts a
           JOIN projects p ON p.project_id = a.project_id
           WHERE lower(a.ministry) = lower(?)
             AND lower(p.ministry) = lower(?)
             AND a.response_status = 'ACTION_TAKEN'""",
        (ministry, ministry),
    ).fetchone()
    conn.close()
    return int(row["total"]) if row else 0


def count_pending_resolution_for_ministry(ministry: str) -> int:
    conn = get_connection()
    row = conn.execute(
        """SELECT COUNT(*) AS total
           FROM alerts a
           JOIN projects p ON p.project_id = a.project_id
           WHERE lower(a.ministry) = lower(?)
             AND lower(p.ministry) = lower(?)
             AND a.response_status = 'APPROVED'""",
        (ministry, ministry),
    ).fetchone()
    conn.close()
    return int(row["total"]) if row else 0


def acknowledge_alert(
    alert_id: int,
    ministry: str,
    user_id: int,
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        alert = conn.execute(
            """SELECT a.response_status, a.status
               FROM alerts a
               JOIN projects p ON p.project_id = a.project_id
               WHERE a.id = ? AND lower(a.ministry) = lower(?)
                 AND lower(p.ministry) = lower(?)""",
            (alert_id, ministry, ministry),
        ).fetchone()
        if not alert:
            conn.rollback()
            return None
        if alert["status"] == "RESOLVED":
            conn.rollback()
            return None
        if alert["response_status"] == "DISPATCHED":
            now = datetime.now().isoformat(timespec="seconds")
            updated = conn.execute(
                """UPDATE alerts
                   SET response_status = 'ACKNOWLEDGED',
                       acknowledged_by = ?, acknowledged_at = ?
                   WHERE id = ? AND response_status = 'DISPATCHED'
                     AND status != 'RESOLVED'
                     AND EXISTS (
                       SELECT 1 FROM projects p
                       WHERE p.project_id = alerts.project_id
                         AND lower(p.ministry) = lower(?)
                     )""",
                (user_id, now, alert_id, ministry),
            )
            if updated.rowcount != 1:
                conn.rollback()
                return None
        elif alert["response_status"] not in {"ACKNOWLEDGED", "ACTION_TAKEN", "APPROVED"}:
            conn.rollback()
            return None
        conn.commit()
    finally:
        conn.close()
    return get_alert_for_ministry(alert_id, ministry)


def approve_alert_action(
    alert_id: int,
    ministry: str,
    user_id: int,
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        updated = conn.execute(
            """UPDATE alerts
               SET response_status = 'APPROVED',
                   action_approved_by = ?, action_approved_at = ?
               WHERE id = ? AND lower(ministry) = lower(?)
                 AND response_status = 'ACTION_TAKEN'
                 AND status != 'RESOLVED'
                 AND action_taken IS NOT NULL
                 AND length(trim(action_taken)) > 0
                 AND EXISTS (
                   SELECT 1 FROM projects p
                   WHERE p.project_id = alerts.project_id
                     AND lower(p.ministry) = lower(?)
                 )""",
            (
                user_id,
                datetime.now().isoformat(timespec="seconds"),
                alert_id,
                ministry,
                ministry,
            ),
        )
        if updated.rowcount != 1:
            conn.rollback()
            return None
        conn.commit()
    finally:
        conn.close()
    return get_alert_for_ministry(alert_id, ministry)


def submit_alert_action(
    alert_id: int,
    ministry: str,
    user_id: int,
    action_taken: str,
    remarks: str,
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        updated = conn.execute(
            """UPDATE alerts
               SET response_status = 'ACTION_TAKEN',
                   action_taken_by = ?, action_taken = ?,
                   remarks = ?, action_taken_at = ?
               WHERE id = ? AND lower(ministry) = lower(?)
                 AND response_status = 'ACKNOWLEDGED'
                 AND status != 'RESOLVED'
                 AND EXISTS (
                   SELECT 1 FROM projects p
                   WHERE p.project_id = alerts.project_id
                     AND lower(p.ministry) = lower(?)
                 )""",
            (
                user_id,
                action_taken,
                remarks,
                datetime.now().isoformat(timespec="seconds"),
                alert_id,
                ministry,
                ministry,
            ),
        )
        if updated.rowcount != 1:
            conn.rollback()
            return None
        conn.commit()
    finally:
        conn.close()
    return get_alert_for_ministry(alert_id, ministry)


def update_alert_status(alert_id: int, ministry: str, status: str) -> Optional[Dict[str, Any]]:
    if status not in {"READ", "RESOLVED"}:
        return None
    conn = get_connection()
    row = conn.execute(
        """SELECT a.status, a.response_status
           FROM alerts a JOIN projects p ON p.project_id = a.project_id
           WHERE a.id = ? AND lower(a.ministry) = lower(?)
             AND lower(p.ministry) = lower(?)""",
        (alert_id, ministry, ministry),
    ).fetchone()
    if not row:
        conn.close()
        return None
    current = str(row["status"]).upper()
    allowed = {"DISPATCHED": {"READ"}, "READ": set(), "RESOLVED": set()}
    if status == "RESOLVED" and row["response_status"] == "APPROVED":
        allowed[current] = {"RESOLVED"}
    if status not in allowed.get(current, set()):
        conn.close()
        return None
    if status == "RESOLVED":
        conn.execute(
            """UPDATE alerts SET status = ?, response_status = 'RESOLVED',
                       response_resolved_at = ?
               WHERE id = ? AND lower(ministry) = lower(?)
                 AND EXISTS (
                   SELECT 1 FROM projects p
                   WHERE p.project_id = alerts.project_id
                     AND lower(p.ministry) = lower(?)
                 )""",
            (status, datetime.now().isoformat(timespec="seconds"), alert_id, ministry, ministry),
        )
    else:
        conn.execute(
            """UPDATE alerts SET status = ?
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM projects p
             WHERE p.project_id = alerts.project_id AND lower(p.ministry) = lower(?)
           )""",
            (status, alert_id, ministry),
        )
    conn.commit()
    conn.close()
    return get_alert_for_ministry(alert_id, ministry)


def get_notifications(user_id: int, ministry: str, unread_only: bool = False) -> List[Dict[str, Any]]:
    conn = get_connection()
    query = "SELECT * FROM notifications WHERE user_id = ? AND ministry = ?"
    params: List[Any] = [user_id, ministry]
    if unread_only:
        query += " AND is_read = 0"
    query += " ORDER BY created_at DESC LIMIT 200"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_unread_notification_count(user_id: int, ministry: str) -> int:
    conn = get_connection()
    row = conn.execute(
        """SELECT COUNT(*) AS unread_count
           FROM notifications
           WHERE user_id = ? AND ministry = ? AND is_read = 0""",
        (user_id, ministry),
    ).fetchone()
    conn.close()
    return int(row["unread_count"]) if row else 0


def mark_notification_read(notification_id: int, user_id: int, ministry: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    now = datetime.now().isoformat(timespec="seconds")
    cursor = conn.execute(
        """UPDATE notifications SET is_read = 1, read_at = ?
           WHERE id = ? AND user_id = ? AND ministry = ?""",
        (now, notification_id, user_id, ministry),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM notifications WHERE id = ? AND user_id = ? AND ministry = ?",
        (notification_id, user_id, ministry),
    ).fetchone()
    conn.close()
    return dict(row) if cursor.rowcount else None


def mark_all_notifications_read(user_id: int, ministry: str) -> int:
    conn = get_connection()
    now = datetime.now().isoformat(timespec="seconds")
    cursor = conn.execute(
        """UPDATE notifications SET is_read = 1, read_at = ?
           WHERE user_id = ? AND ministry = ? AND is_read = 0""",
        (now, user_id, ministry),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount


# ============================================================
# OPTIONAL ANALYTICS HELPERS
# ============================================================

def get_summary() -> Dict[str, Any]:
    df = get_projects_df()

    if df.empty:
        return {
            "projects": 0,
            "total_cost": 0,
            "total_expenditure": 0,
            "average_progress": 0,
            "high_risk": 0,
            "medium_risk": 0,
            "low_risk": 0,
        }

    return {
        "projects": int(len(df)),
        "total_cost": round(float(df["revised_cost"].sum()), 2),
        "total_expenditure": round(
            float(df["expenditure_to_date"].sum()),
            2,
        ),
        "average_progress": round(
            float(df["physical_progress"].mean()),
            2,
        ),
        "high_risk": int(
            (df["risk_level"] == "High").sum()
        ),
        "medium_risk": int(
            (df["risk_level"] == "Medium").sum()
        ),
        "low_risk": int(
            (df["risk_level"] == "Low").sum()
        ),
    }


# ============================================================
# AUTO INITIALIZATION
# ============================================================

if __name__ == "__main__":
    init_db()
