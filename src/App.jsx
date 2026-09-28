import React, { useState } from "react";
import { useEffect } from "react";

import Header from "./components/Header";
import HeroBanner from "./components/HeroBanner";
import MinistryDashboard from "./components/MinistryDashboard";
import StateMapSection from "./components/StateMapSection";
import HighValueProjects from "./components/HighValueProjects";
import PerformanceMonitoring from "./components/PerformanceMonitoring";
import AddProjectModal from "./components/AddProjectModal";
import AiPredictModal from "./components/AiPredictModal";
import Footer from "./components/Footer";
import Login from "./components/Login";
import MinistryPortal from "./components/MinistryPortal";

import "./App.css";
import { ADMIN_TOKEN_KEY, API_BASE } from "./api";

function DashboardApp() {
  /* =========================================================
     AUTHENTICATION
     ========================================================= */

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAdminSession, setCheckingAdminSession] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      setCheckingAdminSession(false);
      return undefined;
    }

    fetch(`${API_BASE}/auth/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Admin session expired");
        setIsAuthenticated(true);
      })
      .catch(() => {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      })
      .finally(() => setCheckingAdminSession(false));
    return undefined;
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setIsAuthenticated(false);
    window.location.replace("/");
  };


  /* =========================================================
     MAIN TAB STATE
     
     1. project-monitoring
     2. performance-monitoring
     3. high-value-projects
     4. state-map
     ========================================================= */

  const [currentTab, setCurrentTab] =
    useState("project-monitoring");

  const [selectedProjectForAnalysis, setSelectedProjectForAnalysis] =
    useState(null);

  const [performanceModule, setPerformanceModule] =
    useState("predictive-engine");

  const [isAddModalOpen, setIsAddModalOpen] =
    useState(false);

  const [isReportModalOpen, setIsReportModalOpen] =
    useState(false);


  /* =========================================================
     TAB NAVIGATION
     ========================================================= */

  const handleTabChange = (tab) => {

    setCurrentTab(tab);

    if (tab === "performance-monitoring") {
      setPerformanceModule("predictive-engine");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };


  /* =========================================================
     PROJECT → AI ANALYSIS
     ========================================================= */

  const handleNavigateToAnalysis = (project) => {

    setSelectedProjectForAnalysis(project);

    setPerformanceModule("predictive-engine");

    setCurrentTab("performance-monitoring");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };


  /* =========================================================
     LOGIN
     ========================================================= */

  if (checkingAdminSession) return null;

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */

  return (
    <div className="app-root">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <Header
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        onNavigateToAnalysis={handleNavigateToAnalysis}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onLogout={handleLogout}
      />


      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <main className="main-content">


        {/* ===================================================
            TAB 1
            CENTRALIZED MONITORING
            =================================================== */}

        {currentTab === "project-monitoring" && (

          <div
            className="
              view-container
              project-view
              animate-fade-in
            "
          >

            <HeroBanner />

            <MinistryDashboard />

          </div>

        )}


        {/* ===================================================
            TAB 2
            AI PRIOR RISK PREDICTION
            =================================================== */}

        {currentTab === "performance-monitoring" && (

          <div
            className="
              view-container
              performance-view
              animate-fade-in
            "
          >

            <PerformanceMonitoring
              initialProject={
                selectedProjectForAnalysis
              }

              initialModule={
                performanceModule
              }
            />

          </div>

        )}


        {/* ===================================================
            TAB 3
            HIGH VALUE MEGA PROJECTS
            =================================================== */}

        {currentTab === "high-value-projects" && (

          <div
            className="
              view-container
              high-value-view
              animate-fade-in
            "
          >

            <HighValueProjects
              onNavigateToAnalysis={
                handleNavigateToAnalysis
              }
            />

          </div>

        )}


        {/* ===================================================
            TAB 4
            STATE-WISE INFRASTRUCTURE MAP
            =================================================== */}

        {currentTab === "state-map" && (

          <div
            className="
              view-container
              state-map-view
              animate-fade-in
            "
          >

            <StateMapSection />

          </div>

        )}


      </main>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <Footer />


      {/* =====================================================
          ADD PROJECT MODAL
          ===================================================== */}

      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() =>
          setIsAddModalOpen(false)
        }
      />


      {/* =====================================================
          AI REPORT MODAL
          ===================================================== */}

      <AiPredictModal
        isOpen={isReportModalOpen}
        onClose={() =>
          setIsReportModalOpen(false)
        }
      />

    </div>
  );
}

function MinistryRoute() {
  const [checking, setChecking] = useState(window.location.pathname !== "/ministry/login");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (window.location.pathname === "/ministry/login") {
      return undefined;
    }
    const storedToken = localStorage.getItem("ministry_token");
    if (!storedToken) {
      window.location.replace("/ministry/login");
      return undefined;
    }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Session expired");
        return response.json();
      })
      .then((user) => {
        if (!user?.id || !user?.ministry) throw new Error("Invalid session");
        localStorage.setItem("ministry_user", JSON.stringify(user));
        setAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem("ministry_token");
        localStorage.removeItem("ministry_user");
        window.location.replace("/ministry/login");
      })
      .finally(() => setChecking(false));
    return undefined;
  }, []);

  if (window.location.pathname === "/ministry/login") return <Login initialMode="ministry" />;
  if (checking) return <div className="ministry-loading-screen">Validating ministry session…</div>;
  return authenticated ? <MinistryPortal /> : null;
}

function AdminLoginRoute() {
  return <Login onLogin={() => window.location.replace("/")} />;
}

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/ministry")) return <MinistryRoute />;
  if (path === "/admin" || path.startsWith("/admin/")) return <AdminLoginRoute />;
  return <DashboardApp />;
}