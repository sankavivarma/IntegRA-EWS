import os
import io
import csv
import json
import base64
import hashlib
import hmac
import secrets
import time
import pandas as pd

from fastapi import FastAPI, HTTPException, Response, Query, Header
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from database import (
    init_db,
    get_all_projects,
    add_project,
    log_prediction,
    get_projects_df,
    get_project,
    CSV_DATASET_PATH,
    derive_target_date,
    create_ministry_user,
    ensure_ministry_demo_user,
    get_ministry_user,
    get_ministry_user_by_id,
    verify_password,
    mark_user_login,
    dispatch_alert,
    get_alerts_for_ministry,
    get_alert_history_for_ministry,
    get_alert_for_ministry,
    update_alert_status,
    acknowledge_alert,
    approve_alert_action,
    submit_alert_action,
    count_action_required_for_ministry,
    count_pending_approval_for_ministry,
    count_pending_resolution_for_ministry,
    get_notifications,
    get_unread_notification_count,
    mark_notification_read,
    mark_all_notifications_read,
)

from ml_engine import ml_engine
from chatbot_engine import get_llm_status, query_ai_chatbot

AUTH_SECRET = os.getenv("PAIMANA_AUTH_SECRET", secrets.token_urlsafe(32))
TOKEN_TTL_SECONDS = 8 * 60 * 60
DEMO_ADMIN_USERNAME = "admin.demo@integra-ews.in"
DEMO_ADMIN_PASSWORD = "SIH2026Demo!"


def _demo_admin_enabled() -> bool:
    environment = os.getenv("PAIMANA_ENVIRONMENT", "development").strip().casefold()
    default_enabled = environment not in {"prod", "production"}
    return os.getenv(
        "PAIMANA_ENABLE_DEMO_ADMIN", str(default_enabled)
    ).strip().casefold() in {"1", "true", "yes", "on"}


def _demo_ministry_accounts_enabled() -> bool:
    environment = os.getenv("PAIMANA_ENVIRONMENT", "development").strip().casefold()
    default_enabled = environment not in {"prod", "production"}
    return os.getenv(
        "PAIMANA_ENABLE_DEMO_MINISTRIES", str(default_enabled)
    ).strip().casefold() in {"1", "true", "yes", "on"}


def _make_token(user: dict) -> str:
    payload = {
        "sub": int(user["id"]),
        "username": user["username"],
        "ministry": user["ministry"],
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    signature = hmac.new(
        AUTH_SECRET.encode(), encoded.encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded}.{signature}"


def _make_admin_token(username: str) -> str:
    payload = {
        "sub": f"admin:{username}",
        "username": username,
        "role": "admin",
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    signature = hmac.new(
        AUTH_SECRET.encode(), encoded.encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded}.{signature}"


def _read_token(token: str) -> dict:
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(
            AUTH_SECRET.encode(), encoded.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        payload = json.loads(
            base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        )
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("expired token")
        return payload
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")


def _authenticated_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token_payload = _read_token(authorization.split(" ", 1)[1].strip())
    try:
        user_id = int(token_payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    user = get_ministry_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Ministry user is inactive or does not exist",
        )
    return user


def _authenticated_admin(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin bearer token required")

    token_payload = _read_token(authorization.split(" ", 1)[1].strip())
    configured_username = os.getenv("PAIMANA_ADMIN_USERNAME", "").strip()
    if token_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    token_username = str(token_payload.get("username", "")).strip()
    is_configured_admin = bool(configured_username) and hmac.compare_digest(
        token_username.casefold(), configured_username.casefold()
    )
    is_demo_admin = _demo_admin_enabled() and hmac.compare_digest(
        token_username.casefold(), DEMO_ADMIN_USERNAME.casefold()
    )
    if not (is_configured_admin or is_demo_admin):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    return token_payload


def _verify_admin_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, expected_hex = encoded_hash.split("$")
        iterations = int(iterations_text)
        if algorithm != "pbkdf2_sha256" or not 100_000 <= iterations <= 2_000_000:
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hex)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt, iterations
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="IntegRA EWS - Integrated Risk Analysis Early Warning System API",
    description=(
        "MoSPI Central Sector Infrastructure Monitoring, "
        "Central Database & Machine Learning Backend"
    ),
    version="2.0.0",
)
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))


# ============================================================
# CORS CONFIGURATION
# ============================================================
#
# IMPORTANT:
# Frontend is running on localhost:5174
# Backend is running on 127.0.0.1:8001
#
# Explicit origins prevent the CORS error seen in Chrome.
#

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

SECTOR_CATALOG = [
    "Road Transport & Highways",
    "Railways",
    "Power",
    "Jal Shakti",
    "New & Renewable Energy",
    "Housing & Urban Affairs",
    "Ports & Shipping",
    "Civil Aviation",
    "Agriculture & Farmers Welfare",
    "Health & Family Welfare",
    "Education",
    "Defence",
    "Environment & Forest",
    "Communications",
    "Chemicals & Fertilizers",
    "Steel",
    "Petroleum & Natural Gas",
    "Finance",
    "Commerce & Industry",
    "Heavy Industries",
    "Electronics & IT",
]

SECTOR_MINISTRY_CATALOG = {
    "Road Transport & Highways": "Ministry of Road Transport and Highways",
    "Railways": "Ministry of Railways",
    "Power": "Ministry of Power",
    "Jal Shakti": "Ministry of Jal Shakti",
    "New & Renewable Energy": "Ministry of New and Renewable Energy",
    "Housing & Urban Affairs": "Ministry of Housing and Urban Affairs",
    "Ports & Shipping": "Ministry of Ports, Shipping and Waterways",
    "Civil Aviation": "Ministry of Civil Aviation",
    "Agriculture & Farmers Welfare": "Ministry of Agriculture and Farmers Welfare",
    "Health & Family Welfare": "Ministry of Health and Family Welfare",
    "Education": "Ministry of Education",
    "Defence": "Ministry of Defence",
    "Environment & Forest": "Ministry of Environment, Forest and Climate Change",
    "Communications": "Ministry of Communications",
    "Chemicals & Fertilizers": "Ministry of Chemicals and Fertilizers",
    "Steel": "Ministry of Steel",
    "Petroleum & Natural Gas": "Ministry of Petroleum and Natural Gas",
    "Finance": "Ministry of Finance",
    "Commerce & Industry": "Ministry of Commerce and Industry",
    "Heavy Industries": "Ministry of Heavy Industries",
    "Electronics & IT": "Ministry of Electronics and Information Technology",
}

DEMO_MINISTRY_SLUG_OVERRIDES = {
    "telecommunications": "telecom",
    "civil": "aviation",
    "jal": "jalshakti",
    "road": "roadtransport",
}
DEMO_MINISTRY_PASSWORD_LABELS = {"roadtransport": "RoadTransport"}


def _ministry_demo_slug(ministry: str) -> str:
    words = [
        word
        for word in "".join(
            character.lower() if character.isalnum() else " "
            for character in ministry.replace("&", "and")
        ).split()
        if word not in {"and", "department", "ministry", "of"}
    ]
    if not words:
        raise RuntimeError(f"Cannot create a demo username for Ministry {ministry!r}.")
    return DEMO_MINISTRY_SLUG_OVERRIDES.get(words[0], words[0])


def get_demo_ministry_credentials():
    projects = get_projects_df()
    if "ministry" not in projects.columns:
        raise RuntimeError("Project data has no Ministry column for demo accounts.")

    ministries = sorted({
        str(value).strip()
        for value in projects["ministry"].dropna().tolist()
        if str(value).strip()
    })
    credentials = []
    usernames = set()
    for ministry in ministries:
        slug = _ministry_demo_slug(ministry)
        username = f"demo.{slug}"
        if username in usernames:
            raise RuntimeError(
                "Ministry demo username collision; review the Ministry catalog."
            )
        usernames.add(username)
        credentials.append({
            "ministry": ministry,
            "username": username,
            "password": (
                f"Demo@{DEMO_MINISTRY_PASSWORD_LABELS.get(slug, slug.title())}2026"
            ),
        })
    return credentials


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():
    init_db()
    ml_engine.train_models()

    if _demo_ministry_accounts_enabled():
        for demo_account in get_demo_ministry_credentials():
            ensure_ministry_demo_user(
                demo_account["username"],
                demo_account["password"],
                demo_account["ministry"],
            )

    demo_username = os.getenv("PAIMANA_DEMO_USERNAME")
    demo_password = os.getenv("PAIMANA_DEMO_PASSWORD")
    demo_ministry = os.getenv("PAIMANA_DEMO_MINISTRY")
    if demo_username and demo_password and demo_ministry and not get_ministry_user(demo_username):
        create_ministry_user(demo_username, demo_password, demo_ministry)

    print(
        "[INFO] Central database synchronized with "
        "Sector, Ministry, State and models trained!"
    )


# ============================================================
# REQUEST MODELS
# ============================================================

class ProjectCreateRequest(BaseModel):
    project_id: Optional[str] = None
    project_name: str

    sector: str = "Road Transport & Highways"
    ministry: str = "Ministry of Road Transport and Highways"
    state: str = "Madhya Pradesh"
    agency: str = "MoSPI"

    original_cost: float = 1000.0
    revised_cost: float = 1000.0
    expenditure_to_date: float = 0.0

    original_duration_months: int = 36
    target_date: Optional[str] = None
    delay_months: int = 0
    physical_progress: float = 0.0

    land_acquired_pct: float = 100.0
    environmental_clearance: str = "Approved"
    tender_status: str = "Awarded"
    contractor_risk: str = "Low"


class PredictRequest(BaseModel):
    project_name: Optional[str] = "Evaluation Project"

    sector: str = "Road Transport & Highways"
    ministry: Optional[str] = "Ministry of Road Transport and Highways"
    state: Optional[str] = "Madhya Pradesh"

    original_cost: float = 1000.0
    expenditure_to_date: float = 0.0

    original_duration_months: int = 36
    delay_months: int = 0
    physical_progress: float = 0.0

    land_acquired_pct: float = 100.0
    environmental_clearance: str = "Approved"
    tender_status: str = "Awarded"
    contractor_risk: str = "Low"


class ChatRequest(BaseModel):
    message: str


class NotificationDispatchRequest(BaseModel):
    project_id: str
    recipient_role: Optional[str] = (
        "Ministry Nodal Officer & PMG Taskforce"
    )
    alert_type: str = "PROJECT_RISK_ALERT"
    severity: str = "HIGH"
    message: Optional[str] = None


class AlertStatusRequest(BaseModel):
    status: str


class AlertActionRequest(BaseModel):
    action_taken: str = Field(max_length=2000)
    remarks: str = Field(default="", max_length=4000)


class LoginRequest(BaseModel):
    username: str
    password: str
    ministry: Optional[str] = None


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    return {
        "portal": (
            "Integrated Risk Analysis Early Warning System"
        ),
        "status": "Online",
        "dataset_source": CSV_DATASET_PATH,
        "endpoints": [
            "/api/projects",
            "/api/catalog/sectors",
            "/api/predict-risk",
            "/api/chat",
            "/api/analytics/summary",
            "/api/analytics/benchmarks",
            "/api/alerts/sector-wise",
            "/api/alerts/dispatch",
            "/api/ml/status",
            "/api/reports/sector-wise/download",
            "/api/reports/sector-wise/summary",
        ],
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "ml_trained": ml_engine.is_trained,
    }


@app.post("/api/auth/admin/login")
def admin_login(req: AdminLoginRequest):
    configured_username = os.getenv("PAIMANA_ADMIN_USERNAME", "").strip()
    configured_hash = os.getenv("PAIMANA_ADMIN_PASSWORD_HASH", "").strip()
    demo_enabled = _demo_admin_enabled()
    if not (configured_username and configured_hash) and not demo_enabled:
        raise HTTPException(
            status_code=503,
            detail="Admin authentication is not configured on the server.",
        )

    is_configured_admin = (
        configured_username
        and configured_hash
        and hmac.compare_digest(
            req.username.strip().casefold(), configured_username.casefold()
        )
        and _verify_admin_password(req.password, configured_hash)
    )
    if is_configured_admin:
        admin_username = configured_username
    elif (
        demo_enabled
        and hmac.compare_digest(
            req.username.strip().casefold(), DEMO_ADMIN_USERNAME.casefold()
        )
        and hmac.compare_digest(req.password, DEMO_ADMIN_PASSWORD)
    ):
        admin_username = DEMO_ADMIN_USERNAME
    else:
        admin_username = ""

    if not admin_username:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "access_token": _make_admin_token(admin_username),
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_SECONDS,
        "user": {"username": admin_username, "role": "admin"},
    }


@app.get("/api/auth/admin/me")
def current_admin(authorization: Optional[str] = Header(None)):
    admin = _authenticated_admin(authorization)
    return {"username": admin["username"], "role": "admin"}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    username = req.username.strip()
    if not _demo_ministry_accounts_enabled():
        demo_usernames = {
            credential["username"].casefold()
            for credential in get_demo_ministry_credentials()
        }
        if username.casefold() in demo_usernames:
            raise HTTPException(status_code=401, detail="Invalid username or password")
    user = get_ministry_user(username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if req.ministry and req.ministry.strip().casefold() != str(user["ministry"]).casefold():
        raise HTTPException(
            status_code=401,
            detail="The selected Ministry does not match this user's assigned Ministry.",
        )
    mark_user_login(user["id"])
    return {
        "access_token": _make_token(user),
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_SECONDS,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "ministry": user["ministry"],
        },
    }


@app.get("/api/auth/me")
def current_user(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    return {"id": user["id"], "username": user["username"], "ministry": user["ministry"]}


@app.get("/api/ministry/projects")
def ministry_projects(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    projects = [
        project for project in get_all_projects()
        if str(project.get("ministry", "")).casefold() == str(user["ministry"]).casefold()
    ]
    return {"success": True, "count": len(projects), "ministry": user["ministry"], "projects": projects}


@app.get("/api/ministry/projects/{project_id}")
def ministry_project_detail(
    project_id: str,
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project.get("ministry", "")).casefold() != str(user["ministry"]).casefold():
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True, "project": project}


@app.get("/api/ministry/summary")
def ministry_summary(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    projects = [
        project for project in get_all_projects()
        if str(project.get("ministry", "")).casefold() == str(user["ministry"]).casefold()
    ]
    levels = {str(project.get("risk_level", "")).casefold() for project in projects}
    return {
        "ministry_name": user["ministry"],
        "total_projects": len(projects),
        "total_sectors": len({project.get("sector") for project in projects if project.get("sector")}),
        "high_risk": sum(str(project.get("risk_level", "")).casefold() == "high" for project in projects),
        "medium_risk": sum(str(project.get("risk_level", "")).casefold() == "medium" for project in projects),
        "low_risk": sum(str(project.get("risk_level", "")).casefold() == "low" for project in projects),
        "at_risk": sum(str(project.get("risk_level", "")).casefold() in {"high", "medium"} for project in projects),
        "total_value": sum(float(project.get("revised_cost") or 0) for project in projects),
        "unread_notifications": get_unread_notification_count(
            int(user["id"]),
            user["ministry"],
        ),
        "active_alerts": len(get_alerts_for_ministry(user["ministry"])),
        "action_required_count": count_action_required_for_ministry(user["ministry"]),
        "pending_approval_count": count_pending_approval_for_ministry(user["ministry"]),
        "pending_resolution_count": count_pending_resolution_for_ministry(user["ministry"]),
    }


@app.get("/api/ministry/sectors")
def ministry_sectors(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    projects = [
        project for project in get_all_projects()
        if str(project.get("ministry", "")).casefold() == str(user["ministry"]).casefold()
    ]
    result = []
    for sector in sorted({project.get("sector") for project in projects if project.get("sector")}):
        group = [project for project in projects if project.get("sector") == sector]
        result.append({
            "name": sector,
            "project_count": len(group),
            "high_risk": sum(project.get("risk_level") == "High" for project in group),
            "medium_risk": sum(project.get("risk_level") == "Medium" for project in group),
            "low_risk": sum(project.get("risk_level") == "Low" for project in group),
            "active_alerts": sum(project.get("project_id") in {alert.get("project_id") for alert in get_alerts_for_ministry(user["ministry"])} for project in group),
        })
    return {"success": True, "ministry": user["ministry"], "sectors": result}


@app.get("/api/ministry/alerts")
def ministry_alerts(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    alerts = get_alerts_for_ministry(user["ministry"])
    return {"success": True, "count": len(alerts), "alerts": alerts}


@app.get("/api/ministry/alert-history")
def ministry_alert_history(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    alerts = get_alert_history_for_ministry(user["ministry"])
    return {"success": True, "count": len(alerts), "alerts": alerts}


@app.get("/api/ministry/alerts/{alert_id}")
def ministry_alert_detail(
    alert_id: int,
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    alert = get_alert_for_ministry(alert_id, user["ministry"])
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "alert": alert}


@app.post("/api/ministry/alerts/{alert_id}/acknowledge")
def ministry_acknowledge_alert(
    alert_id: int,
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    updated = acknowledge_alert(
        alert_id,
        user["ministry"],
        int(user["id"]),
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Alert not found, already resolved, or not assigned to your Ministry.",
        )
    return {"success": True, "alert": updated}


@app.post("/api/ministry/alerts/{alert_id}/action")
def ministry_submit_alert_action(
    alert_id: int,
    req: AlertActionRequest,
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    action_taken = req.action_taken.strip()
    if not action_taken:
        raise HTTPException(status_code=422, detail="Action Taken cannot be empty.")
    updated = submit_alert_action(
        alert_id,
        user["ministry"],
        int(user["id"]),
        action_taken,
        req.remarks.strip(),
    )
    if not updated:
        raise HTTPException(
            status_code=409,
            detail="Acknowledge this Ministry's alert before submitting action, and submit it only once.",
        )
    return {"success": True, "alert": updated}


@app.post("/api/ministry/alerts/{alert_id}/approve")
def ministry_approve_alert_action(
    alert_id: int,
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    updated = approve_alert_action(
        alert_id,
        user["ministry"],
        int(user["id"]),
    )
    if not updated:
        raise HTTPException(
            status_code=409,
            detail="Only a submitted action for your Ministry can be approved.",
        )
    return {"success": True, "alert": updated}


@app.patch("/api/ministry/alerts/{alert_id}/status")
def ministry_alert_status(
    alert_id: int,
    req: AlertStatusRequest,
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    status = req.status.strip().upper()
    if status not in {"READ", "RESOLVED"}:
        raise HTTPException(status_code=422, detail="Status must be READ or RESOLVED")
    updated = update_alert_status(alert_id, user["ministry"], status)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found or invalid status transition")
    return {"success": True, "alert": updated}


@app.get("/api/notifications")
def notifications(
    unread_only: bool = Query(False),
    authorization: Optional[str] = Header(None),
):
    user = _authenticated_user(authorization)
    items = get_notifications(int(user["id"]), user["ministry"], unread_only)
    return {
        "success": True,
        "count": len(items),
        "unread_count": get_unread_notification_count(
            int(user["id"]),
            user["ministry"],
        ),
        "notifications": items,
    }


@app.get("/api/ministry/notifications/unread-count")
def ministry_unread_notification_count(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    return {
        "success": True,
        "unread_count": get_unread_notification_count(
            int(user["id"]),
            user["ministry"],
        ),
    }


@app.patch("/api/notifications/{notification_id}/read")
def read_notification(notification_id: int, authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    item = mark_notification_read(notification_id, int(user["id"]), user["ministry"])
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True, "notification": item}


@app.post("/api/notifications/{notification_id}/read")
def read_notification_compat(notification_id: int, authorization: Optional[str] = Header(None)):
    return read_notification(notification_id, authorization)


@app.post("/api/notifications/read-all")
def read_all_notifications(authorization: Optional[str] = Header(None)):
    user = _authenticated_user(authorization)
    count = mark_all_notifications_read(int(user["id"]), user["ministry"])
    return {"success": True, "updated": count}


@app.get("/api/catalog/sectors")
def list_sectors():
    """Return the complete supported sector catalog and live project counts."""
    df = get_projects_df()
    counts = (
        df["sector"].value_counts().to_dict()
        if not df.empty and "sector" in df.columns
        else {}
    )
    sectors = sorted(str(sector) for sector in counts)
    return {
        "success": True,
        "sectors": [
            {
                "name": sector,
                "project_count": int(counts.get(sector, 0)),
                "available": True,
            }
            for sector in sectors
        ],
    }


@app.get("/api/catalog/ministries")
def list_ministries():
    """Return the complete ministry catalog with live project counts."""
    df = get_projects_df()
    counts = (
        df.groupby("ministry").size().to_dict()
        if not df.empty and "ministry" in df.columns
        else {}
    )
    names = sorted(str(name) for name in counts)
    return {
        "success": True,
        "ministries": [
            {
                "name": name,
                "project_count": int(counts.get(name, 0)),
                "available": True,
            }
            for name in names
        ],
    }


@app.get("/api/demo/ministry-credentials")
def list_demo_ministry_credentials():
    """Return intentionally public prototype credentials for each project Ministry."""
    return {
        "success": True,
        "demo_only": True,
        "credentials": (
            get_demo_ministry_credentials()
            if _demo_ministry_accounts_enabled()
            else []
        ),
    }


# ============================================================
# PROJECTS
# ============================================================

@app.get("/api/projects")
def list_projects(sector: Optional[str] = Query(None)):
    """
    Retrieve all infrastructure projects
    from the central database.
    """

    projects = get_all_projects()

    if sector and sector.strip().upper() != "ALL":
        projects = [
            project for project in projects
            if str(project.get("sector", "")).casefold() == sector.strip().casefold()
        ]

    return {
        "success": True,
        "count": len(projects),
        "projects": projects,
    }


@app.post("/api/projects")
def create_project(
    project: ProjectCreateRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Add a new project to the central repository
    and run initial predictive analysis.
    """

    _authenticated_admin(authorization)
    proj_dict = project.model_dump()

    if proj_dict["revised_cost"] <= proj_dict["original_cost"]:
        proj_dict["revised_cost"] = round(
            proj_dict["original_cost"] * 1.12,
            2,
        )
    proj_dict["target_date"] = derive_target_date(
        proj_dict.get("project_id") or proj_dict["project_name"],
        proj_dict.get("target_date"),
        proj_dict["original_duration_months"],
        proj_dict["delay_months"],
    )

    prediction = ml_engine.predict_project_risk(proj_dict)

    proj_dict["risk_score"] = prediction["risk_score"]
    proj_dict["risk_level"] = prediction["risk_level"]

    top_reason = (
        prediction["key_reasons"][0]["detail"]
        if prediction["key_reasons"]
        else "Normal Progress"
    )

    proj_dict["primary_risk_reason"] = top_reason

    row_id = add_project(proj_dict)

    return {
        "success": True,
        "message": "Project registered successfully",
        "id": row_id,
        "prediction": prediction,
    }


# ============================================================
# PREDICT RISK
# ============================================================

@app.post("/api/predict-risk")
def predict_risk(req: PredictRequest):
    """
    Run Machine Learning inference.

    Returns:
    - Risk Score
    - Risk Level
    - Predicted Final Cost
    - Cost Overrun %
    - Delay Forecast
    - Explainable Reasons
    """

    data_dict = req.model_dump()

    prediction = ml_engine.predict_project_risk(data_dict)

    # Log prediction
    log_prediction(
        data_dict.get("project_id") or data_dict.get("project_name", "ad-hoc"),
        "risk_assessment",
        json.dumps(prediction),
    )

    return {
        "success": True,
        "prediction": prediction,
    }


# ============================================================
# CHATBOT
# ============================================================

@app.post("/api/chat")
def chat_ai(req: ChatRequest):
    """
    AI Project Intelligence Assistant.
    """

    try:
        reply = query_ai_chatbot(req.message)
    except Exception as exc:
        print(f"[ERROR] Chatbot request failed: {exc}")
        raise HTTPException(status_code=503, detail="The assistant could not process this request.")

    return {
        "success": True,
        "reply": reply,
        "llm": get_llm_status(),
    }


@app.get("/api/chat/status")
def chat_status():
    """Expose safe LLM configuration status for the assistant UI."""
    return {"success": True, "llm": get_llm_status()}


# ============================================================
# ANALYTICS SUMMARY
# ============================================================

@app.get("/api/analytics/summary")
def get_analytics_summary():
    """
    Aggregate statistics for MoSPI Dashboard.
    """

    df = get_projects_df()

    if df.empty:
        return {
            "total_projects": 0,
            "total_original_cost": 0,
            "total_revised_cost": 0,
            "total_cost_overrun": 0,
            "overall_overrun_pct": 0,
            "high_risk_count": 0,
            "medium_risk_count": 0,
            "low_risk_count": 0,
            "delayed_projects_count": 0,
            "avg_delay_months": 0,
        }

    total_orig = float(df["original_cost"].sum())
    total_rev = float(df["revised_cost"].sum())

    overrun = total_rev - total_orig

    pct = round(
        (overrun / max(total_orig, 1)) * 100,
        1,
    )

    return {
        "total_projects": len(df),
        "total_original_cost": round(total_orig, 2),
        "total_revised_cost": round(total_rev, 2),
        "total_cost_overrun": round(overrun, 2),
        "overall_overrun_pct": pct,
        "high_risk_count": int(
            (df["risk_level"] == "High").sum()
        ),
        "medium_risk_count": int(
            (df["risk_level"] == "Medium").sum()
        ),
        "low_risk_count": int(
            (df["risk_level"] == "Low").sum()
        ),
        "delayed_projects_count": int(
            (df["delay_months"] > 0).sum()
        ),
        "avg_delay_months": round(
            float(df["delay_months"].mean()),
            1,
        ),
    }


# ============================================================
# BENCHMARK ANALYTICS
# ============================================================

@app.get("/api/analytics/benchmarks")
def get_benchmarks():
    """
    Sector-wise, ministry-wise and state-wise
    comparative benchmarking analytics.
    """

    df = get_projects_df()

    if df.empty:
        return {
            "sectors": [],
            "ministries": [],
            "states": [],
        }

    # --------------------------------------------------------
    # SECTOR
    # --------------------------------------------------------

    sector_summary = []

    grouped_sectors = {
        str(sector): group
        for sector, group in df.groupby("sector")
    }

    for sector in sorted(grouped_sectors):
        group = grouped_sectors.get(sector)

        if group is None:
            sector_summary.append(
                {
                    "sector": sector,
                    "project_count": 0,
                    "total_sanctioned_cost": 0,
                    "total_revised_cost": 0,
                    "cost_overrun_pct": 0,
                    "avg_delay_months": 0,
                    "avg_physical_progress": 0,
                    "high_risk_projects": 0,
                }
            )
            continue

        total_orig = float(
            group["original_cost"].sum()
        )

        total_rev = float(
            group["revised_cost"].sum()
        )

        overrun = total_rev - total_orig

        overrun_pct = round(
            (overrun / max(total_orig, 1)) * 100,
            1,
        )

        avg_delay = round(
            float(group["delay_months"].mean()),
            1,
        )

        avg_progress = round(
            float(group["physical_progress"].mean()),
            1,
        )

        high_risk_count = int(
            (group["risk_level"] == "High").sum()
        )

        sector_summary.append(
            {
                "sector": sector,
                "project_count": len(group),
                "total_sanctioned_cost": round(
                    total_orig,
                    2,
                ),
                "total_revised_cost": round(
                    total_rev,
                    2,
                ),
                "cost_overrun_pct": overrun_pct,
                "avg_delay_months": avg_delay,
                "avg_physical_progress": avg_progress,
                "high_risk_projects": high_risk_count,
            }
        )

    for sector, group in grouped_sectors.items():
        if sector in grouped_sectors:
            continue

        sector_summary.append(
            {
                "sector": sector,
                "project_count": len(group),
                "total_sanctioned_cost": round(float(group["original_cost"].sum()), 2),
                "total_revised_cost": round(float(group["revised_cost"].sum()), 2),
                "cost_overrun_pct": round(
                    ((group["revised_cost"].sum() - group["original_cost"].sum())
                     / max(group["original_cost"].sum(), 1)) * 100,
                    1,
                ),
                "avg_delay_months": round(float(group["delay_months"].mean()), 1),
                "avg_physical_progress": round(float(group["physical_progress"].mean()), 1),
                "high_risk_projects": int((group["risk_level"] == "High").sum()),
            }
        )

    sector_summary.sort(key=lambda x: x["total_revised_cost"], reverse=True)

    # --------------------------------------------------------
    # MINISTRY
    # --------------------------------------------------------

    ministry_summary = []
    for ministry_name, group in df.groupby("ministry"):
        total_orig = float(group["original_cost"].sum())
        total_rev = float(group["revised_cost"].sum())
        ministry_summary.append(
            {
                "ministry": str(ministry_name),
                "project_count": len(group),
                "total_sanctioned_cost": round(total_orig, 2),
                "total_revised_cost": round(total_rev, 2),
                "cost_overrun_pct": round(
                    ((total_rev - total_orig) / max(total_orig, 1)) * 100,
                    1,
                ),
                "avg_delay_months": round(float(group["delay_months"].mean()), 1),
                "avg_physical_progress": round(float(group["physical_progress"].mean()), 1),
                "high_risk_projects": int((group["risk_level"] == "High").sum()),
            }
        )

    ministry_summary.sort(
        key=lambda item: item["total_revised_cost"],
        reverse=True,
    )

    # --------------------------------------------------------
    # STATE
    # --------------------------------------------------------

    state_summary = []

    for state_name, group in df.groupby("state"):

        total_orig = float(
            group["original_cost"].sum()
        )

        total_rev = float(
            group["revised_cost"].sum()
        )

        overrun = total_rev - total_orig

        overrun_pct = round(
            (overrun / max(total_orig, 1)) * 100,
            1,
        )

        avg_delay = round(
            float(group["delay_months"].mean()),
            1,
        )

        avg_progress = round(
            float(group["physical_progress"].mean()),
            1,
        )

        high_risk_count = int(
            (group["risk_level"] == "High").sum()
        )

        state_summary.append(
            {
                "state": state_name,
                "project_count": len(group),
                "total_sanctioned_cost": round(
                    total_orig,
                    2,
                ),
                "total_revised_cost": round(
                    total_rev,
                    2,
                ),
                "cost_overrun_pct": overrun_pct,
                "avg_delay_months": avg_delay,
                "avg_physical_progress": avg_progress,
                "high_risk_projects": high_risk_count,
            }
        )

    state_summary.sort(
        key=lambda x: x["project_count"],
        reverse=True,
    )

    return {
        "sectors": sector_summary,
        "ministries": ministry_summary,
        "states": state_summary,
    }


# ============================================================
# PRIOR RISK ALERT ENGINE
# ============================================================

@app.get("/api/alerts/sector-wise")
def get_sector_wise_alerts():
    """
    Automated Prior Risk Detection Engine.

    Detects:
    1. Burn-rate mismatch
    2. Land acquisition deficit
    3. Environmental clearance bottleneck
    4. Schedule slippage
    """

    df = get_projects_df()

    if df.empty:
        return {
            "total_alerts": 0,
            "sectors_count": 0,
            "sector_alerts": {},
        }

    sector_groups = {sector: [] for sector in SECTOR_CATALOG}
    total_alerts_count = 0

    for _, row in df.iterrows():

        p_cost = float(
            row.get("original_cost", 0) or 0
        )

        p_spent = float(
            row.get("expenditure_to_date", 0) or 0
        )

        p_prog = float(
            row.get("physical_progress", 0) or 0
        )

        p_delay = int(
            row.get("delay_months", 0) or 0
        )

        p_land = float(
            row.get("land_acquired_pct", 100) or 100
        )

        p_clearance = str(
            row.get(
                "environmental_clearance",
                "Approved",
            )
        )

        p_sector = str(
            row.get(
                "sector",
                "General Infrastructure",
            )
        )

        p_ministry = str(
            row.get(
                "ministry",
                "Ministry of Programme Implementation",
            )
        )

        p_state = str(
            row.get(
                "state",
                "Madhya Pradesh",
            )
        )

        p_risk = float(
            row.get("risk_score", 0) or 0
        )

        alerts_for_project = []

        # ----------------------------------------------------
        # 1. BURN RATE
        # ----------------------------------------------------

        if (
            p_cost > 0
            and p_spent > (p_cost * 0.5)
            and p_prog < 35
        ):

            alerts_for_project.append(
                {
                    "type": "BURN_RATE_ANOMALY",
                    "severity": "CRITICAL",
                    "lead_time": "30-45 Days Prior",
                    "message": (
                        f"Financial burn rate "
                        f"({round((p_spent / p_cost) * 100)}%) "
                        f"is disproportionately outpacing "
                        f"physical progress ({p_prog}%)."
                    ),
                    "trigger": (
                        "Premature Budget Exhaustion Risk"
                    ),
                }
            )

        # ----------------------------------------------------
        # 2. LAND ACQUISITION
        # ----------------------------------------------------

        if (
            p_land < 85
            and p_prog > 20
        ):

            alerts_for_project.append(
                {
                    "type": "LAND_DEFICIT_WARNING",
                    "severity": "HIGH",
                    "lead_time": "60 Days Prior",
                    "message": (
                        f"Critical land acquisition deficit "
                        f"of {round(100 - p_land)}% "
                        f"unacquired land will stall "
                        f"upcoming civil packages."
                    ),
                    "trigger": (
                        "Linear Right-of-Way Blockage"
                    ),
                }
            )

        # ----------------------------------------------------
        # 3. ENVIRONMENTAL CLEARANCE
        # ----------------------------------------------------

        if (
            p_clearance in [
                "Pending",
                "Conditional",
            ]
            and p_delay > 12
        ):

            alerts_for_project.append(
                {
                    "type": "REGULATORY_DEADLINE_RISK",
                    "severity": "HIGH",
                    "lead_time": "90 Days Prior",
                    "message": (
                        "Statutory forestry/wildlife "
                        "approvals pending Stage-II "
                        "clearance deadline."
                    ),
                    "trigger": (
                        "Statutory Stoppage Risk"
                    ),
                }
            )

        # ----------------------------------------------------
        # 4. SCHEDULE SLIPPAGE
        # ----------------------------------------------------

        if (
            p_risk > 70
            or p_delay > 24
        ):

            alerts_for_project.append(
                {
                    "type": "SCHEDULE_SLIPPAGE_VELOCITY",
                    "severity": "CRITICAL",
                    "lead_time": "30 Days Prior",
                    "message": (
                        f"Project has accumulated "
                        f"{p_delay} months delay with high "
                        f"probability of subsequent "
                        f"milestone breach."
                    ),
                    "trigger": (
                        "Milestone Breach Projection"
                    ),
                }
            )

        # ----------------------------------------------------
        # STORE ALERTS
        # ----------------------------------------------------

        if alerts_for_project:

            if p_sector not in sector_groups:
                sector_groups[p_sector] = []

            for alert_item in alerts_for_project:

                total_alerts_count += 1

                sector_groups[p_sector].append(
                    {
                        "project_id": row.get(
                            "project_id",
                            "",
                        ),
                        "project_name": row.get(
                            "project_name",
                            "",
                        ),
                        "sector": p_sector,
                        "ministry": p_ministry,
                        "state": p_state,
                        "agency": row.get(
                            "agency",
                            "",
                        ),
                        "risk_score": p_risk,
                        "alert_type": alert_item[
                            "type"
                        ],
                        "severity": alert_item[
                            "severity"
                        ],
                        "lead_time": alert_item[
                            "lead_time"
                        ],
                        "message": alert_item[
                            "message"
                        ],
                        "trigger": alert_item[
                            "trigger"
                        ],
                        "recommended_action": (
                            "Automated Prior Notice to "
                            f"{p_ministry} Nodal Officer "
                            f"& PMG Review Taskforce "
                            f"({p_state})"
                        ),
                        "notification_status": (
                            "AUTO-SCHEDULED"
                        ),
                    }
                )

    return {
        "total_alerts": total_alerts_count,
        "sectors_count": len(sector_groups),
        "sector_alerts": sector_groups,
    }


# ============================================================
# ALERT DISPATCH
# ============================================================

@app.post("/api/alerts/dispatch")
def dispatch_alert_notification(
    req: NotificationDispatchRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Simulates automated alert dispatch.
    """

    _authenticated_admin(authorization)
    return _persist_alert_dispatch(req, user=None)


def _persist_alert_dispatch(req: NotificationDispatchRequest, user: Optional[dict]):
    project = get_project(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ministry = project.get("ministry")
    if not ministry:
        raise HTTPException(status_code=422, detail="Project has no ministry assignment")
    if user and str(project.get("ministry", "")).casefold() != str(user["ministry"]).casefold():
        raise HTTPException(status_code=403, detail="Project is outside your ministry scope")
    message = req.message or f"Risk alert dispatched for project {req.project_id}."
    persisted = dispatch_alert(
        req.project_id,
        req.alert_type,
        req.severity,
        message,
        req.recipient_role,
        ministry,
        int(user["id"]) if user else None,
    )
    return {
        "success": True,
        "message": (
            "Automated prior risk alert successfully "
            f"dispatched to {req.recipient_role} "
            f"for Project {req.project_id}."
        ),
        "dispatch_id": (
            f"DISP-{os.urandom(3).hex().upper()}"
        ),
        "timestamp": (
            pd.Timestamp.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        ),
        "alert": persisted,
    }


@app.post("/api/ministry/alerts/dispatch")
def dispatch_ministry_alert(
    req: NotificationDispatchRequest,
    authorization: Optional[str] = Header(None),
):
    """Authenticated alias for dispatching a ministry-scoped alert."""
    user = _authenticated_user(authorization)
    if not authorization:
        raise HTTPException(status_code=401, detail="Bearer access token required")
    return _persist_alert_dispatch(req, user)


# ============================================================
# ML STATUS
# ============================================================

@app.get("/api/ml/status")
def get_ml_status():
    """
    Returns Machine Learning training status.
    """

    return {
        "status": (
            "ready"
            if ml_engine.is_trained
            else "not_trained"
        ),
        "framework": "scikit-learn",
        "models": {
            "risk_classifier": (
                "RandomForestClassifier("
                "n_estimators=60, max_depth=6)"
            ),
            "cost_regressor": (
                "RandomForestRegressor("
                "n_estimators=60, max_depth=6)"
            ),
            "delay_regressor": (
                "GradientBoostingRegressor("
                "n_estimators=40, max_depth=4)"
            ),
        },
    }


# ============================================================
# RISK REPORT DOWNLOAD
# ============================================================

@app.get("/api/reports/sector-wise/download")
def download_sector_risk_report(
    sector: Optional[str] = Query("ALL"),
):
    """
    Generates downloadable MoSPI Risk Dossier CSV.
    """

    df = get_projects_df()

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail="No projects in database",
        )

    clean_sector = (
        sector.strip()
        if sector
        else "ALL"
    )

    if clean_sector.upper() != "ALL":

        target_df = df[
            df["sector"]
            .astype(str)
            .str.lower()
            == clean_sector.lower()
        ]

    else:
        target_df = df

    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow(
        [
            "# GOVERNMENT OF INDIA - MINISTRY OF "
            "STATISTICS AND PROGRAMME IMPLEMENTATION (MoSPI)"
        ]
    )

    writer.writerow(
        [
            "# AUTOMATED PRIOR INFRASTRUCTURE "
            f"RISK REPORT - SECTOR: "
            f"{clean_sector.upper()}"
        ]
    )

    writer.writerow(
        [
            "# TOTAL MONITORED PROJECTS: "
            f"{len(target_df)} | GENERATION TIMESTAMP: "
            f"{pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
    )

    writer.writerow([])

    headers = [
        "Project Code",
        "Project Name",
        "Sector",
        "Line Ministry",
        "State",
        "Implementing Agency",
        "Sanctioned Cost (₹ Cr)",
        "Revised Cost (₹ Cr)",
        "Cost Escalation (₹ Cr)",
        "Cost Overrun (%)",
        "Accumulated Delay (Months)",
        "Physical Progress (%)",
        "Land Acquired (%)",
        "Environmental Clearance",
        "Contractor Risk",
        "AI Risk Score (%)",
        "AI Risk Classification",
        "Primary Risk / Delay Factor",
        "Targeted Policy Recommendation",
    ]

    writer.writerow(headers)

    for _, row in target_df.iterrows():

        orig_cost = float(
            row.get("original_cost", 0.0)
            or 0.0
        )

        rev_cost = float(
            row.get("revised_cost", 0.0)
            or 0.0
        )

        cost_diff = rev_cost - orig_cost

        overrun_pct = round(
            (
                cost_diff
                / max(orig_cost, 1.0)
            )
            * 100.0,
            1,
        )

        delay = int(
            row.get("delay_months", 0)
            or 0
        )

        land = float(
            row.get("land_acquired_pct", 100.0)
            or 100.0
        )

        clearance = str(
            row.get(
                "environmental_clearance",
                "Approved",
            )
        )

        contractor = str(
            row.get(
                "contractor_risk",
                "Low",
            )
        )

        risk_lvl = str(
            row.get(
                "risk_level",
                "Low",
            )
        )

        if land < 85:

            rec = (
                "Fast-track land possession through "
                "State Revenue Taskforce & Section "
                "11/19 LARR compensation."
            )

        elif clearance != "Approved":

            rec = (
                "Escalate statutory tree-felling & "
                "crossing Stage-II clearance on "
                "PARIVESH portal."
            )

        elif contractor == "High":

            rec = (
                "Issue contractual cure notice; "
                "enforce 3-shift 24/7 working roster."
            )

        elif delay > 24:

            rec = (
                "Conduct Cabinet Committee on "
                "Investment (CCI) PMG "
                "inter-ministerial review."
            )

        else:

            rec = (
                "Maintain milestone burn-rate "
                "monitoring and quarterly audits."
            )

        writer.writerow(
            [
                row.get("project_id", ""),
                row.get("project_name", ""),
                row.get("sector", ""),
                row.get("ministry", ""),
                row.get("state", ""),
                row.get("agency", ""),
                f"{orig_cost:.2f}",
                f"{rev_cost:.2f}",
                f"{cost_diff:.2f}",
                f"{overrun_pct}%",
                delay,
                (
                    f"{float(row.get('physical_progress', 0.0) or 0.0):.1f}%"
                ),
                f"{land:.1f}%",
                clearance,
                contractor,
                (
                    f"{float(row.get('risk_score', 0.0) or 0.0):.1f}%"
                ),
                risk_lvl,
                row.get(
                    "primary_risk_reason",
                    "Standard monitoring",
                ),
                rec,
            ]
        )

    csv_data = output.getvalue()

    filename_sector = "".join(
        c if c.isalnum() else "_"
        for c in clean_sector
    )

    filename = (
        f"MoSPI_Risk_Report_"
        f"{filename_sector}.csv"
    )

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
            "Access-Control-Expose-Headers": (
                "Content-Disposition"
            ),
        },
    )


@app.get("/api/reports/ministry-wise/download")
def download_ministry_risk_report(
    ministry: Optional[str] = Query("ALL"),
):
    """Generate a CSV report for one ministry or the full portfolio."""
    df = get_projects_df()
    if df.empty:
        raise HTTPException(status_code=404, detail="No projects in database")

    target_ministry = (ministry or "ALL").strip()
    if target_ministry.upper() == "ALL":
        target_df = df
    else:
        target_df = df[
            df["ministry"].astype(str).str.casefold()
            == target_ministry.casefold()
        ]

    if target_df.empty:
        raise HTTPException(status_code=404, detail="No projects for ministry")

    output = io.StringIO()
    target_df.to_csv(output, index=False)
    filename = "".join(c if c.isalnum() else "_" for c in target_ministry)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="MoSPI_Ministry_Report_{filename}.csv"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ============================================================
# SECTOR RISK SUMMARY
# ============================================================

@app.get("/api/reports/sector-wise/summary")
def get_sector_risk_summary(
    sector: Optional[str] = Query("ALL"),
):
    """
    High-level sector risk summary statistics
    and high-risk project dossiers.
    """

    df = get_projects_df()

    if df.empty:
        return {
            "total": 0,
            "sectors": [],
        }

    clean_sector = (
        sector.strip()
        if sector
        else "ALL"
    )

    if clean_sector.upper() != "ALL":

        target_df = df[
            df["sector"]
            .astype(str)
            .str.lower()
            == clean_sector.lower()
        ]

    else:
        target_df = df

    sectors_summary = []

    for sec_name, group in target_df.groupby(
        "sector"
    ):

        tot_orig = float(
            group["original_cost"].sum()
        )

        tot_rev = float(
            group["revised_cost"].sum()
        )

        overrun = tot_rev - tot_orig

        overrun_pct = round(
            (
                overrun
                / max(tot_orig, 1.0)
            )
            * 100.0,
            1,
        )

        top_high_risk = []

        high_risk_group = (
            group[
                group["risk_level"] == "High"
            ]
            .sort_values(
                by="risk_score",
                ascending=False,
            )
            .head(3)
        )

        for _, r in high_risk_group.iterrows():

            top_high_risk.append(
                {
                    "project_id": r.get(
                        "project_id",
                        "",
                    ),
                    "project_name": r.get(
                        "project_name",
                        "",
                    ),
                    "ministry": r.get(
                        "ministry",
                        "",
                    ),
                    "state": r.get(
                        "state",
                        "",
                    ),
                    "risk_score": r.get(
                        "risk_score",
                        0,
                    ),
                    "delay_months": r.get(
                        "delay_months",
                        0,
                    ),
                    "primary_risk_reason": r.get(
                        "primary_risk_reason",
                        "",
                    ),
                }
            )

        sectors_summary.append(
            {
                "sector": sec_name,
                "project_count": len(group),
                "high_risk_count": int(
                    (
                        group["risk_level"]
                        == "High"
                    ).sum()
                ),
                "medium_risk_count": int(
                    (
                        group["risk_level"]
                        == "Medium"
                    ).sum()
                ),
                "low_risk_count": int(
                    (
                        group["risk_level"]
                        == "Low"
                    ).sum()
                ),
                "total_sanctioned_cost": round(
                    tot_orig,
                    2,
                ),
                "total_revised_cost": round(
                    tot_rev,
                    2,
                ),
                "cost_overrun_cr": round(
                    overrun,
                    2,
                ),
                "cost_overrun_pct": overrun_pct,
                "avg_delay_months": round(
                    float(
                        group[
                            "delay_months"
                        ].mean()
                    ),
                    1,
                ),
                "avg_physical_progress": round(
                    float(
                        group[
                            "physical_progress"
                        ].mean()
                    ),
                    1,
                ),
                "top_high_risk_projects": top_high_risk,
            }
        )

    sectors_summary.sort(
        key=lambda x: x["high_risk_count"],
        reverse=True,
    )

    if clean_sector.upper() == "ALL":
        existing = {item["sector"] for item in sectors_summary}
        sectors_summary.extend(
            {
                "sector": sector_name,
                "project_count": 0,
                "high_risk_count": 0,
                "medium_risk_count": 0,
                "low_risk_count": 0,
                "total_sanctioned_cost": 0,
                "total_revised_cost": 0,
                "cost_overrun_cr": 0,
                "cost_overrun_pct": 0,
                "avg_delay_months": 0,
                "avg_physical_progress": 0,
                "top_high_risk_projects": [],
            }
            for sector_name in SECTOR_CATALOG
            if sector_name not in existing
        )

    return {
        "total_projects": len(target_df),
        "sectors_count": len(sectors_summary),
        "sectors": sectors_summary,
    }


# ============================================================
# DATABASE SYNCHRONIZATION
# ============================================================

@app.post("/api/sync-csv")
def sync_csv(authorization: Optional[str] = Header(None)):
    """
    Re-sync database directly from the configured
    dataset path.
    """

    _authenticated_admin(authorization)
    init_db()
    ml_engine.train_models()

    return {
        "success": True,
        "message": (
            "Database successfully re-imported "
            f"from {CSV_DATASET_PATH}"
        ),
    }


@app.get("/{path:path}", include_in_schema=False)
def frontend_route(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if not os.path.isfile(index_path):
        raise HTTPException(status_code=404, detail="Frontend build not found")

    dist_dir = os.path.realpath(FRONTEND_DIST_DIR)
    requested_path = os.path.realpath(os.path.join(dist_dir, path))
    if os.path.commonpath((dist_dir, requested_path)) != dist_dir:
        raise HTTPException(status_code=404, detail="Not Found")
    if os.path.isfile(requested_path):
        return FileResponse(requested_path)
    if os.path.splitext(path)[1]:
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(index_path)


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8001,
        reload=True,
    )