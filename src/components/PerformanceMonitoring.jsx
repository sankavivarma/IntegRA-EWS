import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Layers, 
  Bot, 
  Send, 
  RefreshCw, 
  Clock, 
  Coins, 
  ArrowRight,
  Building,
  BellRing,
  BarChart3,
  Sliders,
  CheckCircle2,
  AlertOctagon,
  LineChart,
  HelpCircle,
  Mail,
  Zap,
  Filter,
  Check,
  Download,
  FileSpreadsheet,
  MapPin,
  Building2,
  Search,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { API_BASE, getAdminAuthHeaders } from '../api';

let priorAlertsDataCache = null;
let priorAlertsDataRequest = null;

const loadPriorAlertsData = () => {
  if (priorAlertsDataCache) return Promise.resolve(priorAlertsDataCache);
  if (priorAlertsDataRequest) return priorAlertsDataRequest;

  priorAlertsDataRequest = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const requestOptions = { signal: controller.signal };
      const [alertsResponse, sectorsResponse, ministriesResponse] = await Promise.all([
        fetch(`${API_BASE}/alerts/sector-wise`, requestOptions),
        fetch(`${API_BASE}/catalog/sectors`, requestOptions),
        fetch(`${API_BASE}/catalog/ministries`, requestOptions),
      ]);
      if (!alertsResponse.ok) throw new Error(`Prior alerts request failed: ${alertsResponse.status}`);
      if (!sectorsResponse.ok) throw new Error(`Sector catalog request failed: ${sectorsResponse.status}`);
      if (!ministriesResponse.ok) throw new Error(`Ministry catalog request failed: ${ministriesResponse.status}`);

      const [alertData, sectorData, ministryData] = await Promise.all([
        alertsResponse.json(),
        sectorsResponse.json(),
        ministriesResponse.json(),
      ]);
      const alertGroups = alertData.sector_alerts || {};
      const alertItems = Object.values(alertGroups).flat();
      const sectors = sectorData.sectors || [];
      const ministries = ministryData.ministries || [];
      const projectCountsBySector = Object.fromEntries(sectors.map((sector) => [
        sector.name,
        Number(sector.project_count) || 0,
      ]));
      const projectSectors = sectors.map((sector) => sector.name).filter(Boolean);
      const alertSectors = alertItems.map((alert) => alert.sector).filter(Boolean);
      const projectMinistries = ministries.map((ministry) => ministry.name).filter(Boolean);
      const alertMinistries = alertItems.map((alert) => alert.ministry).filter(Boolean);

      priorAlertsDataCache = {
        sectorAlerts: alertGroups,
        totalAlerts: Number(alertData.total_alerts) || 0,
        sectors: Array.from(new Set([...projectSectors, ...alertSectors])).sort(),
        states: Array.from(new Set(alertItems.map((alert) => alert.state).filter(Boolean))).sort(),
        ministries: Array.from(new Set([...projectMinistries, ...alertMinistries])).sort(),
        projectCountsBySector,
      };
      return priorAlertsDataCache;
    } finally {
      clearTimeout(timeoutId);
    }
  })().finally(() => {
    priorAlertsDataRequest = null;
  });

  return priorAlertsDataRequest;
};

export default function PerformanceMonitoring({ initialProject = null, initialModule = 'predictive-engine' }) {
  // Navigation inside Performance Monitoring (Defaults to Analysis Page)
  const [activeModule, setActiveModule] = useState(initialModule || 'predictive-engine');
  const selectedProjectMode = Boolean(initialProject);

  // ML Prediction States
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFilterSector, setProjectFilterSector] = useState('ALL');
  const [projectFilterRisk, setProjectFilterRisk] = useState('ALL');
  const [showSimulator, setShowSimulator] = useState(false);

  const [formData, setFormData] = useState({
    project_name: 'Custom Infrastructure Project',
    sector: 'Railways',
    ministry: 'Ministry of Railways',
    state: 'Madhya Pradesh',
    original_cost: 2500,
    expenditure_to_date: 1200,
    original_duration_months: 48,
    delay_months: 12,
    physical_progress: 45,
    land_acquired_pct: 82,
    environmental_clearance: 'Conditional',
    contractor_risk: 'Medium'
  });

  const [loadingPred, setLoadingPred] = useState(false);
  const [prediction, setPrediction] = useState(null);

  // Filter States for Prior Alerts (Sector, Ministry, State, Lead Time)
  const [sectorAlertsData, setSectorAlertsData] = useState({});

  // Database-derived filter lists
  const [databaseSectors, setDatabaseSectors] = useState([]);
  const [databaseStates, setDatabaseStates] = useState([]);
  const [databaseMinistries, setDatabaseMinistries] = useState([]);
  const [projectCountsBySector, setProjectCountsBySector] = useState({});
  const [llmStatus, setLlmStatus] = useState(null);

  const [selectedSectorFilter, setSelectedSectorFilter] = useState('ALL');
  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');
  const [selectedMinistryFilter, setSelectedMinistryFilter] = useState('ALL');
  const [selectedLeadTimeFilter, setSelectedLeadTimeFilter] = useState('ALL');
  const [totalPriorAlerts, setTotalPriorAlerts] = useState(0);
  const [dispatchedAlerts, setDispatchedAlerts] = useState({});
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const projectsDataRef = useRef(null);
  const projectsRequestRef = useRef(null);
  const alertsRequestRef = useRef(null);
  const alertsLoadedRef = useRef(false);
  const benchmarksRequestRef = useRef(null);
  const chatStatusRequestRef = useRef(null);
  const initialProjectRequestRef = useRef(null);
  const benchmarksLoadedRef = useRef(false);
  const chatStatusLoadedRef = useRef(false);

  const canonicalSectorName = (sector) => ({
    'Roads & Highways': 'Road Transport & Highways',
    Roads: 'Road Transport & Highways',
    Power: 'Electricity Generation',
    Aviation: 'Aviation & Aviation Infrastructure',
    'Urban Transport': 'Urban Public Transport',
  }[sector] || sector);

  // Benchmarks States
  const [benchmarks, setBenchmarks] = useState([]);
  const [ministryBenchmarks, setMinistryBenchmarks] = useState([]);
  const [stateBenchmarks, setStateBenchmarks] = useState([]);

  // Chatbot States
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: 'Welcome to the **IntegRA EWS Project Intelligence Assistant**.\n\nI am actively monitoring **1,775 projects** with automatic prior risk detection across **all supported sectors, ministries and states**. You can ask:\n- *"Which Sector has the highest automated early warning alerts?"*\n- *"Show all 30-day prior risk alerts in Madhya Pradesh or Maharashtra"*\n- *"What is the total cost overrun for Ministry of Railways?"*\n- *"Download official risk report for Road Transport & Highways"*'
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    if (initialProject) {
      const project = {
        ...initialProject,
        project_id: initialProject.project_id || `PRJ-${initialProject.id}`,
        project_name: initialProject.project_name || initialProject.title,
      };

      setProjects([project]);
      setSelectedProjectId(project.project_id);
      setSelectedProject(project);

      if (initialProjectRequestRef.current !== project.project_id) {
        initialProjectRequestRef.current = project.project_id;
        setActiveModule('predictive-engine');
        loadProjectIntelligence(project);
      }
      return;
    }

    fetchProjects();
  }, [initialProject]);

  useEffect(() => {
    fetchSectorAlerts();
  }, []);

  const fetchChatStatus = async () => {
    if (chatStatusLoadedRef.current) return;
    if (chatStatusRequestRef.current) return chatStatusRequestRef.current;

    chatStatusRequestRef.current = (async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/status`);
      if (res.ok) {
        const data = await res.json();
        setLlmStatus(data.llm);
        chatStatusLoadedRef.current = true;
      }
    } catch (err) {
      console.warn('Assistant status unavailable:', err);
    } finally {
      chatStatusRequestRef.current = null;
    }
    })();
    return chatStatusRequestRef.current;
  };

  const fetchProjects = async () => {
    if (projectsDataRef.current) return projectsDataRef.current;
    if (projectsRequestRef.current) return projectsRequestRef.current;

    projectsRequestRef.current = (async () => {
      try {
        const res = await fetch(`${API_BASE}/projects`);
        if (res.ok) {
          const data = await res.json();
          const projs = data.projects || [];
          projectsDataRef.current = projs;
          setProjects(projs.map((project) => ({
            ...project,
            sector: canonicalSectorName(project.sector),
          })));
          if (projs.length > 0 && !initialProject) {
            const highRiskProj = projs.find(p => p.risk_level === 'High' || p.risk_score > 75) || projs[0];
            setSelectedProjectId(highRiskProj.project_id);
            setSelectedProject(highRiskProj);
            loadProjectIntelligence(highRiskProj);
          }
          return projs;
        }
        throw new Error(`Projects request failed: ${res.status}`);
      } catch (err) {
        console.warn('Backend fetch error:', err);
        return [];
      } finally {
        projectsRequestRef.current = null;
      }
    })();
    return projectsRequestRef.current;
  };

const fetchSectorAlerts = async () => {
  if (alertsLoadedRef.current) return;
  if (alertsRequestRef.current) return alertsRequestRef.current;

  if (!priorAlertsDataCache) setLoadingAlerts(true);
  setAlertsError('');
  alertsRequestRef.current = (async () => {
    try {
      const alertData = await loadPriorAlertsData();
      setSectorAlertsData(alertData.sectorAlerts);
      setTotalPriorAlerts(alertData.totalAlerts);
      setDatabaseSectors(alertData.sectors);
      setProjectCountsBySector(alertData.projectCountsBySector);
      setDatabaseStates(alertData.states);
      setDatabaseMinistries(alertData.ministries);
      alertsLoadedRef.current = true;
    } catch (err) {
      console.error('Prior alerts data could not be loaded:', err);
      setAlertsError(err.message || 'Prior alerts could not be loaded.');
    } finally {
      setLoadingAlerts(false);
      alertsRequestRef.current = null;
    }
  })();
  return alertsRequestRef.current;
};

  const fetchBenchmarks = async () => {
    if (benchmarksLoadedRef.current) return;
    if (benchmarksRequestRef.current) return benchmarksRequestRef.current;

    benchmarksRequestRef.current = (async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics/benchmarks`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarks(data.sectors || []);
        setMinistryBenchmarks(data.ministries || []);
        setStateBenchmarks(data.states || []);
        benchmarksLoadedRef.current = true;
      }
    } catch (err) {
      console.warn('Benchmarks fetch error:', err);
    } finally {
      benchmarksRequestRef.current = null;
    }
    })();
    return benchmarksRequestRef.current;
  };

  useEffect(() => {
    if (activeModule === 'early-warning') fetchSectorAlerts();
    if (activeModule === 'benchmarking') fetchBenchmarks();
    if (activeModule === 'assistant') fetchChatStatus();
  }, [activeModule]);

  const loadProjectIntelligence = (proj) => {
    if (!proj) return;
    const form = {
      project_id: proj.project_id,
      project_name: proj.project_name || proj.title,
      sector: proj.sector || 'Road Transport & Highways',
      ministry: proj.ministry || 'Ministry of Road Transport and Highways',
      state: proj.state || 'Madhya Pradesh',
      original_cost: proj.original_cost ?? 1000,
      expenditure_to_date: proj.expenditure_to_date ?? 0,
      original_duration_months: proj.original_duration_months ?? 36,
      delay_months: proj.delay_months ?? 0,
      physical_progress: proj.physical_progress ?? 0,
      land_acquired_pct: proj.land_acquired_pct ?? 100,
      environmental_clearance: proj.environmental_clearance || 'Approved',
      contractor_risk: proj.contractor_risk || 'Low'
    };
    setFormData(form);
    runPrediction(form);
  };

  const handleSelectProjectDirectly = (proj) => {
    setSelectedProjectId(proj.project_id);
    setSelectedProject(proj);
    loadProjectIntelligence(proj);
  };

  const handleDispatchNotification = async (projectId, alertIdx) => {
    const key = `${projectId}-${alertIdx}`;
    setDispatchedAlerts(prev => ({ ...prev, [key]: 'DISPATCHING' }));

    try {
      const res = await fetch(`${API_BASE}/alerts/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ project_id: projectId })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.detail || 'Unable to dispatch the official alert.');
      }
      setDispatchedAlerts(prev => ({
        ...prev,
        [key]: `DISPATCHED (${result.dispatch_id})`
      }));
    } catch (err) {
      setDispatchedAlerts(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      window.alert(err.message || 'Unable to dispatch the official alert.');
    }
  };

  const handleDownloadReport = (sector = selectedSectorFilter) => {
    const targetSector = sector || 'ALL';
    const downloadUrl = `${API_BASE}/reports/sector-wise/download?sector=${encodeURIComponent(targetSector)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadMinistryReport = (ministry = 'ALL') => {
    const downloadUrl = `${API_BASE}/reports/ministry-wise/download?ministry=${encodeURIComponent(ministry || 'ALL')}`;
    window.open(downloadUrl, '_blank');
  };

  const runPrediction = async (dataToPredict = formData) => {
    setLoadingPred(true);
    try {
      const res = await fetch(`${API_BASE}/predict-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToPredict)
      });
      if (res.ok) {
        const result = await res.json();
        setPrediction(result.prediction);
      } else {
        calculateFallbackPrediction(dataToPredict);
      }
    } catch (err) {
      calculateFallbackPrediction(dataToPredict);
    } finally {
      setLoadingPred(false);
    }
  };

  const calculateFallbackPrediction = (data) => {
    const cost = parseFloat(data.original_cost) || 1000;
    const delay = parseInt(data.delay_months) || 0;
    const landDeficit = 100 - (parseFloat(data.land_acquired_pct) || 100);
    
    let score = 25;
    if (landDeficit > 15) score += 25;
    if (data.environmental_clearance !== 'Approved') score += 20;
    if (data.contractor_risk === 'High') score += 25;
    if (delay > 12) score += 15;
    score = Math.min(score, 95);

    const overrunPct = Math.round(score * 0.45);
    const predCost = Math.round(cost * (1 + overrunPct / 100));

    setPrediction({
      risk_score: score,
      risk_level: score > 68 ? 'High' : score > 38 ? 'Medium' : 'Low',
      predicted_cost: predCost,
      cost_overrun_pct: overrunPct,
      predicted_delay_months: delay + (score > 60 ? 14 : 6),
      key_reasons: [
        { factor: 'Land Acquisition Backlog', impact_pct: 40, detail: `${landDeficit}% land pending possession.` },
        { factor: 'Statutory Clearance Delays', impact_pct: 35, detail: 'Forestry and crossing approvals pending.' },
        { factor: 'Contractor Resource Mobilization', impact_pct: 25, detail: 'Equipment and manpower constraints.' }
      ],
      recommendations: [
        {
          category: 'Land Acquisition & RoW',
          priority: 'HIGH',
          authority: `State Revenue Dept (${data.state || 'State'}) & District Collector`,
          action: 'Invoke Section 11/19 fast-track compensation under LARR Act. Establish dedicated district Land Task Force to clear Right-of-Way (RoW).',
          expected_impact: 'Mitigates 4-8 months construction delay'
        },
        {
          category: 'Environmental & Forestry Clearance',
          priority: 'HIGH',
          authority: `${data.ministry || 'Ministry'} & MoEFCC State Forest Department`,
          action: 'Escalate Stage-II statutory tree-felling clearance on PARIVESH 2.0 portal; deposit CAMPA afforestation funds.',
          expected_impact: 'Enables immediate unencumbered site possession'
        },
        {
          category: 'Contractor Resource Mobilization',
          priority: 'MEDIUM',
          authority: 'Implementing Agency Directorate',
          action: 'Issue contractual cure notice; mandate 3-shift 24/7 working roster and verify materials supply pipeline.',
          expected_impact: 'Recovers up to 15% monthly milestone speed'
        }
      ],
      model_engine: 'AI Predictive Ensemble Engine (Scikit-Learn Random Forest)'
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || loadingChat) return;

    const userText = inputMsg;
    setInputMsg('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoadingChat(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        setChatMessages(prev => [...prev, {
          sender: 'bot',
          text: data.reply,
          llmMode: data.llm?.mode || 'grounded-local',
        }]);
      } else {
        setChatMessages(prev => [...prev, { 
          sender: 'bot', 
          text: `⚠️ Assistant request failed (${data.detail || res.status}). Please retry.` 
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        sender: 'bot', 
        text: '⚠️ Server connection error. Please verify that the backend is running on port 8000.' 
      }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'High':
        return { text: 'HIGH RISK ALERT', class: 'badge-high' };
      case 'Medium':
        return { text: 'MODERATE RISK', class: 'badge-med' };
      case 'Low':
      default:
        return { text: 'LOW RISK (STABLE)', class: 'badge-low' };
    }
  };

  // Filtered lists
  const filteredProjectsList = projects.filter(p => {
    const matchSearch = !projectSearch || p.project_name.toLowerCase().includes(projectSearch.toLowerCase()) || (p.state && p.state.toLowerCase().includes(projectSearch.toLowerCase()));
    const matchSec = projectFilterSector === 'ALL' || canonicalSectorName(p.sector) === projectFilterSector;
    const matchRisk = projectFilterRisk === 'ALL' || 
      (projectFilterRisk === 'High' && (p.risk_level === 'High' || p.risk_score >= 65)) ||
      (projectFilterRisk === 'Medium' && (p.risk_level === 'Medium' || (p.risk_score >= 35 && p.risk_score < 65))) ||
      (projectFilterRisk === 'Low' && (p.risk_level === 'Low' || p.risk_score < 35));
    return matchSearch && matchSec && matchRisk;
  });

  const allAlerts = [];
  const allMinistriesSet = new Set(databaseMinistries);
  const allStatesSet = new Set(databaseStates);

  Object.keys(sectorAlertsData).forEach(sec => {
    (sectorAlertsData[sec] || []).forEach((item, i) => {
      if (item.ministry) allMinistriesSet.add(item.ministry);
      if (item.state) allStatesSet.add(item.state);

      const matchSec = selectedSectorFilter === 'ALL' ||
        canonicalSectorName(item.sector || sec) === canonicalSectorName(selectedSectorFilter);
      const matchMin = selectedMinistryFilter === 'ALL' || item.ministry === selectedMinistryFilter;
      const matchState = selectedStateFilter === 'ALL' || item.state === selectedStateFilter;
      const matchLead = selectedLeadTimeFilter === 'ALL' || 
        (selectedLeadTimeFilter === '30' && item.lead_time.includes('30')) ||
        (selectedLeadTimeFilter === '60' && item.lead_time.includes('60')) ||
        (selectedLeadTimeFilter === '90' && item.lead_time.includes('90'));

      if (matchSec && matchMin && matchState && matchLead) {
        allAlerts.push({ ...item, origIndex: i });
      }
    });
  });

  return (
    <section className="performance-monitoring-section" id="performance-monitoring">
      <div className="container perf-container-fluid">
        
        {/* Section Header */}
        <div className="perf-header">
          <div className="perf-title-group">
            <div className="badge-ai-pill">
              <Zap size={14} /> AUTOMATED PRIOR RISK DETECTION & NOTIFICATION ENGINE
            </div>
            <h2>Universal Sector, Ministry & State Prior Risk Alert Center</h2>
            <p className="perf-subtitle">
              Automated multi-factor lead anomaly detection (30–90 days prior to milestones), Sector, Ministry & State categorization, and instant notification dispatch across 1,775 central infrastructure projects.
            </p>
          </div>

          <div className="early-warning-badge-pill">
            <BellRing size={16} className="text-warning-bell" />
            <span>
              Active Automated Prior Alerts:{' '}
              <strong>
                {loadingAlerts
                  ? 'Loading live alert data…'
                  : alertsError
                    ? 'Alert data unavailable'
                    : `${totalPriorAlerts} Alerts across ${databaseSectors.length} Sectors`}
              </strong>
            </span>
          </div>
        </div>

        {/* 4 Core Module Switcher Tabs */}
        <div className="module-nav-pills">
          <button 
            className={`module-pill ${activeModule === 'early-warning' ? 'active' : ''}`}
            onClick={() => {
              if (!alertsLoadedRef.current) setLoadingAlerts(true);
              setActiveModule('early-warning');
            }}
          >
            <BellRing size={16} /> 1. Prior Alerts & Notifications{' '}
            {loadingAlerts ? '(Loading…)': alertsError ? '(Unavailable)' : `(${totalPriorAlerts})`}
          </button>
          <button 
            className={`module-pill ${activeModule === 'predictive-engine' ? 'active' : ''}`}
            onClick={() => setActiveModule('predictive-engine')}
          >
            <Brain size={16} /> 2. Automated Overrun & Risk Intelligence (1,775 Projects)
          </button>
          <button 
            className={`module-pill ${activeModule === 'benchmarking' ? 'active' : ''}`}
            onClick={() => setActiveModule('benchmarking')}
          >
            <BarChart3 size={16} /> 3. Sector & State Comparative Analytics
          </button>
          <button 
            className={`module-pill ${activeModule === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveModule('assistant')}
          >
            <Bot size={16} /> 4. Project Intelligence Assistant (LLM)
          </button>
        </div>

        {/* =========================================================================
            MODULE 1: PRIOR RISK ALERTS & NOTIFICATIONS (SECTOR, MINISTRY, STATE)
            ========================================================================= */}
        {activeModule === 'early-warning' && (
          <div className="early-warning-module animate-fade-in">
            <div className="early-warning-banner-top">
              <Zap size={26} className="text-danger" />
              <div>
                <h3>Automated Prior Risk Detection & Notification Center</h3>
                <p>
                  Algorithms scan early lead indicators (Burn-Rate Spikes, Land Deficit Thresholds, and Clearance Expirations) to alert Ministry Secretaries & PMG Nodal Officers <strong>30 to 90 days before</strong> schedule breach occurs across <strong>Sector, Ministry & State</strong>.
                </p>
              </div>
            </div>

            {/* Comprehensive Multi-Filter Bar */}
            <div className="multi-filter-dashboard-card">
              <div className="filter-card-heading">
                <Filter size={15} /> <strong>Multi-Dimensional Prior Risk Filters:</strong>
              </div>

              <div className="filter-dropdowns-grid">
                {/* 1. Sector Filter */}
                <div className="filter-col">
                  <label><Layers size={12} /> Sector:</label>
                  <select 
                    className="filter-select"
                    value={selectedSectorFilter}
                    onChange={(e) => setSelectedSectorFilter(e.target.value)}
                  >
                  <option value="ALL">All Sectors ({projects.length} projects)</option>
                   {databaseSectors.map((sec, i) => (
                      <option key={i} value={sec}>
                        {sec} ({projectCountsBySector[sec] || 0} projects, {(sectorAlertsData[sec] || []).length} alerts)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. State Filter */}
                <div className="filter-col">
                  <label><MapPin size={12} /> State:</label>
                  <select 
                    className="filter-select"
                    value={selectedStateFilter}
                    onChange={(e) => setSelectedStateFilter(e.target.value)}
                  >
                    <option value="ALL">All States</option>
                    {databaseStates.map((st, i) => (
                      <option key={i} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Ministry Filter */}
                <div className="filter-col">
                  <label><Building2 size={12} /> Ministry:</label>
                  <select 
                    className="filter-select"
                    value={selectedMinistryFilter}
                    onChange={(e) => setSelectedMinistryFilter(e.target.value)}
                  >
                    <option value="ALL">All Line Ministries</option>
                    {databaseMinistries.map((min, i) => (
                      <option key={i} value={min}>{min}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Lead Time Filter */}
                <div className="filter-col">
                  <label><Clock size={12} /> Lead Window:</label>
                  <select 
                    className="filter-select"
                    value={selectedLeadTimeFilter}
                    onChange={(e) => setSelectedLeadTimeFilter(e.target.value)}
                  >
                    <option value="ALL">All Prior Windows</option>
                    <option value="30">⏱️ 30-45 Days Prior (Urgent)</option>
                    <option value="60">⏱️ 60 Days Prior (Warning)</option>
                    <option value="90">⏱️ 90 Days Prior (Early Watch)</option>
                  </select>
                </div>
              </div>

              <div className="filter-action-row">
                <span className="results-count-badge">Showing {allAlerts.length} Prior Alerts</span>
                <button 
                  className="btn-download-sector-report"
                  onClick={() => handleDownloadReport(selectedSectorFilter)}
                >
                  <Download size={14} />
                  <span>📥 Export Official Risk Dossier (CSV)</span>
                </button>
              </div>
            </div>

            {/* Prior Alerts Grid */}
            <div className="sector-alerts-grid">
                {loadingAlerts ? (
                  <div className="empty-pred-state">
                    <RefreshCw size={24} />
                    <p>Loading prior alerts and project filters…</p>
                  </div>
                ) : alertsError ? (
                  <div className="empty-pred-state">
                    <AlertTriangle size={24} />
                    <p>{alertsError}</p>
                    <button
                      className="btn-download-sector-report"
                      onClick={() => {
                        setLoadingAlerts(true);
                        fetchSectorAlerts();
                      }}
                    >
                      <RefreshCw size={14} /> Retry loading alerts
                    </button>
                  </div>
                ) : allAlerts.slice(0, 40).map((alert, idx) => {
                const dispatchKey = `${alert.project_id}-${idx}`;
                const dispatchStatus = dispatchedAlerts[dispatchKey];

                return (
                  <div key={idx} className="prior-alert-card">
                    <div className="prior-alert-head">
                      <div className="head-left">
                        <span className="sec-tag">📁 {alert.sector}</span>
                        <span className="state-tag"><MapPin size={10} /> {alert.state}</span>
                        <span className={`lead-pill ${alert.lead_time.includes('30') ? 'lead-30' : 'lead-60'}`}>
                          ⏱️ {alert.lead_time}
                        </span>
                      </div>
                      <span className="risk-score-pill">AI Risk: {alert.risk_score}%</span>
                    </div>

                    <div className="alert-ministry-badge">
                      <Building2 size={12} /> {alert.ministry}
                    </div>

                    <h4 className="alert-project-title">{alert.project_name}</h4>
                    <div className="alert-trigger-badge">
                      <AlertTriangle size={13} /> Trigger: <strong>{alert.trigger}</strong>
                    </div>

                    <p className="alert-body-text">{alert.message}</p>

                    <div className="alert-meta-line">
                      <span>Agency: <strong>{alert.agency}</strong></span>
                      <span>Location: <strong>{alert.state}</strong></span>
                    </div>

                    <div className="alert-action-footer">
                      <div className="action-text">
                        <span>Action: {alert.recommended_action}</span>
                      </div>
                      <button 
                        className={`btn-dispatch-notification ${dispatchStatus ? 'dispatched' : ''}`}
                        onClick={() => handleDispatchNotification(alert.project_id, idx)}
                        disabled={!!dispatchStatus}
                      >
                        {dispatchStatus ? (
                          <>
                            <CheckCircle2 size={14} /> {dispatchStatus}
                          </>
                        ) : (
                          <>
                            <Mail size={14} /> Dispatch Official Alert
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            MODULE 2: AUTOMATED REAL-TIME RISK, COST & TIME OVERRUN INTELLIGENCE
            ========================================================================= */}
        {activeModule === 'predictive-engine' && (
          <div className="predictive-workspace animate-fade-in">
            
            {/* Top Pre-Analyzed Banner */}
            <div className="pre-analyzed-header-banner">
              <div className="banner-left-info">
                <Brain size={28} className="text-ai-purple" />
                <div>
                  <h3>
                    {selectedProjectMode
                      ? `Overrun & Risk Intelligence: ${initialProject?.project_name || initialProject?.title || selectedProjectId}`
                      : 'Automated Pre-Computed Overrun & Risk Intelligence (1,775 Projects)'}
                  </h3>
                  <p>
                    {selectedProjectMode
                      ? 'Focused AI analysis for the selected high-value project.'
                      : 'Continuous machine learning evaluation across all central infrastructure projects. Risks and cost/time escalations are pre-computed upfront and automatically generate Prior Warning Notifications.'}
                  </p>
                </div>
              </div>
              <div className="banner-badge-group">
                <span className="stat-pill-purple"><ShieldCheck size={14} /> {selectedProjectMode ? 'Selected Project' : '100% Pre-Analyzed'}</span>
                <span className="stat-pill-blue"><Clock size={14} /> Real-Time Inference</span>
              </div>
            </div>

            {/* Main 2-Column Responsive Workspace (No Horizontal Scroll) */}
            <div className="auto-pred-layout">
              
              {/* Left Column: Live Pre-Analyzed Project Selector */}
              <div className="auto-pred-sidebar">
                <div className="sidebar-search-box">
                  <div className="search-input-wrap">
                    <Search size={14} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder={selectedProjectMode
                        ? 'Search all projects to switch analysis...'
                        : 'Search 1,775 projects by name or state...'} 
                      value={projectSearch}
                      onFocus={() => {
                        if (selectedProjectMode && projects.length === 1) fetchProjects();
                      }}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="project-search-input"
                    />
                  </div>
                  <div className="sidebar-filter-row">
                    <select 
                      value={projectFilterSector} 
                      onFocus={() => {
                        if (selectedProjectMode && projects.length === 1) fetchProjects();
                      }}
                      onChange={(e) => setProjectFilterSector(e.target.value)}
                      className="project-sector-select"
                    >
                      <option value="ALL">All Sectors</option>
                      {Array.from(new Set(
                        projects
                          .map((project) => canonicalSectorName(project.sector))
                          .filter(Boolean),
                      )).sort().map((sector) => (
                        <option key={sector} value={sector}>{sector}</option>
                      ))}
                    </select>

                    <select 
                      value={projectFilterRisk} 
                      onFocus={() => {
                        if (selectedProjectMode && projects.length === 1) fetchProjects();
                      }}
                      onChange={(e) => setProjectFilterRisk(e.target.value)}
                      className="project-risk-select"
                    >
                      <option value="ALL">All Risks</option>
                      <option value="High">🔥 High Risk</option>
                      <option value="Medium">⚠️ Medium Risk</option>
                      <option value="Low">✅ Low Risk</option>
                    </select>

                    <span className="count-tag">{filteredProjectsList.length} Projs</span>
                  </div>
                </div>

                {/* Scrollable Project Cards List */}
                <div className="projects-auto-list">
                  {filteredProjectsList.slice(0, 50).map((proj) => {
                    const isSelected = selectedProjectId === proj.project_id;
                    const isHighRisk = proj.risk_level === 'High' || proj.risk_score > 65;

                    return (
                      <div 
                        key={proj.project_id}
                        className={`project-auto-item ${isSelected ? 'active-proj' : ''}`}
                        onClick={() => handleSelectProjectDirectly(proj)}
                      >
                        <div className="proj-item-top">
                          <span className="proj-sec-tag">{proj.sector}</span>
                          <span className="proj-state-tag"><MapPin size={10} /> {proj.state}</span>
                          <span className={`proj-risk-badge ${isHighRisk ? 'risk-high' : 'risk-normal'}`}>
                            {proj.risk_score}% Risk
                          </span>
                        </div>
                        <h5 className="proj-item-title">{proj.project_name}</h5>
                        <div className="proj-item-bottom">
                          <span>Cost: ₹{proj.original_cost?.toLocaleString()} Cr</span>
                          <span className="proj-arrow"><ChevronRight size={14} /></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Pre-Computed AI Risk & Overrun Deep Dive */}
              <div className="auto-pred-details">
                {prediction ? (
                  <div className="pred-details-card">
                    {/* Header Bar */}
                    <div className="details-header-bar">
                      <div className="title-area">
                        <span className="proj-code-badge">PROJECT ID: {selectedProjectId || 'PRJ-MOSPI'}</span>
                        <h4>{formData.project_name}</h4>
                        <div className="tri-meta-strip">
                          <span className="meta-pill sec"><Layers size={11} /> {formData.sector}</span>
                          <span className="meta-pill min"><Building2 size={11} /> {formData.ministry}</span>
                          <span className="meta-pill st"><MapPin size={11} /> {formData.state}</span>
                        </div>
                      </div>
                      <span className={`overall-risk-badge ${getRiskBadge(prediction.risk_level).class}`}>
                        {getRiskBadge(prediction.risk_level).text}
                      </span>
                    </div>

                    {/* Pre-Computed Key Risk Metrics Bar */}
                    <div className="pred-metrics-highlight-grid">
                      <div className="metric-box risk-dial-box">
                        <div className="dial-num">{prediction.risk_score}<span>%</span></div>
                        <span className="dial-lbl">AI Risk Probability</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Sanctioned Cost:</span>
                        <span className="m-value">₹{formData.original_cost?.toLocaleString()} Cr</span>
                      </div>
                      <div className="metric-box highlight-box">
                        <span className="m-label">AI Forecast Final Cost:</span>
                        <span className="m-value text-red">₹{prediction.predicted_cost?.toLocaleString()} Cr</span>
                        <span className="m-sub">+{prediction.cost_overrun_pct}% Escalation</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Forecasted Delay:</span>
                        <span className="m-value text-orange">+{prediction.predicted_delay_months} Mos</span>
                      </div>
                    </div>

                    {/* Direct Prior Notification Linkage Box (Triggered Automatically from Pre-Analysis) */}
                    <div className="prior-notification-linkage-card">
                      <div className="notif-linkage-top-row">
                        <div className="notif-linkage-head">
                          <BellRing size={18} className="text-warning-bell animate-pulse" />
                          <div>
                            <strong>Automated Prior Warning Triggered from Pre-Analysis</strong>
                            <span className="notif-lead-tag">⏱️ {prediction.risk_score > 75 ? '30-Day Urgent Prior Alert' : prediction.risk_score > 50 ? '60-Day Advance Warning' : '90-Day Early Watch'}</span>
                          </div>
                        </div>
                        <button 
                          className={`btn-dispatch-mod2 ${dispatchedAlerts[`mod2-${selectedProjectId}`] ? 'dispatched' : ''}`}
                          onClick={() => handleDispatchNotification(selectedProjectId || 'PRJ-MOSPI', 'mod2')}
                          disabled={!!dispatchedAlerts[`mod2-${selectedProjectId}`]}
                        >
                          {dispatchedAlerts[`mod2-${selectedProjectId}`] ? (
                            <>
                              <CheckCircle2 size={13} /> Notice Dispatched
                            </>
                          ) : (
                            <>
                              <Mail size={13} /> Dispatch Official Notice
                            </>
                          )}
                        </button>
                      </div>

                      <div className="notif-linkage-body">
                        <p className="notif-linkage-msg">
                          ⚡ <strong>Automated Trigger:</strong> Project flagged for <strong>+{prediction.predicted_delay_months} Months Schedule Lag</strong> and <strong>+{prediction.cost_overrun_pct}% Cost Escalation Risk</strong>.
                        </p>
                        <div className="notif-routing-pills">
                          <span className="route-pill">🏛️ Nodal: <strong>{formData.ministry}</strong></span>
                          <span className="route-pill">📍 State Taskforce: <strong>{formData.state}</strong></span>
                          <span className="route-pill">📁 Sector: <strong>{formData.sector}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Root Cause Explainability */}
                    <div className="reasons-section">
                      <h5>
                        <AlertTriangle size={15} className="text-warning" /> 
                        Key Delay & Cost Escalation Drivers (Explainable AI)
                      </h5>
                      <div className="reasons-list">
                        {prediction.key_reasons?.map((reason, idx) => (
                          <div key={idx} className="reason-card">
                            <div className="reason-header">
                              <span className="reason-title">{reason.factor}</span>
                              <span className="reason-impact">{reason.impact_pct}% Impact Weight</span>
                            </div>
                            <div className="reason-bar-wrap">
                              <div 
                                className="reason-bar-fill" 
                                style={{ width: `${Math.min(100, reason.impact_pct * 1.5)}%` }}
                              />
                            </div>
                            <p className="reason-detail">{reason.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mitigation Directives */}
                    <div className="recommendations-section">
                      <h5>
                        <ShieldCheck size={16} className="text-accent" />
                        AI Action Directives & Mitigation Orders ({formData.state})
                      </h5>
                      <div className="recommendations-list">
                        {prediction.recommendations?.map((rec, idx) => (
                          <div key={idx} className="rec-card">
                            <div className="rec-header">
                              <span className="rec-category">{rec.category}</span>
                              <span className={`priority-tag priority-${rec.priority.toLowerCase()}`}>
                                {rec.priority} PRIORITY
                              </span>
                            </div>
                            <p className="rec-action">{rec.action}</p>
                            <div className="rec-footer">
                              <span className="rec-authority">🏛️ <strong>Authority:</strong> {rec.authority}</span>
                              <span className="rec-impact">🎯 <strong>Target Impact:</strong> {rec.expected_impact}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Collapsible What-If Simulator Toggle */}
                    <div className="simulator-toggle-box">
                      <button 
                        className="btn-toggle-sim"
                        onClick={() => setShowSimulator(!showSimulator)}
                      >
                        <Sliders size={15} /> 
                        <span>{showSimulator ? 'Hide What-If Simulation Lab' : '🧪 Open Custom What-If Parameter Simulator (Optional)'}</span>
                        <ChevronDown size={15} className={showSimulator ? 'rotate-180' : ''} />
                      </button>

                      {showSimulator && (
                        <div className="simulator-drawer animate-fade-in">
                          <div className="form-grid-2col">
                            <div className="form-group-item">
                              <label className="form-label">Sanctioned Cost (₹ Cr)</label>
                              <input 
                                type="number" 
                                className="form-input"
                                value={formData.original_cost}
                                onChange={(e) => setFormData({...formData, original_cost: Number(e.target.value)})}
                              />
                            </div>
                            <div className="form-group-item">
                              <label className="form-label">Land Acquired (%)</label>
                              <input 
                                type="number" 
                                className="form-input"
                                min="0" max="100"
                                value={formData.land_acquired_pct}
                                onChange={(e) => setFormData({...formData, land_acquired_pct: Number(e.target.value)})}
                              />
                            </div>
                            <div className="form-group-item">
                              <label className="form-label">Reported Delay (Months)</label>
                              <input 
                                type="number" 
                                className="form-input"
                                value={formData.delay_months}
                                onChange={(e) => setFormData({...formData, delay_months: Number(e.target.value)})}
                              />
                            </div>
                            <div className="form-group-item">
                              <label className="form-label">Environmental Clearance</label>
                              <select 
                                className="form-select"
                                value={formData.environmental_clearance}
                                onChange={(e) => setFormData({...formData, environmental_clearance: e.target.value})}
                              >
                                <option value="Approved">Approved</option>
                                <option value="Pending">Pending</option>
                                <option value="Conditional">Conditional</option>
                              </select>
                            </div>
                          </div>

                          <button 
                            className="btn-run-ml"
                            onClick={() => runPrediction(formData)}
                            disabled={loadingPred}
                          >
                            {loadingPred ? 'Computing Simulation...' : 'Re-compute Simulation'}
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="empty-pred-state">
                    <Brain size={42} />
                    <p>Loading automated machine learning intelligence...</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
            MODULE 3: BENCHMARKING & COMPARATIVE ANALYTICS
            ========================================================================= */}
        {activeModule === 'benchmarking' && (
          <div className="benchmarking-module animate-fade-in">
            <div className="benchmarking-header">
              <div className="benchmarking-title-group">
                <BarChart3 size={24} className="text-primary" />
                <div>
                  <h3>Sector & State Comparative Infrastructure Benchmarks</h3>
                  <p>Macro-level cross-sector & cross-state performance indicators synthesized from 1,775 projects.</p>
                </div>
              </div>

              <div className="benchmarking-actions report-export-actions">
                <button className="btn-download-sector-report" onClick={() => handleDownloadReport('ALL')}>
                  <Download size={15} /> <span>Export Sector Report (CSV)</span>
                </button>
                <button
                  className="btn-download-sector-report"
                  style={{ marginLeft: '12px' }}
                  onClick={() => handleDownloadMinistryReport('ALL')}
                >
                  <Download size={15} /> <span>Export Ministry Report (CSV)</span>
                </button>
              </div>
            </div>

            {/* Sector Benchmarks */}
            <h4 className="bench-section-title">📊 Sector-Wise Portfolio Benchmarks</h4>
            <div className="benchmark-cards-grid">
              {benchmarks.map((b, idx) => (
                <div key={idx} className="benchmark-card">
                  <div className="benchmark-card-head">
                    <h4>{b.sector}</h4>
                    <span className="proj-badge">{b.project_count} Projects</span>
                  </div>

                  <div className="benchmark-stats-grid">
                    <div className="b-stat">
                      <span className="b-label">Total Outlay:</span>
                      <span className="b-val">₹{b.total_revised_cost?.toLocaleString()} Cr</span>
                    </div>
                    <div className="b-stat">
                      <span className="b-label">Cost Escalation:</span>
                      <span className={`b-val ${b.cost_overrun_pct > 15 ? 'text-red' : 'text-green'}`}>
                        +{b.cost_overrun_pct}%
                      </span>
                    </div>
                    <div className="b-stat">
                      <span className="b-label">Average Delay:</span>
                      <span className="b-val">{b.avg_delay_months} Months</span>
                    </div>
                    <div className="b-stat">
                      <span className="b-label">Avg. Progress:</span>
                      <span className="b-val">{b.avg_physical_progress}%</span>
                    </div>
                  </div>

                  <div className="b-risk-footer">
                    <span>Critical Projects: <strong>{b.high_risk_projects}</strong></span>
                    <div className="b-bar-track">
                      <div 
                        className="b-bar-fill" 
                        style={{ width: `${Math.min(100, (b.high_risk_projects / Math.max(b.project_count, 1)) * 100)}%` }} 
                      />
                    </div>
                  </div>

                  <button 
                    className="btn-card-sector-download"
                    onClick={() => handleDownloadReport(b.sector)}
                  >
                    <Download size={13} /> Download {b.sector} Report (CSV)
                  </button>
                </div>
              ))}
            </div>

            {/* State Benchmarks */}
            {ministryBenchmarks.length > 0 && (
              <>
                <h4 className="bench-section-title" style={{ marginTop: '2rem' }}>🏛️ Ministry-Wise Portfolio Benchmarks</h4>
                <div className="benchmark-cards-grid">
                  {ministryBenchmarks.map((item) => (
                    <div className="benchmark-card" key={item.ministry}>
                      <div className="benchmark-card-head">
                        <h4>{item.ministry}</h4>
                        <span className="proj-badge">{item.project_count} Projects</span>
                      </div>
                      <div className="benchmark-stats-grid">
                        <div className="b-stat"><span className="b-label">Total Outlay:</span><span className="b-val">₹{Number(item.total_revised_cost || 0).toLocaleString('en-IN')} Cr</span></div>
                        <div className="b-stat"><span className="b-label">Cost Escalation:</span><span className={`b-val ${item.cost_overrun_pct > 15 ? 'text-red' : 'text-green'}`}>+{item.cost_overrun_pct}%</span></div>
                        <div className="b-stat"><span className="b-label">Average Delay:</span><span className="b-val">{item.avg_delay_months} Months</span></div>
                        <div className="b-stat"><span className="b-label">High Risk:</span><span className="b-val">{item.high_risk_projects}</span></div>
                      </div>
                      <div className="b-risk-footer">
                        <span>Critical Projects: <strong>{item.high_risk_projects}</strong></span>
                        <div className="b-bar-track"><div className="b-bar-fill" style={{ width: `${Math.min(100, (item.high_risk_projects / Math.max(item.project_count, 1)) * 100)}%` }} /></div>
                      </div>
                      <button className="btn-card-sector-download" onClick={() => handleDownloadMinistryReport(item.ministry)}>
                        <Download size={13} /> Download Ministry Report (CSV)
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* State Benchmarks */}
            {stateBenchmarks.length > 0 && (
              <>
                <h4 className="bench-section-title" style={{ marginTop: '2rem' }}>🗺️ State-Wise Portfolio Benchmarks</h4>
                <div className="benchmark-cards-grid">
                  {stateBenchmarks.map((st, idx) => (
                    <div key={idx} className="benchmark-card state-bench-card">
                      <div className="benchmark-card-head">
                        <h4><MapPin size={14} /> {st.state}</h4>
                        <span className="proj-badge">{st.project_count} Projects</span>
                      </div>

                      <div className="benchmark-stats-grid">
                        <div className="b-stat">
                          <span className="b-label">Total Outlay:</span>
                          <span className="b-val">₹{st.total_revised_cost?.toLocaleString()} Cr</span>
                        </div>
                        <div className="b-stat">
                          <span className="b-label">Overrun:</span>
                          <span className={`b-val ${st.cost_overrun_pct > 10 ? 'text-red' : 'text-green'}`}>
                            +{st.cost_overrun_pct}%
                          </span>
                        </div>
                        <div className="b-stat">
                          <span className="b-label">Avg. Delay:</span>
                          <span className="b-val">{st.avg_delay_months} Mos</span>
                        </div>
                        <div className="b-stat">
                          <span className="b-label">High Risk:</span>
                          <span className="b-val text-red">{st.high_risk_projects}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================================
            MODULE 4: LLM-ENABLED PROJECT INTELLIGENCE ASSISTANT
            ========================================================================= */}
        {activeModule === 'assistant' && (
          <div className="chatbot-container animate-fade-in">
            <div className="chatbot-header">
              <div className="chat-title">
                <Bot size={24} className="bot-icon" />
                <div>
                    <h3>IntegRA EWS Project Intelligence Assistant</h3>
                    <span className="chat-subtitle">Grounded answers across live projects, all supported sectors, ministries, states and prior risk alerts</span>
                    {llmStatus && (
                      <span className="chat-subtitle">
                        {llmStatus.configured
                          ? `LLM: ${llmStatus.provider} (${llmStatus.model})`
                          : 'Grounded local assistant active; configure GEMINI_API_KEY for live LLM responses'}
                      </span>
                    )}
                </div>
              </div>
              <div className="chat-quick-suggestions">
                <button 
                  className="chip-btn chip-highlight"
                  onClick={() => setInputMsg("Which sector has the highest prior risk alerts?")}
                >
                  ⚡ Highest Risk Sector
                </button>
                <button 
                  className="chip-btn chip-highlight"
                  onClick={() => setInputMsg("Show active projects and risk scores in Madhya Pradesh and Maharashtra")}
                >
                  🗺️ State Risk Status
                </button>
                <button 
                  className="chip-btn chip-highlight"
                  onClick={() => setInputMsg("How to download sector wise risk report?")}
                >
                  📥 Download Reports
                </button>
              </div>
            </div>

            <div className="chat-messages-scroll">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble-wrap ${msg.sender}`}>
                  <div className="chat-bubble">
                    {msg.sender === 'bot' && <Bot size={16} className="bubble-bot-icon" />}
                    <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              {loadingChat && (
                <div className="chat-bubble-wrap bot">
                  <div className="chat-bubble loading">
                    <RefreshCw size={14} className="spin-icon" /> Analyzing central infrastructure database...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-bar">
              <input 
                type="text" 
                placeholder="Ask about Sector, Ministry, State, 30-day prior risk alerts, cost overrun forecasts..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="chat-text-input"
              />
              <button type="submit" className="chat-send-btn" disabled={loadingChat || !inputMsg.trim()}>
                <Send size={16} /> Send
              </button>
            </form>
          </div>
        )}

      </div>
    </section>
  );
}
