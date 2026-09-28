import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, CheckCircle2, ChevronRight, Layers3,
  CircleDot, LogOut, Search, ShieldAlert, SlidersHorizontal,
  UserCircle, X
} from "lucide-react";
import { MinistryDashboardHeader } from "./Header";
import AiPredictModal from "./AiPredictModal";
import { API_BASE } from "../api";
import "./MinistryPortal.css";

const authToken = () => localStorage.getItem("ministry_token") || "";
const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("ministry_user") || "null");
  } catch {
    return null;
  }
};
const unwrap = (payload, key) => Array.isArray(payload) ? payload : (payload?.[key] || []);
const money = (value) => value == null || value === "" ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
const date = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const riskClass = (value = "") => String(value).toLowerCase().replace(/\s+/g, "-");
const risk = (project) => project.risk_level || "Unclassified";
const responseStatus = (alert) => alert.response_status || "DISPATCHED";
const responseStatusLabel = (alert) => responseStatus(alert).replace(/_/g, " ");
const alertDisplayStatus = (alert) => responseStatusLabel(alert);

async function call(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${authToken()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 401) {
    localStorage.removeItem("ministry_token");
    localStorage.removeItem("ministry_user");
    window.location.replace("/ministry/login");
    throw new Error("Your ministry session has expired.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "Could not load ministry data.");
  return payload;
}

function DetailModal({
  detail,
  onClose,
  projectById,
  notifications,
  onViewRelatedProject,
  onUpdateAlertStatus,
  onAcknowledgeAlert,
  onSubmitAlertAction,
  onApproveAction,
}) {
  const [actionTaken, setActionTaken] = useState("");
  const [remarks, setRemarks] = useState("");
  const [responseError, setResponseError] = useState("");
  const [responseSubmitting, setResponseSubmitting] = useState(false);
  if (!detail) return null;
  const isAlert = detail.kind === "alert";
  const item = detail.data;
  const project = isAlert ? projectById[item.project_id] : item;
  const field = (label, value) => <div className="ministry-detail-field" key={label}><small>{label}</small><strong>{value ?? "—"}</strong></div>;
  const response = isAlert ? responseStatus(item) : "";
  const isActionRequired = isAlert && Boolean(item.action_required);
  const acknowledge = async () => {
    setResponseError("");
    setResponseSubmitting(true);
    try {
      await onAcknowledgeAlert(item.id);
    } catch (submitError) {
      setResponseError(submitError.message);
    } finally {
      setResponseSubmitting(false);
    }
  };
  const submitAction = async (event) => {
    event.preventDefault();
    const normalizedAction = actionTaken.trim();
    if (!normalizedAction) {
      setResponseError("Action Taken cannot be empty.");
      return;
    }
    setResponseError("");
    setResponseSubmitting(true);
    try {
      await onSubmitAlertAction(item.id, normalizedAction, remarks.trim());
    } catch (submitError) {
      setResponseError(submitError.message);
    } finally {
      setResponseSubmitting(false);
    }
  };
  const approveAction = async () => {
    setResponseError("");
    setResponseSubmitting(true);
    try {
      await onApproveAction(item.id);
    } catch (submitError) {
      setResponseError(submitError.message);
    } finally {
      setResponseSubmitting(false);
    }
  };
  return <div className="ministry-modal-backdrop" onClick={onClose}>
    <article className="ministry-detail-modal" onClick={(event) => event.stopPropagation()}>
      <button className="ministry-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <p className="ministry-eyebrow">{isAlert ? "Official alert detail" : "Project detail"}</p>
      <h2>{isAlert ? `${item.alert_type || "Official alert"} · #${item.id}` : (item.project_name || "Project")}</h2>
      <div className="ministry-detail-grid">
        {isAlert ? <>
          {field("Alert ID", item.id)}
          {field("Project", project?.project_name || item.project_id)}
          {field("Project ID", item.project_id)}
          {field("Ministry", item.ministry)}
          {field("Sector", project?.sector)}
          {field("State", project?.state)}
          {field("Risk level", project?.risk_level)}
          {field("Risk score", project?.risk_score == null ? "—" : `${project.risk_score}%`)}
          {field("Priority", item.severity)}
          {field("Alert type", item.alert_type)}
          {field("Alert status", alertDisplayStatus(item))}
          {field("Dispatch/read status", item.status)}
          {field("Dispatched", date(item.dispatched_at || item.created_at))}
          {field("Recipient role", item.recipient_role)}
          {field("Notification status", notifications.some((notification) => notification.alert_id === item.id && !notification.is_read) ? "Unread" : "Read or not delivered")}
          <div className="ministry-detail-wide">{field("Message", item.message)}</div>
          <div className="ministry-response-panel ministry-detail-wide">
            <p className="ministry-eyebrow">Ministry response</p>
            <div className={`ministry-response-status ${isActionRequired ? "pending" : ""}`}>
              {isActionRequired ? "ACTION REQUIRED" : alertDisplayStatus(item)}
            </div>
            {field("Acknowledged by", item.acknowledged_by_username)}
            {field("Acknowledged at", date(item.acknowledged_at))}
            {["ACTION_TAKEN", "APPROVED", "RESOLVED"].includes(response) ? <>
              {field("Action Taken", item.action_taken)}
              {field("Remarks", item.remarks || "—")}
              {field("Action Taken at", date(item.action_taken_at))}
              {field("Response submitted by", item.action_taken_by_username || item.acknowledged_by_username)}
              {["APPROVED", "RESOLVED"].includes(response) && <>
                {field("Action approval", "APPROVED")}
                {field("Approved by", item.action_approved_by_username)}
                {field("Approved at", date(item.action_approved_at))}
              </>}
              {response === "RESOLVED" && field("Resolved at", date(item.response_resolved_at))}
            </> : null}
            {responseError && <p className="ministry-response-error" role="alert">{responseError}</p>}
            {isActionRequired && response === "DISPATCHED" && (
              <button type="button" className="ministry-primary-button ministry-response-button" onClick={acknowledge} disabled={responseSubmitting}>
                {responseSubmitting ? "Acknowledging…" : "ACKNOWLEDGE ALERT"}
              </button>
            )}
            {response === "ACKNOWLEDGED" && (
              <form className="ministry-action-form" onSubmit={submitAction} noValidate>
                <label htmlFor="ministry-action-taken">Action Taken <span aria-hidden="true">*</span></label>
                <textarea
                  id="ministry-action-taken"
                  value={actionTaken}
                  onChange={(event) => { setActionTaken(event.target.value); setResponseError(""); }}
                  maxLength={2000}
                  rows={3}
                  required
                  aria-invalid={Boolean(responseError)}
                />
                <label htmlFor="ministry-action-remarks">Remarks <small>(optional)</small></label>
                <textarea
                  id="ministry-action-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  maxLength={4000}
                  rows={2}
                />
                <button type="submit" className="ministry-primary-button ministry-response-button" disabled={responseSubmitting}>
                  {responseSubmitting ? "Submitting…" : "SUBMIT ACTION TAKEN"}
                </button>
              </form>
            )}
            {response === "ACTION_TAKEN" && (
              <button type="button" className="ministry-primary-button ministry-response-button" onClick={approveAction} disabled={responseSubmitting}>
                {responseSubmitting ? "Approving…" : "APPROVE ACTION TAKEN"}
              </button>
            )}
            {response === "APPROVED" && item.status !== "RESOLVED" && (
              <button type="button" className="ministry-primary-button ministry-response-button" onClick={() => onUpdateAlertStatus(item.id, "RESOLVED")} disabled={responseSubmitting}>
                RESOLVE ALERT
              </button>
            )}
          </div>
          {item.status === "DISPATCHED" && <button type="button" className="ministry-link-button" onClick={() => onUpdateAlertStatus(item.id, "READ")}>Mark alert as read</button>}
          <button className="ministry-related-project-button" onClick={() => onViewRelatedProject(item.project_id)}>
            View related project <ChevronRight size={15} />
          </button>
        </> : <>
          {field("Project ID", item.project_id)}
          {field("Project name", item.project_name)}
          {field("Ministry", item.ministry)}
          {field("Sector", item.sector)}
          {field("State", item.state)}
          {field("Agency", item.agency)}
          {field("Original cost", money(item.original_cost))}
          {field("Revised cost", money(item.revised_cost))}
          {field("Expenditure", money(item.expenditure_to_date))}
          {field("Physical progress", item.physical_progress == null ? "—" : `${item.physical_progress}%`)}
          {field("Delay", item.delay_months == null ? "—" : `${item.delay_months} months`)}
          {field("Risk score", item.risk_score == null ? "—" : `${item.risk_score}%`)}
          {field("Risk level", item.risk_level)}
          {field("Alert status", item.alert_status || "No dispatched alert")}
          {field("Response status", item.response_status || "No response")}
          <div className="ministry-detail-wide">{field("Primary risk reason", item.primary_risk_reason)}</div>
        </>}
      </div>
    </article>
  </div>;
}

export default function MinistryPortal() {
  const [user, setUser] = useState(storedUser);
  const [summary, setSummary] = useState({});
  const [sectors, setSectors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ sector: "ALL", state: "ALL", risk: "ALL", alert: "ALL" });
  const [sort, setSort] = useState("risk_desc");
  const [projectPage, setProjectPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const projectById = useMemo(() => Object.fromEntries(projects.map((project) => [project.project_id, project])), [projects]);
  const latestAlertByProject = useMemo(() => alerts.reduce((latest, alert) => {
    const current = latest[alert.project_id];
    if (!current || `${alert.dispatched_at}-${alert.id}` > `${current.dispatched_at}-${current.id}`) latest[alert.project_id] = alert;
    return latest;
  }, {}), [alerts]);

  const loadUnread = async () => {
    const payload = await call("/ministry/notifications/unread-count");
    setUnreadCount(Number(payload.unread_count) || 0);
  };
  const loadData = async () => {
    setLoading(true);
    try {
      const [me, summaryData, sectorData, projectData, alertData, historyData, notificationData, unreadData] = await Promise.all([
        call("/auth/me"), call("/ministry/summary"), call("/ministry/sectors"),
        call("/ministry/projects"), call("/ministry/alerts"), call("/ministry/alert-history"), call("/notifications"),
        call("/ministry/notifications/unread-count"),
      ]);
      setUser(me);
      localStorage.setItem("ministry_user", JSON.stringify(me));
      setSummary(summaryData || {});
      setSectors(unwrap(sectorData, "sectors"));
      setProjects(unwrap(projectData, "projects"));
      setAlerts(unwrap(alertData, "alerts"));
      setAlertHistory(unwrap(historyData, "alerts"));
      setNotifications(unwrap(notificationData, "notifications"));
      setUnreadCount(Number(unreadData.unread_count) || Number(notificationData.unread_count) || 0);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadData(); }, []);

  const enrichedProjects = useMemo(() => projects.map((project) => ({
    ...project,
    alert_status: latestAlertByProject[project.project_id]?.status || "No alert",
    response_status: latestAlertByProject[project.project_id]
      ? responseStatusLabel(latestAlertByProject[project.project_id])
      : "No alert",
  })), [projects, latestAlertByProject]);
  const states = useMemo(() => [...new Set(projects.map((project) => project.state).filter(Boolean))].sort(), [projects]);
  const sectorNames = useMemo(() => [...new Set(projects.map((project) => project.sector).filter(Boolean))].sort(), [projects]);
  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = enrichedProjects.filter((project) => {
      const matchesSearch = !query || `${project.project_id} ${project.project_name} ${project.sector} ${project.state}`.toLowerCase().includes(query);
      const matchesSector = filters.sector === "ALL" || project.sector === filters.sector;
      const matchesState = filters.state === "ALL" || project.state === filters.state;
      const matchesRisk = filters.risk === "ALL" || risk(project).toLowerCase() === filters.risk.toLowerCase();
      const matchesAlert = filters.alert === "ALL" || filters.alert === project.alert_status || filters.alert === project.response_status;
      return matchesSearch && matchesSector && matchesState && matchesRisk && matchesAlert;
    });
    return result.sort((a, b) => {
      if (sort === "name") return String(a.project_name || "").localeCompare(String(b.project_name || ""));
      if (sort === "cost_desc") return Number(b.revised_cost || 0) - Number(a.revised_cost || 0);
      return Number(b.risk_score || 0) - Number(a.risk_score || 0);
    });
  }, [enrichedProjects, filters, search, sort]);
  const projectsPerPage = 50;
  const projectPageCount = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage));
  const visibleProjects = filteredProjects.slice(
    (projectPage - 1) * projectsPerPage,
    projectPage * projectsPerPage,
  );
  useEffect(() => {
    setProjectPage(1);
  }, [search, filters, sort]);
  const highRiskProjects = enrichedProjects.filter((project) => String(project.risk_level).toLowerCase() === "high");
  const activeAlerts = summary.active_alerts ?? alerts.length;

  const navigate = (section, options = {}) => {
    setActiveSection(section);
    setMenuOpen(false);
    if (section === "projects" && !options.preserveFilters) {
      setFilters((current) => ({ ...current, sector: "ALL" }));
    }
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (section === "notifications") loadUnread().catch(() => {});
  };
  const logout = () => {
    localStorage.removeItem("ministry_token");
    localStorage.removeItem("ministry_user");
    window.location.replace("/admin/login");
  };
  const markRead = async (notificationId) => {
    try {
      await call(`/notifications/${notificationId}/read`, { method: "POST" });
      setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, is_read: 1 } : item));
      await loadUnread();
    } catch (actionError) { setError(actionError.message); }
  };
  const openNotification = async (notification) => {
    await markRead(notification.id);
    const alert = alerts.find((item) => String(item.id) === String(notification.alert_id));
    if (alert) setDetail({ kind: "alert", data: alert });
  };
  const markAllRead = async () => {
    try {
      await call("/notifications/read-all", { method: "POST" });
      setNotifications((items) => items.map((item) => ({ ...item, is_read: 1 })));
      await loadUnread();
    } catch (actionError) { setError(actionError.message); }
  };
  const openAlert = (alert) => setDetail({ kind: "alert", data: alert });
  const updateAlertStatus = async (alertId, status) => {
    try {
      const payload = await call(`/ministry/alerts/${alertId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const replace = (items) => items.map((item) => item.id === alertId ? payload.alert : item);
      setAlerts(replace);
      setAlertHistory(replace);
      setDetail({ kind: "alert", data: payload.alert });
      const summaryData = await call("/ministry/summary");
      setSummary(summaryData);
    } catch (actionError) {
      setError(actionError.message);
    }
  };
  const persistAlertResponse = async (alertId, path, options) => {
    const payload = await call(`/ministry/alerts/${alertId}/${path}`, options);
    const replace = (items) => items.map((item) => item.id === alertId ? payload.alert : item);
    setAlerts(replace);
    setAlertHistory(replace);
    setDetail({ kind: "alert", data: payload.alert });
    setSummary(await call("/ministry/summary"));
  };
  const acknowledgeAlert = (alertId) => persistAlertResponse(
    alertId,
    "acknowledge",
    { method: "POST" },
  );
  const submitAlertAction = (alertId, actionTaken, actionRemarks) => persistAlertResponse(
    alertId,
    "action",
    {
      method: "POST",
      body: JSON.stringify({ action_taken: actionTaken, remarks: actionRemarks }),
    },
  );
  const approveAlertAction = (alertId) => persistAlertResponse(
    alertId,
    "approve",
    { method: "POST" },
  ).catch((actionError) => setError(actionError.message));
  const openProject = (project) => setDetail({ kind: "project", data: project });
  const viewRelatedProject = async (projectId) => {
    try {
      const payload = await call(`/ministry/projects/${encodeURIComponent(projectId)}`);
      setDetail({
        kind: "project",
        data: {
          ...payload.project,
          alert_status: latestAlertByProject[payload.project.project_id]?.status || "No alert",
          response_status: latestAlertByProject[payload.project.project_id]
            ? responseStatusLabel(latestAlertByProject[payload.project.project_id])
            : "No response",
        },
      });
    } catch (actionError) {
      setError(actionError.message);
    }
  };

  const renderPage = () => {
    switch (activeSection) {
      case "projects":
        return <section className="ministry-page ministry-panel">
          <div className="ministry-panel-title"><div><p className="ministry-eyebrow">Portfolio inventory</p><h2>All projects</h2><p>Every project belonging to the authenticated ministry, including alerted projects.</p></div><span className="ministry-count">{filteredProjects.length} / {projects.length}</span></div>
          <div className="ministry-filters"><div className="ministry-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, ID, sector or state" /></div><select value={filters.sector} onChange={(event) => setFilters({ ...filters, sector: event.target.value })}><option value="ALL">All sectors</option>{sectorNames.map((name) => <option key={name}>{name}</option>)}</select><select value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value })}><option value="ALL">All states</option>{states.map((name) => <option key={name}>{name}</option>)}</select><select value={filters.risk} onChange={(event) => setFilters({ ...filters, risk: event.target.value })}><option value="ALL">All risk levels</option><option>High</option><option>Medium</option><option>Low</option></select><select value={filters.alert} onChange={(event) => setFilters({ ...filters, alert: event.target.value })}><option value="ALL">All alert status</option><option value="DISPATCHED">Dispatched</option><option value="READ">Read</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="ACTION TAKEN">Action Taken</option><option value="APPROVED">Approved</option><option value="RESOLVED">Resolved</option><option value="No alert">No alert</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="risk_desc">Sort: risk score</option><option value="name">Sort: project name</option><option value="cost_desc">Sort: revised cost</option></select><SlidersHorizontal size={17} className="filter-icon" /></div>
          <div className="ministry-table-wrap"><table><thead><tr><th>Project</th><th>Sector</th><th>State</th><th>Ministry</th><th>Risk</th><th>Value</th><th>Delay</th><th>Alert</th><th>Response</th></tr></thead><tbody>{visibleProjects.map((project) => <tr key={project.project_id} onClick={() => openProject(project)}><td><strong>{project.project_name}</strong><small>{project.project_id}</small></td><td>{project.sector || "—"}</td><td>{project.state || "—"}</td><td>{project.ministry || user?.ministry || "—"}</td><td><span className={`project-status ${riskClass(risk(project))}`}>{risk(project)} · {project.risk_score ?? "—"}%</span></td><td>{money(project.revised_cost)}</td><td>{project.delay_months == null ? "—" : `${project.delay_months} mo`}</td><td><span className={`alert-tag ${project.alert_status === "DISPATCHED" ? "dispatched" : ""}`}>{project.alert_status}</span></td><td>{project.response_status}</td></tr>)}</tbody></table>{!filteredProjects.length && <div className="ministry-empty">No projects match the selected filters.</div>}</div>
          {filteredProjects.length > projectsPerPage && <div className="ministry-pagination"><button className="ministry-link-button" type="button" onClick={() => setProjectPage((page) => Math.max(1, page - 1))} disabled={projectPage === 1}>Previous</button><span>Page {Math.min(projectPage, projectPageCount)} of {projectPageCount}</span><button className="ministry-link-button" type="button" onClick={() => setProjectPage((page) => Math.min(projectPageCount, page + 1))} disabled={projectPage >= projectPageCount}>Next</button></div>}
        </section>;
      case "sectors":
        return <section className="ministry-page ministry-panel"><div className="ministry-panel-title"><div><p className="ministry-eyebrow">Hierarchy</p><h2>{user?.ministry} sectors</h2><p>Derived from projects assigned to your authenticated ministry.</p></div></div>
          {!sectors.length ? <div className="ministry-empty">No sectors are currently assigned.</div> : <div className="sector-cards">{sectors.map((sector) => <article className="sector-card" key={sector.name}><div className="sector-card-head"><span className="sector-dot" /><h3>{sector.name}</h3></div><div className="sector-metrics"><span><b>{sector.project_count}</b> projects</span><span><b>{sector.high_risk}</b> high</span><span><b>{sector.medium_risk}</b> medium</span><span><b>{sector.low_risk}</b> low</span><span><b>{sector.active_alerts}</b> alerts</span></div><button className="ministry-link-button" onClick={() => { setFilters((current) => ({ ...current, sector: sector.name })); navigate("projects", { preserveFilters: true }); }}>View projects <ChevronRight size={15} /></button></article>)}</div>}
        </section>;
      case "alerts":
        return <section className="ministry-page ministry-panel"><div className="ministry-panel-title"><div><p className="ministry-eyebrow">Official alerts · lifecycle history</p><h2>Official alerts</h2><p>Every persisted dispatch record, including response and resolution history.</p></div><span className="ministry-count">{alertHistory.length}</span></div><AlertList alerts={alertHistory} projectById={projectById} onOpen={openAlert} /></section>;
      case "notifications":
        return <section className="ministry-page ministry-panel"><div className="ministry-panel-title"><div><p className="ministry-eyebrow">Personal inbox</p><h2>Notifications</h2><p>Notifications delivered to {user?.username}.</p></div>{unreadCount > 0 && <button className="ministry-text-button" onClick={markAllRead}>Mark all as read</button>}</div>{!notifications.length ? <div className="ministry-empty">No notifications have been delivered.</div> : <div className="notification-list">{notifications.map((notification) => { const alert = alerts.find((item) => String(item.id) === String(notification.alert_id)); const project = alert && projectById[alert.project_id]; return <button key={notification.id} className={`ministry-notification ${!notification.is_read ? "unread" : ""}`} onClick={() => openNotification(notification)}><Bell size={16} /><span><strong>{notification.title || "Portfolio notification"}</strong><small>Notification #{notification.id} · Alert #{notification.alert_id || "—"} · Project {alert?.project_id || "—"}{project?.project_name ? ` · ${project.project_name}` : ""}</small><small>{notification.message}</small><em>Created {date(notification.created_at)} · Dispatched {date(alert?.dispatched_at || alert?.created_at)} · {notification.is_read ? "Read" : "Unread"}</em></span></button>; })}</div>}</section>;
      case "high-risk":
        return <section className="ministry-page ministry-panel"><div className="ministry-panel-title"><div><p className="ministry-eyebrow">Risk watch</p><h2>High-risk projects</h2><p>High-risk projects from your ministry portfolio only.</p></div><span className="ministry-count">{highRiskProjects.length}</span></div><ProjectMiniList projects={highRiskProjects} onOpen={openProject} /></section>;
      case "profile":
        return <section className="ministry-page ministry-panel"><div className="ministry-panel-title"><div><p className="ministry-eyebrow">Authenticated profile</p><h2>Profile</h2></div></div><div className="profile-card"><UserCircle size={36} /><div><strong>{user?.username}</strong><span>{user?.ministry}</span><small>Authenticated ministry user</small></div></div></section>;
      default:
        return <section className="ministry-page">
          <div className="ministry-section-heading"><div><p className="ministry-eyebrow">Overview</p><h2>Portfolio command centre</h2></div></div>
          <div className="ministry-kpis">
            {[
              ["Total projects", summary.total_projects ?? projects.length, Activity],
              ["High risk", summary.high_risk ?? 0, ShieldAlert],
              ["Medium risk", summary.medium_risk ?? 0, AlertTriangle],
              ["Low risk", summary.low_risk ?? 0, CheckCircle2],
              ["Active official alerts", activeAlerts, Bell],
              ["Unread notifications", unreadCount, Bell],
              ["Dispatched alerts", alerts.length, ShieldAlert],
              ["Action required", summary.action_required_count ?? 0, AlertTriangle],
            ].map(([label, value, Icon]) => (
              <div className={`ministry-kpi ${riskClass(label)}`} key={label}>
                <div className="ministry-kpi-icon"><Icon size={19} /></div>
                <div><span>{label}</span><strong>{value}</strong></div>
              </div>
            ))}
          </div>
          <PendingActions alerts={alerts.filter((alert) => alert.action_required)} count={summary.action_required_count ?? 0} projectById={projectById} onOpen={openAlert} onAcknowledge={acknowledgeAlert} />
          <ActionReviewQueue alerts={alerts.filter((alert) => ["ACTION_TAKEN", "APPROVED"].includes(responseStatus(alert)))} counts={{ approval: summary.pending_approval_count ?? 0, resolution: summary.pending_resolution_count ?? 0 }} projectById={projectById} onOpen={openAlert} onApprove={approveAlertAction} onResolve={updateAlertStatus} />
          <RecentAlerts alerts={alerts.slice(0, 3)} projectById={projectById} notifications={notifications} onOpenAlert={openAlert} onOpenProject={viewRelatedProject} onViewAll={() => navigate("alerts")} />
          <section className="ministry-panel ministry-overview-panel"><div className="ministry-panel-title"><div><p className="ministry-eyebrow">Portfolio hierarchy</p><h2>{user?.ministry} sectors</h2><p>Select a sector to view its projects.</p></div><button className="ministry-link-button" onClick={() => navigate("sectors")}>View all sectors <ChevronRight size={15} /></button></div><div className="sector-cards">{sectors.slice(0, 4).map((sector) => <article className="sector-card" key={sector.name}><div className="sector-card-head"><span className="sector-dot" /><h3>{sector.name}</h3></div><div className="sector-metrics"><span><b>{sector.project_count}</b> projects</span><span><b>{sector.active_alerts}</b> alerts</span></div><button className="ministry-link-button" onClick={() => { setFilters((current) => ({ ...current, sector: sector.name })); navigate("projects", { preserveFilters: true }); }}>View projects <ChevronRight size={15} /></button></article>)}</div></section>
        </section>;
    }
  };

  if (loading) return <div className="ministry-loading-screen">Loading ministry workspace…</div>;
  return <div className="ministry-portal">
    <MinistryDashboardHeader
      ministryName={user?.ministry}
      projectCount={summary.total_projects}
      projects={projects}
      unreadCount={unreadCount}
      onOpenReports={() => setReportsOpen(true)}
      onOpenNotifications={() => navigate("notifications")}
      onOpenProfile={() => navigate("profile")}
      onToggleMenu={() => setMenuOpen((open) => !open)}
    />
    <div className="ministry-layout">
      <aside className={menuOpen ? "ministry-sidebar open" : "ministry-sidebar"}>
        <div className="ministry-sidebar-title">Ministry workspace</div>
        {[
          ["overview", "Overview", Activity], ["projects", "All Projects", Search], ["sectors", "Sectors", Layers3],
          ["alerts", "Official Alerts", ShieldAlert], ["notifications", "Notifications", Bell],
          ["high-risk", "High Risk Projects", AlertTriangle], ["profile", "Profile", UserCircle],
        ].map(([id, label, Icon]) => <button key={id} className={activeSection === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={16} />{label}{id === "notifications" && unreadCount > 0 && <b>{unreadCount}</b>}</button>)}
        <button className="ministry-sidebar-logout" onClick={logout}><LogOut size={16} /> Logout</button>
      </aside>
      <main className="ministry-main">
      <div className="ministry-welcome"><div><p className="ministry-eyebrow">Ministry workspace</p><h1>{user?.ministry || "Ministry workspace"}</h1><p className="ministry-muted">Live delivery performance and risk signals across your ministry.</p></div><div className="ministry-live"><CircleDot size={14} /> Live data</div></div>
      {error && <div className="ministry-banner"><AlertTriangle size={17} /> {error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></div>}
      <div key={activeSection} className="ministry-page-swap">{renderPage()}</div>
      </main>
    </div>
    <DetailModal key={detail ? `${detail.kind}-${detail.data.id || detail.data.project_id}` : "closed"} detail={detail} onClose={() => setDetail(null)} projectById={projectById} notifications={notifications} onViewRelatedProject={viewRelatedProject} onUpdateAlertStatus={updateAlertStatus} onAcknowledgeAlert={acknowledgeAlert} onSubmitAlertAction={submitAlertAction} onApproveAction={approveAlertAction} />
    <AiPredictModal isOpen={reportsOpen} onClose={() => setReportsOpen(false)} />
  </div>;
}

function AlertList({ alerts, projectById, onOpen }) {
  if (!alerts.length) return <div className="ministry-empty"><CheckCircle2 size={22} /> No persisted official alerts.</div>;
  return <div className="alert-history-list">{alerts.map((alert) => {
    const project = projectById[alert.project_id];
    const lifecycle = [
      `DISPATCHED ${date(alert.dispatched_at || alert.created_at)}`,
      alert.acknowledged_at && `ACKNOWLEDGED ${date(alert.acknowledged_at)}`,
      alert.action_taken_at && `ACTION TAKEN ${date(alert.action_taken_at)}`,
      alert.action_approved_at && `APPROVED ${date(alert.action_approved_at)}`,
      alert.response_resolved_at && `RESOLVED ${date(alert.response_resolved_at)}`,
    ].filter(Boolean).join(" → ");
    return <button className="ministry-alert-row" key={alert.id} onClick={() => onOpen(alert)}><span className={`alert-severity ${riskClass(alert.severity || "high")}`}><AlertTriangle size={15} /></span><span><strong>{alert.alert_type || "Official alert"} · {project?.project_name || alert.project_id}</strong><small>#{alert.id} · {alert.project_id} · {project?.sector || "—"} · {project?.state || "—"} · {project?.risk_level || alert.severity || "—"} · Alert: {alert.status || "—"} · Response: {alertDisplayStatus(alert)}</small><em>{lifecycle}</em><em>{alert.message}</em></span><ChevronRight size={17} /></button>;
  })}</div>;
}

function RecentAlerts({ alerts, projectById, notifications, onOpenAlert, onOpenProject, onViewAll }) {
  return <section className="ministry-panel ministry-recent-alerts">
    <div className="ministry-panel-title"><div><p className="ministry-eyebrow">Persisted workflow records</p><h2>Recent official alerts</h2><p>Latest official alerts delivered to your authenticated ministry.</p></div><button className="ministry-link-button" onClick={onViewAll}>View all alerts <ChevronRight size={15} /></button></div>
    {!alerts.length ? <div className="ministry-empty"><CheckCircle2 size={22} /> No persisted official alerts.</div> : <div className="ministry-recent-alert-list">{alerts.map((alert) => {
      const project = projectById[alert.project_id];
      const unread = notifications.some((notification) => String(notification.alert_id) === String(alert.id) && !notification.is_read);
      return <article className={`ministry-recent-alert ${unread ? "unread" : ""}`} key={alert.id}>
        <div className="ministry-recent-alert-marker">{unread ? "NEW" : "ALERT"}</div>
        <div className="ministry-recent-alert-content"><strong>{project?.project_name || alert.project_name || alert.project_id}</strong><span>{alert.project_id} · {alert.ministry} · {alert.sector || project?.sector || "—"} · {alert.state || project?.state || "—"}</span><span>Risk: {alert.risk_level || project?.risk_level || "—"}{alert.risk_score == null && project?.risk_score == null ? "" : ` · ${alert.risk_score ?? project?.risk_score}%`} · Status: {alertDisplayStatus(alert)}</span><small>Dispatched {date(alert.dispatched_at || alert.created_at)}</small><div><button className="ministry-link-button" onClick={() => onOpenAlert(alert)}>View alert</button><button className="ministry-link-button" onClick={() => onOpenProject(alert.project_id)}>View project</button></div></div>
      </article>;
    })}</div>}
  </section>;
}

function PendingActions({ alerts, count, projectById, onOpen, onAcknowledge }) {
  return <section className="ministry-panel ministry-action-required">
    <div className="ministry-panel-title">
      <div>
        <p className="ministry-eyebrow">Ministry response workflow</p>
        <h2>ACTION REQUIRED</h2>
        <p>Alerts awaiting acknowledgement or a submitted action.</p>
      </div>
      <span className="ministry-count">{count}</span>
    </div>
    {!alerts.length ? <div className="ministry-empty"><CheckCircle2 size={22} /> No pending Ministry actions.</div> : (
      <div className="ministry-pending-list">
        {alerts.map((alert) => {
          const project = projectById[alert.project_id];
          return <article className="ministry-pending-card" key={alert.id}>
            <div className="ministry-pending-project">
              <span>Alert #{alert.id} · {alert.project_id}</span>
              <strong>{alert.project_name || project?.project_name || alert.project_id}</strong>
              <small>{alert.sector || project?.sector || "—"} · {alert.state || project?.state || "—"}</small>
            </div>
            <div className="ministry-pending-meta">
              <span>Risk: <strong>{alert.risk_level || project?.risk_level || alert.severity || "—"}</strong>{alert.risk_score == null ? "" : ` · ${alert.risk_score}%`}</span>
              <span>Alert: <strong>{alert.status}</strong></span>
              <span>Action: <strong>{responseStatus(alert)}</strong></span>
              <small>Dispatched {date(alert.dispatched_at || alert.created_at)}</small>
            </div>
            <div className="ministry-pending-actions">
              <button type="button" className="ministry-link-button" onClick={() => onOpen(alert)}>View alert</button>
              {responseStatus(alert) === "DISPATCHED" && (
                <button type="button" className="ministry-primary-button ministry-pending-ack" onClick={() => onAcknowledge(alert.id)}>Acknowledge</button>
              )}
            </div>
          </article>;
        })}
      </div>
    )}
  </section>;
}

function ActionReviewQueue({ alerts, counts, projectById, onOpen, onApprove, onResolve }) {
  return <section className="ministry-panel ministry-action-required">
    <div className="ministry-panel-title">
      <div>
        <p className="ministry-eyebrow">Ministry review workflow</p>
        <h2>Action approval &amp; resolution</h2>
        <p>Review submitted actions, then explicitly resolve approved alerts.</p>
      </div>
      <span className="ministry-count">{counts.approval + counts.resolution}</span>
    </div>
    {!alerts.length ? <div className="ministry-empty"><CheckCircle2 size={22} /> No actions are awaiting review or resolution.</div> : (
      <div className="ministry-pending-list">
        {alerts.map((alert) => {
          const project = projectById[alert.project_id];
          const response = responseStatus(alert);
          return <article className="ministry-pending-card" key={alert.id}>
            <div className="ministry-pending-project">
              <span>Alert #{alert.id} · {alert.project_id}</span>
              <strong>{alert.project_name || project?.project_name || alert.project_id}</strong>
              <small>{alert.sector || project?.sector || "—"} · {alert.state || project?.state || "—"}</small>
            </div>
            <div className="ministry-pending-meta">
              <span>Risk: <strong>{alert.risk_level || project?.risk_level || alert.severity || "—"}</strong>{alert.risk_score == null ? "" : ` · ${alert.risk_score}%`}</span>
              <span>Response: <strong>{response.replace(/_/g, " ")}</strong></span>
              <small>Submitted {date(alert.action_taken_at)}</small>
            </div>
            <div className="ministry-pending-actions">
              <button type="button" className="ministry-link-button" onClick={() => onOpen(alert)}>View alert</button>
              {response === "ACTION_TAKEN" && <button type="button" className="ministry-primary-button ministry-pending-ack" onClick={() => onApprove(alert.id)}>Approve action</button>}
              {response === "APPROVED" && <button type="button" className="ministry-primary-button ministry-pending-ack" onClick={() => onResolve(alert.id, "RESOLVED")}>Resolve alert</button>}
            </div>
          </article>;
        })}
      </div>
    )}
  </section>;
}

function ProjectMiniList({ projects, onOpen }) {
  if (!projects.length) return <div className="ministry-empty"><CheckCircle2 size={22} /> No high-risk projects.</div>;
  return <div className="mini-project-list">{projects.map((project) => <button key={project.project_id} onClick={() => onOpen(project)}><span><strong>{project.project_name}</strong><small>{project.project_id} · {project.sector} · {project.state}</small></span><b>{project.risk_score ?? "—"}%</b><ChevronRight size={16} /></button>)}</div>;
}
