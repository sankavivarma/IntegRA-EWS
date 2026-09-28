import React, { useState } from 'react';
import { highValueProjects } from '../data/highValueProjects';
import { API_BASE } from '../api';
import { 
  Ship, 
  Pickaxe, 
  Layers, 
  TrainTrack, 
  Zap, 
  Truck, 
  Sparkles, 
  MapPin, 
  Building2, 
  Filter, 
  ShieldCheck, 
  Brain,
  AlertOctagon
} from 'lucide-react';

let liveProjectsRequest = null;

const fetchLiveProjects = () => {
  if (!liveProjectsRequest) {
    liveProjectsRequest = fetch(`${API_BASE}/projects`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Projects request failed: ${response.status}`);
        const data = await response.json();
        return data.projects || [];
      })
      .finally(() => {
        liveProjectsRequest = null;
      });
  }
  return liveProjectsRequest;
};

export default function HighValueProjects({ onNavigateToAnalysis }) {
  const [filterMode, setFilterMode] = useState('risk'); // Default to 'risk' to showcase high-risk projects
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [projects, setProjects] = useState(highValueProjects);

  React.useEffect(() => {
    let cancelled = false;
    const loadProjects = async () => {
      try {
        const liveProjects = (await fetchLiveProjects())
          .slice()
          .sort((a, b) => (Number(b.revised_cost) || 0) - (Number(a.revised_cost) || 0))
          .slice(0, 30)
          .map((project) => ({
            ...project,
            id: project.project_id,
            project_id: project.project_id,
            agency: project.ministry || 'Central Infrastructure Authority',
            title: project.project_name,
            sector: project.sector,
            ministry: project.ministry,
            state: project.state,
            riskScore: Math.round(Number(project.risk_score) || 0),
            riskLevel: project.risk_level || 'Low',
            originalCost: Math.round(Number(project.original_cost) || 0).toLocaleString('en-IN'),
            revisedCost: Math.round(Number(project.revised_cost) || 0).toLocaleString('en-IN'),
            compDate: project.target_date || 'Target date pending',
            expenditure: Math.round(Number(project.expenditure_to_date) || 0).toLocaleString('en-IN'),
            physicalProgress: Math.round(Number(project.physical_progress) || 0),
            delayMonths: Number(project.delay_months) || 0,
            icon: 'Layers',
          }));
        if (!cancelled && liveProjects.length) setProjects(liveProjects);
      } catch (error) {
        if (!cancelled) {
          console.warn('Live high-value project data unavailable; using bundled data.', error);
        }
      }
    };
    loadProjects();
    return () => { cancelled = true; };
  }, []);

  const riskList = ['All', 'High Risk Alert (Critical)', 'Medium Risk', 'Low Risk'];
  const getFilterOptions = () => {
    if (filterMode === 'risk') return riskList;
    if (filterMode === 'sector') return dynamicSectors;
    if (filterMode === 'ministry') return dynamicMinistries;
    return dynamicStates;
  };

  const dynamicSectors = ['All', ...new Set(projects.map((project) => project.sector).filter(Boolean))];
  const dynamicMinistries = ['All', ...new Set(projects.map((project) => project.ministry).filter(Boolean))];
  const dynamicStates = ['All', ...new Set(projects.map((project) => project.state).filter(Boolean))];
  const filteredProjects = projects.filter(p => {
    if (selectedFilter === 'All') return true;
    if (filterMode === 'risk') {
      if (selectedFilter.includes('High')) return p.riskLevel === 'High' || p.riskScore >= 70;
      if (selectedFilter.includes('Medium')) return p.riskLevel === 'Medium';
      if (selectedFilter.includes('Low')) return p.riskLevel === 'Low';
      return true;
    }
    if (filterMode === 'sector') return p.sector === selectedFilter;
    if (filterMode === 'ministry') return p.ministry === selectedFilter;
    if (filterMode === 'state') return p.state === selectedFilter;
    return true;
  });

  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'Ship': return <Ship size={44} className="sector-svg-icon" />;
      case 'Pickaxe': return <Pickaxe size={44} className="sector-svg-icon" />;
      case 'Layers': return <Layers size={44} className="sector-svg-icon" />;
      case 'TrainTrack': return <TrainTrack size={44} className="sector-svg-icon" />;
      case 'Zap': return <Zap size={44} className="sector-svg-icon" />;
      case 'Truck': return <Truck size={44} className="sector-svg-icon" />;
      default: return <Layers size={44} className="sector-svg-icon" />;
    }
  };

  return (
    <section className="high-value-section" id="high-value">
      <div className="container">
        <div className="high-value-header">
          <div className="high-value-title-wrap">
            <div className="badge-ai-pill">
              <Sparkles size={13} /> STRATEGIC INFRASTRUCTURE PORTFOLIO
            </div>
            <h2>National High Value Mega Projects</h2>
            <p className="high-value-sub">
              Continuous AI Risk Assessment across 1,775 central projects. Click any project to open its deep pre-computed Overrun & Risk Analysis.
            </p>
          </div>

          {/* Filter Mode Switcher */}
          <div className="filter-mode-container">
            <div className="filter-type-toggle">
              <span className="filter-type-label"><Filter size={13} /> Filter By:</span>
              <button 
                className={`filter-type-btn ${filterMode === 'risk' ? 'active' : ''}`}
                onClick={() => { setFilterMode('risk'); setSelectedFilter('All'); }}
              >
                🔥 Risk Level
              </button>
              <button 
                className={`filter-type-btn ${filterMode === 'sector' ? 'active' : ''}`}
                onClick={() => { setFilterMode('sector'); setSelectedFilter('All'); }}
              >
                Sector
              </button>
              <button 
                className={`filter-type-btn ${filterMode === 'ministry' ? 'active' : ''}`}
                onClick={() => { setFilterMode('ministry'); setSelectedFilter('All'); }}
              >
                Ministry
              </button>
              <button 
                className={`filter-type-btn ${filterMode === 'state' ? 'active' : ''}`}
                onClick={() => { setFilterMode('state'); setSelectedFilter('All'); }}
              >
                State
              </button>
            </div>

            {/* Filter Pills */}
            <div className="filter-pill-group">
              {getFilterOptions().map(opt => (
                <button 
                  key={opt}
                  className={`sector-filter-btn ${selectedFilter === opt ? 'active' : ''}`}
                  onClick={() => setSelectedFilter(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* High Value Cards Grid with Sector, Ministry, State */}
        <div className="high-value-grid">
          {filteredProjects.map((project) => {
            const isHigh = project.riskLevel === 'High' || project.riskScore >= 70;

            return (
              <div 
                key={project.id} 
                className={`project-card ${isHigh ? 'card-high-risk-border' : ''}`}
                onClick={() => onNavigateToAnalysis && onNavigateToAnalysis(project)}
                style={{ cursor: 'pointer' }}
              >
                
                {/* Card Top: Universal Tri-Factor Badge Strip (Sector, Ministry, State) */}
                <div className="card-tri-badge-strip">
                  <span className="card-badge-sector" title="Sector">
                    📁 {project.sector}
                  </span>
                  <span className="card-badge-state" title="Operating State">
                    <MapPin size={11} /> {project.state}
                  </span>
                </div>

                {/* Ministry Ribbon */}
                <div className="card-ministry-ribbon" title="Line Ministry">
                  <Building2 size={12} className="min-icon" />
                  <span>{project.ministry}</span>
                </div>

                {/* Sector Icon Top Illustration */}
                <div className="card-top-icon">
                  {getIconComponent(project.icon)}
                </div>

                {/* Agency Name */}
                <h4 className="card-agency-name">{project.agency}</h4>

                {/* Project Description/Title */}
                <p className="card-project-title" title={project.title}>{project.title}</p>

                {/* AI Risk Score Pill Upfront */}
                <div className={`card-risk-upfront-pill ${isHigh ? 'risk-pill-danger' : ''}`}>
                  {isHigh ? (
                    <AlertOctagon size={13} className="text-danger animate-pulse" />
                  ) : (
                    <ShieldCheck size={13} className="risk-shield-icon" />
                  )}
                  <span>AI Risk Score: <strong>{project.riskScore}% ({project.riskLevel} Risk)</strong></span>
                </div>

                {/* Divider Line */}
                <div className="card-divider"></div>

                {/* 2x2 Data Metrics Grid */}
                <div className="card-metrics-grid">
                  {/* Cell 1: Original Cost */}
                  <div className="card-metric-cell">
                    <span className="cell-label">Original Cost <br/>(in Cr)</span>
                    <span className="cell-value">₹ {project.originalCost}</span>
                  </div>

                  {/* Cell 2: Physical Progress */}
                  <div className="card-metric-cell">
                    <span className="cell-label">Physical Progress <br/>(in %)</span>
                    <span className="cell-value progress-text">{project.physicalProgress}%</span>
                  </div>

                  {/* Cell 3: Latest Revised Cost */}
                  <div className="card-metric-cell">
                    <span className="cell-label">Latest Revised Cost <br/>(in Cr)</span>
                    <span className="cell-value">₹ {project.revisedCost}</span>
                  </div>

                  {/* Cell 4: Latest Revised Comp. Date */}
                  <div className="card-metric-cell">
                    <span className="cell-label">Target Commissioning <br/>Date</span>
                    <span className="cell-value date-text">{project.compDate}</span>
                  </div>
                </div>

                {/* Progress Bar & AI Status */}
                <div className="card-footer-ai">
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${project.physicalProgress}%`, backgroundColor: project.statusColor }}
                    ></div>
                  </div>
                  <div className="card-ai-badge" style={{ color: project.statusColor }}>
                    <Sparkles size={13} /> {project.aiStatus}
                  </div>
                </div>

                {/* Direct Action: Deep Analysis Redirection Button */}
                <div className="card-cta-footer">
                  <button 
                    className="btn-card-analysis-cta"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onNavigateToAnalysis) onNavigateToAnalysis(project);
                    }}
                  >
                    <Brain size={14} /> View AI Overrun & Risk Analysis ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
