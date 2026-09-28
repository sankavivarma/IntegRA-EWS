import React from "react";

import {
  Globe2,
  BarChart3,
  Plus,
  FileText,
  Grid2X2,
  Activity,
  Layers3,
  Map,
  LogOut,
  UserCircle,
  ChevronDown,
  Bell,
  Menu
} from "lucide-react";

import "./Header.css";

export default function Header({
  currentTab,
  onSelectTab,
  onNavigateToAnalysis,
  onOpenAddModal,
  onOpenReportModal,
  onLogout
}) {

  return (
    <>

      {/* =====================================================
          TOP UTILITY BAR
          ===================================================== */}

      <div className="top-utility-bar">

        <div className="utility-inner">

          <div className="government-label">
            <strong>IntegRA EWS</strong>
            <span>Integrated Risk Analysis Early Warning System</span>
          </div>

          <div className="utility-actions">

            <button className="utility-language">

              <Globe2 size={15} />

              ENG

              <span className="language-arrow">
                ▾
              </span>

            </button>

            <div className="projects-monitored">

              <BarChart3 size={16} />

              <strong>
                1,775
              </strong>

              PROJECTS MONITORED

            </div>

          </div>

        </div>

      </div>


      {/* =====================================================
          MAIN BRAND HEADER
          ===================================================== */}

      <header className="main-header">

        <div className="header-inner">

          <div className="integra-brand">

            <div className="integra-logo">

              <span className="logo-column logo-column-one"></span>

              <span className="logo-column logo-column-two"></span>

              <span className="logo-column logo-column-three"></span>

              <span className="logo-arrow">
                ↗
              </span>

            </div>

            <div className="integra-brand-text">

              <div className="integra-name">
                IntegRA <span>EWS</span>
              </div>

              <div className="integra-subtitle">
                INTEGRATED RISK ANALYSIS EARLY WARNING SYSTEM
              </div>

            </div>

          </div>


          {/* =================================================
              HEADER ACTIONS
              ================================================= */}

          <div className="header-actions">

            <button
              className="add-project-button"
              onClick={onOpenAddModal}
            >

              <Plus size={17} />

              ADD PROJECT / WHAT-IF

            </button>

            <button
              className="reports-button"
              onClick={onOpenReportModal}
            >

              <FileText size={17} />

              REPORTS & ANALYTICS

            </button>

            {onLogout && (

              <button
                className="logout-button"
                onClick={onLogout}
                title="Logout"
              >

                <LogOut size={17} />

              </button>

            )}

          </div>

        </div>

      </header>


      {/* =====================================================
          PRIMARY NAVIGATION — 4 MAIN TABS
          ===================================================== */}

      <nav className="primary-navigation">

        <div className="primary-navigation-inner">


          {/* =================================================
              TAB 1 — CENTRALIZED MONITORING
              ================================================= */}

          <button
            className={`primary-nav-item ${
              currentTab === "project-monitoring"
                ? "selected"
                : ""
            }`}
            onClick={() =>
              onSelectTab("project-monitoring")
            }
          >

            <Grid2X2 size={18} />

            <span>
              Centralized Monitoring
            </span>

            <small>
              (1,775 Projects)
            </small>

          </button>


          {/* =================================================
              TAB 2 — AI PRIOR RISK PREDICTION
              ================================================= */}

          <button
            className={`primary-nav-item ${
              currentTab === "performance-monitoring"
                ? "selected"
                : ""
            }`}
            onClick={() =>
              onSelectTab("performance-monitoring")
            }
          >

            <Activity size={19} />

            <span>
              AI Prior Risk Prediction
            </span>

            <small>
              & Notifications
            </small>

          </button>


          {/* =================================================
              TAB 3 — HIGH VALUE MEGA PROJECTS
              ================================================= */}

          <button
            className={`primary-nav-item ${
              currentTab === "high-value-projects"
                ? "selected"
                : ""
            }`}
            onClick={() =>
              onSelectTab("high-value-projects")
            }
          >

            <Layers3 size={19} />

            <span>
              High Value Mega Projects
            </span>

          </button>


          {/* =================================================
              TAB 4 — STATE-WISE INFRASTRUCTURE MAP
              ================================================= */}

          <button
            className={`primary-nav-item ${
              currentTab === "state-map"
                ? "selected"
                : ""
            }`}
            onClick={() =>
              onSelectTab("state-map")
            }
          >

            <Map size={19} />

            <span>
              State-Wise Infrastructure Map
            </span>

          </button>

        </div>

      </nav>


      {/* =====================================================
          LIVE AI ALERT TICKER
          ===================================================== */}

      <div className="live-alert-ticker">

        <div className="live-alert-label">

          <span className="live-alert-icon">
            ◈
          </span>

          LIVE AI PREDICTIVE ALERT

        </div>

        <div className="ticker-track">

          <div className="ticker-item">
            <strong>Live Portfolio:</strong>
            <span>All project risk indicators are synchronized with the latest backend data</span>
          </div>
          <span className="ticker-separator">•</span>
          <div className="ticker-item">
            <strong>AI Monitoring:</strong>
            <span>Continuous sector, ministry and state-level analysis is active</span>
          </div>

        </div>

      </div>

    </>
  );
}

export function MinistryDashboardHeader({
  ministryName,
  projectCount,
  projects = [],
  unreadCount = 0,
  onOpenReports,
  onOpenNotifications,
  onOpenProfile,
  onToggleMenu,
}) {
  const tickerProjects = projects
    .filter((project) => project.risk_level && Number.isFinite(Number(project.risk_score)))
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score))
    .slice(0, 12);
  const formattedProjectCount = Number(projectCount || 0).toLocaleString("en-IN");

  const renderTickerGroup = (duplicate = false) => (
    <div className="ministry-ticker-group" aria-hidden={duplicate || undefined}>
      {tickerProjects.map((project) => {
        const riskLevel = String(project.risk_level).toLowerCase();
        const reason = project.primary_risk_reason
          || `Recorded risk score ${Math.round(Number(project.risk_score))}%`;
        return (
          <React.Fragment key={project.project_id}>
            <div className="ministry-ticker-item">
              <span className={`ministry-ticker-dot ${riskLevel}`} />
              <strong>{project.project_id}</strong>
              <span className={`ministry-ticker-risk ${riskLevel}`}>
                {riskLevel.toUpperCase()} RISK
              </span>
              <span>{reason}{project.state ? ` in ${project.state}` : ""}</span>
            </div>
            <span className="ministry-ticker-separator">|</span>
          </React.Fragment>
        );
      })}
      {!tickerProjects.length && (
        <div className="ministry-ticker-item">
          <strong>{ministryName}</strong>
          <span>No risk-scored project signals are currently available.</span>
        </div>
      )}
    </div>
  );

  return (
    <header className="ministry-site-header">
      <div className="ministry-utility-bar">
        <div className="ministry-site-header-inner government-label">
          <div className="ministry-utility-brand">
            <strong>IntegRA EWS</strong>
            <span>Integrated Risk Analysis Early Warning System</span>
          </div>
          <div className="utility-actions">
            <button type="button" className="utility-language">
              ENG <span className="language-arrow">▾</span>
            </button>
            <div
              className="projects-monitored"
              aria-label={`${formattedProjectCount} Ministry projects monitored`}
            >
              <BarChart3 size={16} />
              <strong>{formattedProjectCount}</strong>
              PROJECTS MONITORED
            </div>
          </div>
        </div>
      </div>
      <div className="ministry-brand-header">
        <div className="ministry-site-header-inner ministry-brand-header-inner">
          <div className="integra-brand">
            <div className="integra-logo">
              <span className="logo-column logo-column-one" />
              <span className="logo-column logo-column-two" />
              <span className="logo-column logo-column-three" />
              <span className="logo-arrow">↗</span>
            </div>
            <div className="integra-brand-text">
              <div className="integra-name">IntegRA <span>EWS</span></div>
              <div className="integra-subtitle">
                INTEGRATED RISK ANALYSIS EARLY WARNING SYSTEM
              </div>
            </div>
          </div>
          <div className="ministry-brand-actions">
            <button type="button" className="reports-button" onClick={onOpenReports}>
              <FileText size={17} />
              REPORTS &amp; ANALYTICS
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              className="ministry-account-button"
              onClick={onOpenProfile}
              aria-label={`Ministry profile: ${ministryName}`}
            >
              <UserCircle size={34} />
              <span>{ministryName || "Ministry account"}</span>
              <ChevronDown size={15} />
            </button>
            <button
              type="button"
              className="ministry-header-notifications"
              onClick={onOpenNotifications}
              aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            >
              <Bell size={19} />
              {unreadCount > 0 && <b>{unreadCount}</b>}
            </button>
            <button
              type="button"
              className="ministry-menu"
              onClick={onToggleMenu}
              aria-label="Menu"
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
      </div>
      <div className="ministry-live-alert-ticker" aria-label="Live Ministry risk signals">
        <div className="ministry-live-alert-label">
          <span className="live-alert-icon">◈</span>
          LIVE AI PREDICTIVE ALERT
        </div>
        <div className="ministry-ticker-window">
          <div className={`ministry-ticker-track ${tickerProjects.length ? "" : "ministry-ticker-static"}`}>
            {renderTickerGroup()}
            {tickerProjects.length > 0 && renderTickerGroup(true)}
          </div>
        </div>
      </div>
    </header>
  );
}