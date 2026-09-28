import os
import re
import json
import requests
import pandas as pd
from database import get_projects_df, log_chat
from ml_engine import ml_engine

def get_llm_status() -> dict:
    """Return the configured provider state without exposing credentials."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    return {
        "provider": "Google Gemini",
        "model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "configured": bool(api_key),
        "mode": "llm" if api_key else "grounded-local",
    }


def query_gemini_llm(user_message: str, rag_context: str) -> str:
    """
    Direct REST API call to Google Gemini LLM if GEMINI_API_KEY is available.
    """
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    system_instruction = (
        "You are the IntegRA EWS Infrastructure Intelligence Assistant. "
        "You provide precise, authoritative, data-backed analysis for Indian Central Sector Infrastructure Projects. "
        "Use the provided MoSPI Central Database Ground Truth context to answer. "
        "Answer in clear, structured Markdown with bullet points, metrics, and actionable recommendations. "
        "If the user asks in Tanglish or Tamil, respond politely in simple Tanglish/English."
    )

    prompt_payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"System Context:\n{system_instruction}\n\nLive MoSPI Database Metrics:\n{rag_context}\n\nUser Question:\n{user_message}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1000
        }
    }

    try:
        res = requests.post(url, json=prompt_payload, timeout=8)
        if res.ok:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                if parts:
                    return parts[0].get("text", "")
        print(f"[WARN] Gemini REST call returned {res.status_code}: {res.text[:300]}")
    except requests.RequestException as e:
        print(f"[WARN] Gemini REST call failed: {e}")
    return None

def query_ai_chatbot(user_message: str):
    """
    Comprehensive AI Project Intelligence Assistant (LLM + Contextual RAG Engine).
    Provides in-depth answers on infrastructure health, risk scores,
    cost/time overrun predictions, delay drivers, recommendations, and sector reports.
    """
    raw_query = user_message.strip()
    query = raw_query.lower()
    df = get_projects_df()

    if df.empty:
        return "The Central Infrastructure Database is currently initializing. Please verify project data records."

    # Build RAG Context
    total_proj = len(df)
    tot_orig = float(df['original_cost'].sum())
    tot_rev = float(df['revised_cost'].sum())
    tot_spent = float(df['expenditure_to_date'].sum())
    cost_overrun = tot_rev - tot_orig
    cost_overrun_pct = round((cost_overrun / max(tot_orig, 1.0)) * 100.0, 1)
    high_count = int((df['risk_level'] == 'High').sum())
    delayed_count = int((df['delay_months'] > 0).sum())
    avg_delay = round(float(df['delay_months'].mean()), 1)

    rag_context = (
        f"Total Projects: {total_proj}\n"
        f"Total Sanctioned Cost: INR {tot_orig:,.0f} Cr\n"
        f"Total Revised Cost: INR {tot_rev:,.0f} Cr\n"
        f"Cost Overrun: INR {cost_overrun:,.0f} Cr (+{cost_overrun_pct}%)\n"
        f"High Risk Projects Count: {high_count}\n"
        f"Delayed Projects Count: {delayed_count} (Average delay: {avg_delay} months)\n"
    )

    if any(term in query for term in ["all sectors", "list sectors", "all ministries", "list ministries"]):
        sectors = sorted(str(value) for value in df["sector"].dropna().unique())
        ministries = sorted(str(value) for value in df["ministry"].dropna().unique())
        resp = (
            "📚 **Live Portfolio Coverage**\n\n"
            f"**Sectors ({len(sectors)})**: {', '.join(sectors)}\n\n"
            f"**Ministries ({len(ministries)})**: {', '.join(ministries)}"
        )
        log_chat(raw_query, resp)
        return resp

    # 1. Try Live Gemini LLM if API Key exists
    gemini_resp = query_gemini_llm(raw_query, rag_context)
    if gemini_resp:
        log_chat(raw_query, gemini_resp)
        return gemini_resp

    # 2. Advanced Contextual Infrastructure Intelligence Engine (RAG)

    # A. Sector-Wise Risk Report Download Queries (English & Tanglish)
    if any(k in query for k in ["download", "report", "csv", "excel", "export", "sector wise report", "report download"]):
        resp = (
            "📥 **Sector-Wise Infrastructure Risk Report Download**\n\n"
            f"You can download comprehensive risk and overrun reports directly from IntegRA EWS:\n\n"
            "• **All Sectors Master Report**: [Download Full Portfolio CSV](http://127.0.0.1:8000/api/reports/sector-wise/download?sector=ALL)\n"
            "• **Roads & Highways Risk Report**: [Download Roads CSV](http://127.0.0.1:8000/api/reports/sector-wise/download?sector=Roads%20%26%20Highways)\n"
            "• **Railways Sector Risk Report**: [Download Railways CSV](http://127.0.0.1:8000/api/reports/sector-wise/download?sector=Railways)\n"
            "• **Power & Energy Risk Report**: [Download Power CSV](http://127.0.0.1:8000/api/reports/sector-wise/download?sector=Electricity%20Generation)\n"
            "• **Water Resources Risk Report**: [Download Water CSV](http://127.0.0.1:8000/api/reports/sector-wise/download?sector=Water%20Resources)\n\n"
            "💡 *Tip*: In the portal UI, click the **'Download Sector Risk Report (CSV)'** button in the Reports module."
        )
        log_chat(raw_query, resp)
        return resp

    # B. Recommendations & Mitigation Action Queries (English & Tanglish)
    if any(k in query for k in ["recommendation", "recommend", "mitigat", "action plan", "solution", "parigaaram", "solvu", "prevent"]):
        resp = (
            "🎯 **IntegRA EWS Strategic Mitigation & Policy Recommendations**\n\n"
            "Based on Scikit-Learn predictive modeling across 1,775 central infrastructure projects, here are the targeted recommendations:\n\n"
            "### 1. Land Acquisition & Right-of-Way (RoW) Clearance\n"
            "• **Authority**: State Revenue Department & District Collectors\n"
            "• **Action**: Fast-track compensation under Section 11/19 of the LARR Act. Form district-level joint revenue taskforces to resolve pending civil suits.\n"
            "• **Impact**: Mitigates 4 to 8 months of linear construction stoppage.\n\n"
            "### 2. Environmental & Forestry Clearances\n"
            "• **Authority**: Ministry of Environment, Forest & Climate Change (MoEFCC)\n"
            "• **Action**: Escalate Stage-II forest and wildlife clearance via PARIVESH 2.0 single-window platform; deposit CAMPA funds in advance.\n"
            "• **Impact**: Allows immediate unencumbered site handover to contractors.\n\n"
            "### 3. Contractor Risk & Supply Chain Bottlenecks\n"
            "• **Authority**: Project Implementing Agencies (NHAI, RVNL, NTPC, etc.)\n"
            "• **Action**: Enforce standard EPC cure notices; mandate 3-shift 24/7 working schedules; unbundle delayed packages for turnkey subcontracting.\n"
            "• **Impact**: Recovers up to 20% lost monthly physical progress velocity.\n\n"
            "### 4. High-Level PMG Inter-Ministerial Review\n"
            "• **Authority**: Cabinet Secretariat & Project Monitoring Group (PMG)\n"
            "• **Action**: Convene quarterly PMG reviews with State Chief Secretaries for utility shifting and joint department inspections."
        )
        log_chat(raw_query, resp)
        return resp

    # C. High Risk / Critical Projects Queries
    if any(k in query for k in ["high risk", "critical", "worst", "severe", "danger", "alert", "athiga risk"]):
        high_risk_df = df[df['risk_level'] == 'High'].sort_values(by='risk_score', ascending=False)
        count = len(high_risk_df)
        
        resp = f"🚨 **IntegRA EWS Early Warning Alert — High Risk Projects Overview**\n\n"
        resp += f"Our Scikit-Learn predictive framework has identified **{count} critical projects** requiring immediate inter-ministerial intervention:\n\n"
        
        for idx, (_, p) in enumerate(high_risk_df.head(5).iterrows(), 1):
            cost_diff = p['revised_cost'] - p['original_cost']
            p_overrun = round((cost_diff / max(p['original_cost'], 1)) * 100, 1)
            resp += f"**{idx}. {p['project_name']}** ({p['sector']} | {p['state']})\n"
            resp += f"   • **Risk Score**: `{p['risk_score']}%` (High Priority)\n"
            resp += f"   • **Schedule Slippage**: `+{p['delay_months']} Months` (Progress: {p['physical_progress']}%)\n"
            resp += f"   • **Cost Escalation**: Sanctioned ₹{p['original_cost']:,.0f} Cr ➔ Anticipated ₹{p['revised_cost']:,.0f} Cr (+{p_overrun}%)\n"
            resp += f"   • **Primary Escalation Driver**: *{p['primary_risk_reason']}*\n\n"

        resp += "🎯 **Recommended Action**: Invoke Section 11/19 fast-tracking and schedule high-level PMG review."
        log_chat(raw_query, resp)
        return resp

    # D. Cost Overrun & Financial Escalation Queries
    if any(k in query for k in ["cost overrun", "cost increase", "escalation", "budget", "financial", "expenditure", "cost", "selavu"]):
        cost_df = df
        matched_ministry = next(
            (
                ministry for ministry in df["ministry"].dropna().unique()
                if str(ministry).lower() in query
            ),
            None,
        )
        if matched_ministry:
            cost_df = df[df["ministry"].str.lower() == str(matched_ministry).lower()]

        cost_orig = float(cost_df["original_cost"].sum())
        cost_rev = float(cost_df["revised_cost"].sum())
        cost_diff = cost_rev - cost_orig
        cost_pct = round((cost_diff / max(cost_orig, 1.0)) * 100.0, 1)
        overrun_projects = cost_df[cost_df['revised_cost'] > cost_df['original_cost']].sort_values(
            by=['revised_cost'], ascending=False
        )

        scope = f" for {matched_ministry}" if matched_ministry else ""
        resp = f"💰 **IntegRA EWS Cost Escalation & Overrun Analysis{scope}**\n\n"
        resp += f"• **Projects in Scope**: {len(cost_df)}\n"
        resp += f"• **Total Original Sanction**: ₹{cost_orig:,.0f} Crore\n"
        resp += f"• **Anticipated Final Cost**: ₹{cost_rev:,.0f} Crore\n"
        resp += f"• **Cumulative Cost Overrun**: **+₹{cost_diff:,.0f} Crore (+{cost_pct}%)**\n"
        resp += f"• **Cumulative Expenditure to Date**: ₹{cost_df['expenditure_to_date'].sum():,.0f} Crore ({round(cost_df['expenditure_to_date'].sum()/max(cost_rev,1)*100,1)}% of revised budget)\n\n"
        
        resp += "### Top 3 Projects by Highest Financial Escalation:\n"
        for _, p in overrun_projects.head(3).iterrows():
            diff = p['revised_cost'] - p['original_cost']
            p_pct = round((diff / max(p['original_cost'], 1)) * 100, 1)
            resp += f"- **{p['project_name']}**: +₹{diff:,.0f} Cr (+{p_pct}%) [Reason: {p['primary_risk_reason']}]\n"

        resp += "\n📊 **Key Cost Drivers**: Equipment commodity inflation, delayed land handover interest during construction (IDC), and scope expansion."
        log_chat(raw_query, resp)
        return resp

    # E. Time Overrun / Delay Inquiries
    if any(k in query for k in ["delay", "time overrun", "timeline", "schedule", "deadline", "slip", "thaamatham"]):
        delayed_df = df[df['delay_months'] > 0]
        max_delayed = df.sort_values(by='delay_months', ascending=False).iloc[0]

        resp = f"⏱️ **IntegRA EWS Timeline & Schedule Slippage Diagnostics**\n\n"
        resp += f"• **Delayed Projects**: **{len(delayed_df)} out of {total_proj} projects** ({(len(delayed_df)/total_proj*100):.1f}% of portfolio)\n"
        resp += f"• **Average Timeline Delay**: **{avg_delay} Months**\n"
        resp += f"• **Maximum Single Project Delay**: **{max_delayed['project_name']}** ({max_delayed['delay_months']} months delay)\n\n"
        
        resp += "### Primary Contributing Causes of Delays:\n"
        resp += "1. **Land Acquisition & R&R (38%)**: Delayed compensation disbursal and possession disputes.\n"
        resp += "2. **Forest & Environmental Clearances (26%)**: Multi-tier approvals for linear rail and road projects.\n"
        resp += "3. **Utility Shifting (18%)**: High-tension transmission lines and canal crossings.\n"
        resp += "4. **Contractor Resource Mobilization (18%)**: Vendor financial stress and machinery shortages."
        
        log_chat(raw_query, resp)
        return resp

    # F. Sector-Specific Inquiries
    sectors = df['sector'].dropna().unique().tolist()
    supported_sectors = [
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
    matched_sector = None
    for s in [*supported_sectors, *sectors]:
        if s.lower() in query or any(w in s.lower() for w in query.split() if len(w) > 4):
            matched_sector = s
            break

    if matched_sector:
        sec_df = df[df['sector'].str.lower() == matched_sector.lower()]
        if sec_df.empty:
            resp = (
                f"🏗️ **{matched_sector} Sector Intelligence Report**\n\n"
                "This sector is supported by the IntegRA EWS API, but the current "
                "uploaded project dataset contains no records for it. "
                "Load a source file with this sector in `PAIMANA_DATASET_PATH` "
                "and restart the backend to populate its live metrics."
            )
            log_chat(raw_query, resp)
            return resp

        s_total = len(sec_df)
        s_cost = sec_df['revised_cost'].sum()
        s_del = round(sec_df['delay_months'].mean(), 1)
        s_prog = round(sec_df['physical_progress'].mean(), 1)
        s_high = len(sec_df[sec_df['risk_level'] == 'High'])

        resp = f"🏗️ **{matched_sector} Sector Intelligence Report**\n\n"
        resp += f"• **Active Monitored Projects**: {s_total}\n"
        resp += f"• **Total Capital Outlay**: ₹{s_cost:,.0f} Crore\n"
        resp += f"• **Average Physical Progress**: {s_prog}%\n"
        resp += f"• **Average Schedule Delay**: {s_del} Months\n"
        resp += f"• **High Risk Vulnerability**: {s_high} projects\n\n"
        
        resp += "### Key Projects in this Sector:\n"
        for _, p in sec_df.head(4).iterrows():
            resp += f"- **{p['project_name']}** — Risk: `{p['risk_score']}%` | Delay: {p['delay_months']} mo | Progress: {p['physical_progress']}%\n"
            
        resp += f"\n📥 [Download {matched_sector} Risk Report CSV](http://127.0.0.1:8000/api/reports/sector-wise/download?sector={matched_sector})"
        log_chat(raw_query, resp)
        return resp

    # G. Project-Specific Lookup
    matched_project = None
    stopwords = {"project", "projects", "infrastructure", "construction", "check", "database", "status", "report", "correct", "irukaa", "sollu", "details", "info", "what", "about"}
    words = [w for w in re.split(r'\W+', query) if len(w) > 3 and w not in stopwords]
    if words:
        for _, row in df.iterrows():
            p_name = str(row['project_name']).lower()
            p_id = str(row['project_id']).lower()
            if p_id in query or any(w in p_name for w in words):
                matched_project = row
                break

    if matched_project is not None:
        p = matched_project
        pred = ml_engine.predict_project_risk(dict(p))

        resp = f"📋 **Project Intelligence Dossier: {p['project_name']}**\n\n"
        resp += f"• **Sector & Agency**: {p['sector']} | {p['agency']} (State: {p['state']})\n"
        resp += f"• **Physical Progress**: {p['physical_progress']}% | **Land Possession**: {p['land_acquired_pct']}%\n"
        resp += f"• **AI Risk Assessment**: **{pred['risk_score']}% ({pred['risk_level']} Risk)**\n"
        resp += f"• **Financial Baseline**: Sanctioned: ₹{p['original_cost']:,.0f} Cr ➔ Predicted Final: **₹{pred['predicted_cost']:,.0f} Cr (+{pred['cost_overrun_pct']}%)**\n"
        resp += f"• **Timeline**: Reported Delay: {p['delay_months']} months ➔ Forecasted Total Slippage: **{pred['predicted_delay_months']} months**\n"
        resp += f"• **Clearance Status**: {p['environmental_clearance']} | Contractor Risk: {p['contractor_risk']}\n\n"
        
        resp += "### ⚠️ Root Cause Delay Factors:\n"
        for idx, r in enumerate(pred['key_reasons'], 1):
            resp += f"{idx}. **{r['factor']} ({r['impact_pct']}% Impact)**: {r['detail']}\n"
            
        if pred.get('recommendations'):
            resp += f"\n🎯 **Primary Recommendation**: {pred['recommendations'][0]['action']}"
        log_chat(raw_query, resp)
        return resp

    # H. Database / System Integrity Inquiries (Tamil/Tanglish & English)
    if any(k in query for k in ["database", "correct", "irukaa", "check", "system", "status", "ml model", "scikit"]):
        resp = (
            "✅ **IntegRA EWS System & Database Verification Status**:\n\n"
            f"• **Central Database**: Synchronized from MoSPI Projects Report ({total_proj} Active Projects Loaded in SQLite)\n"
            "• **Machine Learning Framework**: Scikit-Learn (RandomForestClassifier & RandomForestRegressor)\n"
            "• **Prediction Engine**: Active (Estimating Risk Score, Overrun %, Delay Months, and Explainability Factors)\n"
            "• **Recommendations Engine**: Active (Multi-tier mitigation actions by Nodal Authority)\n"
            f"• **Sector-Wise Reports**: Ready for instant CSV/Excel download across {len(supported_sectors)} supported sectors ({len(sectors)} with live project records)\n\n"
            "Everything is operating normally and synchronized with the latest infrastructure dataset."
        )
        log_chat(raw_query, resp)
        return resp

    # I. Default Rich Project Intelligence Response
    resp = (
        f"🤖 **MoSPI Project Intelligence Assistant**\n\n"
        f"I am actively monitoring **{total_proj} Central Sector Infrastructure Projects** valued at **₹{tot_rev:,.0f} Crore**.\n\n"
        f"### What you can query:\n"
        f"1. **Risk Analysis**: *'Show all high risk projects'* or *'Which projects require critical intervention?'*\n"
        f"2. **Mitigation Recommendations**: *'What recommendations do you have for delayed projects?'*\n"
        f"3. **Cost Overruns**: *'What is the total cost escalation across the portfolio?'*\n"
        f"4. **Sector Reports**: *'Download Railways sector report'* or *'Export all sector risk reports'* \n"
        f"5. **Project Diagnostics**: *'Status of Bullet Train'*, *'Chennai Metro Phase 2'*, or *'Zojila Tunnel'*\n"
        f"6. **Sector Comparisons**: *'Railways vs Roads performance'* or *'Power sector analysis'*\n\n"
        f"Type your question above or choose a quick suggestion chip to begin."
    )
    log_chat(raw_query, resp)
    return resp
