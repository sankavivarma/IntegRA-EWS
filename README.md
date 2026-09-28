# IntegRA EWS: AI-Powered Infrastructure Performance Monitoring & Risk Analytics
### Ministry of Statistics and Programme Implementation (MoSPI), Government of India
**Integrated Risk Analysis Early Warning System**

---

## 🎯 Problem Statement & Comprehensive Solution Mapping (Outcomes a - i)

This solution addresses all 9 key outcomes specified by MoSPI using a **100% open-source, production-ready stack** (FastAPI, SQLite, Scikit-Learn Machine Learning, Pandas, NumPy, React, and Vite).

| Outcome | Problem Statement Deliverable | Implementation in PAIMANA |
| :--- | :--- | :--- |
| **a** | **Cost Overrun Prediction Model** | Scikit-Learn Regression Ensemble predicting anticipated revised project cost and escalation percentage (`+XX%`). |
| **b** | **Time Overrun Prediction Model** | Machine Learning timeline model forecasting total schedule slippage and delay duration in months. |
| **c** | **Project Risk Scoring Framework** | Composite **0–100% Risk Probability Score** with classification (`High Risk`, `Moderate Risk`, `Low Risk`). |
| **d** | **Early Warning Alert System** | Proactive alert center monitoring 1,775 projects with automated red-flagging for critical delays. |
| **e** | **Benchmarking and Comparative Analytics Module** | Cross-sector comparative intelligence comparing Aviation, Railways, Highways, Petroleum, Urban Dev, and Power. |
| **f** | **Cost Escalation Driver Analysis Module** | Explainable AI root-cause decomposition (Land Acquisition backlog %, Clearances lag, Contractor bottleneck %, Commodity inflation). |
| **g** | **AI-Powered Monitoring Dashboard** | Unified portal with dual modes: **Project Monitoring** (Portfolio Inventory) & **Performance Monitoring** (AI Intelligence Suite). |
| **h** | **LLM-Enabled Project Intelligence Assistant** | Conversational AI Assistant querying live status, delay causes, and risk forecasts across all 1,775 projects. |
| **i** | **Documentation and Deployment Framework** | Comprehensive modular architecture, REST APIs, SQLite DB, and complete open-source deployment framework. |

---

## 🏗️ Architecture & Open-Source Stack

```
PAIMANA Application
│
├── backend/ (Python Open-Source Backend)
│   ├── data/
│   │   └── projects.csv          👈 [Cleaned MoSPI Dataset - 1,775 projects]
│   ├── paimana.db                👈 [SQLite Central Database]
│   ├── main.py                   👈 [FastAPI Server with REST APIs]
│   ├── ml_engine.py              👈 [Scikit-Learn Machine Learning Models & Explainability Engine]
│   ├── chatbot_engine.py         👈 [AI Conversational Project Intelligence Engine]
│   ├── database.py               👈 [SQLite Database & Excel/CSV Synchronization Engine]
│   └── requirements.txt          👈 [fastapi, uvicorn, scikit-learn, pandas, numpy, openpyxl]
│
└── src/ (Modern React Frontend UI)
    ├── components/
    │   ├── Header.jsx                👈 [Clean Official MoSPI Header & Navigation]
    │   ├── PerformanceMonitoring.jsx 👈 [Outcomes a-h Modules: Predictor, Early Warnings, Benchmarks, LLM]
    │   ├── MinistryDashboard.jsx     👈 [Official Ministry/Sector Metrics & Portfolio Cards]
    │   ├── StateMapSection.jsx       👈 [Interactive State-wise Infrastructure Map]
    │   ├── HighValueProjects.jsx     👈 [Mega Infrastructure Projects Tracker]
    │   └── AddProjectModal.jsx       👈 [Project Registration with Instant ML Assessment]
    ├── App.jsx
    └── index.css
```

---

## 🚀 Quickstart & How to Run

### 1. Backend Setup & Startup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
*Backend API available at: `http://127.0.0.1:8001`*
*Interactive OpenAPI documentation available at: `http://127.0.0.1:8001/docs`*

### 2. Frontend Startup
```bash
npm install
npm run dev
```
*Frontend Portal available at: `http://localhost:5173`*

During local development, the frontend sends `/api` requests through the Vite
proxy to `http://127.0.0.1:8001`, avoiding browser CORS issues. If the backend
uses another address or port, set `PAIMANA_BACKEND_URL` before starting Vite.
For a separately hosted frontend, set `VITE_API_BASE_URL` to the backend API
base URL (including `/api`) when building the frontend.

### Deploy frontend and backend together on Render

The repository includes a Render Blueprint and Dockerfile for a single Free
web service. The Docker image builds the React frontend and serves it from
FastAPI; the frontend calls the API through the same origin. The Blueprint
generates a stable authentication secret and stores SQLite at
`/var/data/paimana.db` on the service's ephemeral filesystem. The local
`backend/paimana.db` is excluded from Git and the Docker build context because
it contains Ministry account records and password hashes. On first startup,
the service creates a fresh database and imports projects from the bundled CSV.

This Free configuration is intended for scheduled SIH demonstrations, not
persistent operation. Render may spin down the service after 15 minutes without
traffic, and its filesystem is reset on spin-down, restart, or redeploy. Any
Ministry accounts, added projects, predictions, alerts, notifications, and
alert responses created at runtime may therefore be lost. Keep demo data
recreatable and reinitialize it after a restart when needed.

1. Push this repository to GitHub.
2. In Render, select **New → Blueprint**, connect the repository, and deploy
   the `render.yaml` Blueprint. It creates one Free Web Service and no
   persistent disk. Configure a private Admin username and password hash when
   prompted. The Blueprint disables the public demo Admin and Ministry accounts.
3. To enable Ministry sign-in, configure one initial account with
   `PAIMANA_DEMO_USERNAME`, `PAIMANA_DEMO_PASSWORD`, and
   `PAIMANA_DEMO_MINISTRY` as private environment variables before the service
   starts. The Ministry value must match the project catalog. The app creates
   this account on startup; keep the username unique and do not reuse a demo
   account name.
4. Wait for the `/api/health` check to pass, then open the service URL. The Free
   service can take about a minute to start after an idle spin-down.

The CSV project dataset is included in the image and is imported into the fresh
SQLite database when the service starts. The existing local SQLite database is
not deployed. To enable live Gemini responses, add `GEMINI_API_KEY` in the
Render service environment settings.

Before deploying, generate the Admin password hash locally with:

```bash
cd backend
python set_admin_password.py
```

Set `PAIMANA_ADMIN_USERNAME` and the printed `PAIMANA_ADMIN_PASSWORD_HASH` as
private Render environment variables. The Admin password is verified by
FastAPI using PBKDF2-HMAC-SHA256 and is never included in the frontend bundle.
Admin login returns a short-lived signed bearer token kept in tab-scoped
session storage. `POST /api/projects`, `POST /api/alerts/dispatch`, and
`POST /api/sync-csv` require that Admin token. Ministry login continues using
its separate bearer-token flow and ministry-scoped alert dispatch endpoint.

For local development, demo Admin and Ministry accounts are enabled by default.
Production deployments set `PAIMANA_ENVIRONMENT=production` and disable both
demo account types. The demo-credentials endpoint then returns no credentials,
and demo Ministry accounts left in an existing database cannot sign in.

### 3. Live LLM Assistant
The assistant always has a database-grounded local response engine. To enable live Google Gemini responses, set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) before starting the backend. The model defaults to `gemini-2.0-flash`; override it with `GEMINI_MODEL` when required. Check `GET /api/chat/status` to verify the active mode.

### 4. Ministry API authentication
The backend stores ministry users, dispatched alerts, and notifications in
SQLite. `POST /api/auth/login` accepts `{"username","password"}` and returns a
bearer token. Use that token with `GET /api/auth/me`,
`GET /api/ministry/projects`, `GET /api/ministry/alerts`, and
`GET/PATCH /api/notifications` (the PATCH path is
`/api/notifications/{id}/read`). `POST /api/ministry/alerts/dispatch` creates
a persistent alert and notifications for active users in the ministry.
Ministry users can acknowledge an alert with
`POST /api/ministry/alerts/{id}/acknowledge`, submit a validated response with
`POST /api/ministry/alerts/{id}/action` using
`{"action_taken":"...","remarks":"..."}`, approve that submitted action with
`POST /api/ministry/alerts/{id}/approve`, and explicitly resolve an approved
alert through `PATCH /api/ministry/alerts/{id}/status` with
`{"status":"RESOLVED"}`. The response lifecycle is
`DISPATCHED → ACKNOWLEDGED → ACTION_TAKEN → APPROVED → RESOLVED`; viewing an
alert remains independent from acknowledgement. Acknowledgement, action,
approval, and resolution are stored on the original alert record.
`GET /api/ministry/summary` includes persisted `action_required_count`,
`pending_approval_count`, and `pending_resolution_count` values. All response
endpoints derive Ministry ownership from the authenticated user and reject
alerts outside that Ministry. The dispatch/read `status` is kept separate from
`response_status`; a general alert status alone cannot mark the Ministry
response as resolved. Legacy resolved records without a recorded approval are
reopened to their latest persisted response stage during database initialization.

No production account is seeded by default. For an additional disposable local demo account, set
`PAIMANA_DEMO_USERNAME`, `PAIMANA_DEMO_PASSWORD`, and
`PAIMANA_DEMO_MINISTRY` before starting the backend. Set
`PAIMANA_AUTH_SECRET` in deployments so tokens remain valid across restarts.

For SIH jury demonstrations, the backend seeds one designated Ministry demo
account. Its credentials are intentionally published in the Ministry Login
screen and at `GET /api/demo/ministry-credentials`. These shared demo
credentials are for evaluation only and must not be used in production or
with real ministry data. Existing Ministry accounts in SQLite are not removed.

---

## 📊 Dataset Ingestion
The backend loads the bundled `backend/data/projects.csv` by default. Override
the source with `PAIMANA_DATASET_PATH` when required. On first startup, the
backend imports the CSV into SQLite and trains the Scikit-learn predictive
models.
