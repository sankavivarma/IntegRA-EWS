import React, { useState, useRef } from 'react';
import { ministryData, sectorData } from '../data/ministryData';
import { API_BASE } from '../api';
import { 
  Calculator, 
  Coins, 
  CircleDollarSign, 
  TrendingUp, 
  CalendarDays, 
  Building, 
  ChevronUp, 
  ChevronDown, 
  ChevronRight,
  Info,
  Brain,
  CheckCircle,
  AlertTriangle,
  Zap,
  MapPin,
  Layers,
  Building2
} from 'lucide-react';

export default function MinistryDashboard({ onSelectMinistry }) {
  const [viewType, setViewType] = useState('sector'); // Default to 'sector' or 'ministry'
  const [selectedKey, setSelectedKey] = useState('Roads & Highways');
  const [liveData, setLiveData] = useState(null);
  const tabsListRef = useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    const loadLivePortfolio = async () => {
      try {
        const response = await fetch(`${API_BASE}/projects`);
        if (!response.ok) throw new Error(`Projects request failed: ${response.status}`);
        const payload = await response.json();
        const projects = payload.projects || [];
        const grouped = { sector: {}, ministry: {} };

        projects.forEach((project) => {
          ['sector', 'ministry'].forEach((groupKey) => {
            const key = project[groupKey];
            if (!key) return;
            const current = grouped[groupKey][key] || {
              name: key,
              projectCount: 0,
              originalCost: 0,
              revisedCost: 0,
              expenditure: 0,
              completed: 0,
              newlyAdded: 0,
              topStates: {},
              highRisk: 0,
              delayTotal: 0,
              progressTotal: 0,
            };
            current.projectCount += 1;
            current.originalCost += Number(project.original_cost) || 0;
            current.revisedCost += Number(project.revised_cost) || 0;
            current.expenditure += Number(project.expenditure_to_date) || 0;
            current.completed += Number(project.completed_during_month)
              || (String(project.status || '').toLowerCase().includes('complete') ? 1 : 0);
            current.newlyAdded += Number(project.newly_added) || 0;
            current.highRisk += project.risk_level === 'High' ? 1 : 0;
            current.delayTotal += Number(project.delay_months) || 0;
            current.progressTotal += Number(project.physical_progress) || 0;
            if (project.state) current.topStates[project.state] = (current.topStates[project.state] || 0) + 1;
            grouped[groupKey][key] = current;
          });
        });

        const normalize = (groups) => Object.fromEntries(
          Object.entries(groups).map(([key, value]) => {
            const overrun = value.originalCost
              ? ((value.revisedCost - value.originalCost) / value.originalCost) * 100
              : 0;
            const topStates = Object.entries(value.topStates)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([state]) => state);
            return [key, {
              ...value,
              originalCost: Math.round(value.originalCost).toLocaleString('en-IN'),
              revisedCost: Math.round(value.revisedCost).toLocaleString('en-IN'),
              expenditure: Math.round(value.expenditure).toLocaleString('en-IN'),
              topStates,
              aiRiskLevel: value.highRisk > 0 ? 'High' : 'Low',
              aiEfficiency: `${Math.max(0, Math.round(100 - (value.highRisk / value.projectCount) * 100))}%`,
              avgDelay: `${(value.delayTotal / value.projectCount).toFixed(1)} Mos`,
              predictedCostOverrun: `${overrun.toFixed(1)}%`,
            }];
          }),
        );

        if (!cancelled) setLiveData({ sector: normalize(grouped.sector), ministry: normalize(grouped.ministry) });
      } catch (error) {
        console.warn('Live portfolio data unavailable; using bundled portfolio data.', error);
      }
    };

    loadLivePortfolio();
    return () => { cancelled = true; };
  }, []);

  const dataset = liveData
    ? (viewType === 'ministry' ? liveData.ministry : liveData.sector)
    : (viewType === 'ministry' ? ministryData : sectorData);
  const currentData = dataset[selectedKey] || Object.values(dataset)[0] || {};

  React.useEffect(() => {
    const firstKey = Object.keys(dataset)[0];
    if (firstKey && !dataset[selectedKey]) setSelectedKey(firstKey);
  }, [dataset, selectedKey]);

  const handleTabSwitch = (type) => {
    setViewType(type);
    if (type === 'ministry') {
      const firstMinKey = Object.keys(ministryData)[0] || 'Ministry of Road Transport & Highways';
      setSelectedKey(firstMinKey);
    } else {
      const firstSecKey = Object.keys(sectorData)[0] || 'Roads & Highways';
      setSelectedKey(firstSecKey);
    }
    if (tabsListRef.current) {
      tabsListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollUp = () => {
    if (tabsListRef.current) {
      tabsListRef.current.scrollBy({ top: -160, behavior: 'smooth' });
    }
  };

  const handleScrollDown = () => {
    if (tabsListRef.current) {
      tabsListRef.current.scrollBy({ top: 160, behavior: 'smooth' });
    }
  };

  return (
    <section className="dashboard-section" id="dashboard">
      <div className="container">
        {/* Top View Selector Switcher */}
        <div className="view-switcher-center">
          <button 
            className={`switch-tab ${viewType === 'sector' ? 'active-tab' : ''}`}
            onClick={() => handleTabSwitch('sector')}
          >
            Sector-Wise Portfolio ({Object.keys(sectorData).length} Sectors)
          </button>
          <button 
            className={`switch-tab ${viewType === 'ministry' ? 'active-tab' : ''}`}
            onClick={() => handleTabSwitch('ministry')}
          >
            Ministry-Wise Portfolio ({Object.keys(ministryData).length} Ministries)
          </button>
        </div>

        {/* Main Section Content: Left Side Tabs + Right Metric Card */}
        <div className="dashboard-layout">
          {/* Left Vertical Selector Sidebar */}
          <div className="side-tab-container">
            <button 
              className="tab-scroll-btn up" 
              onClick={handleScrollUp}
              title="Scroll Up"
            >
              <ChevronUp size={18} />
            </button>
            
            <div className="side-tabs-list" ref={tabsListRef}>
              {Object.keys(dataset).map((key) => {
                const isSelected = selectedKey === key;
                return (
                  <button
                    key={key}
                    className={`side-tab-btn ${isSelected ? 'active-side-tab' : ''}`}
                    onClick={() => {
                      setSelectedKey(key);
                      if (onSelectMinistry) onSelectMinistry(key);
                    }}
                  >
                    <span>{key}</span>
                    {isSelected && <ChevronRight size={18} className="tab-arrow" />}
                  </button>
                );
              })}
            </div>

            <button 
              className="tab-scroll-btn down" 
              onClick={handleScrollDown}
              title="Scroll Down"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Right Metrics Display Card */}
          <div className="metrics-card-wrapper">
            <div className="metrics-card">
              {/* Card Header Bar */}
              <div className="metrics-card-header">
                <div>
                  <h3>{currentData.name || selectedKey} <span className="as-of-date">(as of {currentData.date || 'July, 2026'})</span></h3>
                  
                  {/* Linked Sector and Line Ministry Strip */}
                  <div className="dashboard-linkage-strip">
                    {currentData.sector && (
                      <span className="linkage-pill sector-pill">
                        <Layers size={12} /> Primary Sector: <strong>{currentData.sector}</strong>
                      </span>
                    )}
                    {currentData.ministry && (
                      <span className="linkage-pill ministry-pill">
                        <Building2 size={12} /> Line Ministry: <strong>{currentData.ministry}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <span className="ai-status-badge">
                  <Brain size={14} /> AI Risk Assessment: <strong>{currentData.aiRiskLevel || 'Low'} Risk</strong>
                </span>
              </div>

              {/* Operating States Tag Line */}
              {currentData.topStates && currentData.topStates.length > 0 && (
                <div className="dashboard-states-bar">
                  <span className="states-bar-title"><MapPin size={13} /> Key Operating States:</span>
                  <div className="states-chips-list">
                    {currentData.topStates.map((st, i) => (
                      <span key={i} className="state-tag-chip">{st}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid of 6 Metrics */}
              <div className="metrics-grid">
                {/* 1. Project Count */}
                <div className="metric-cell">
                  <div className="metric-icon-box">
                    <Calculator size={28} className="cell-icon" />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label">
                      Project Count (No.) <Info size={13} className="info-icon" title="Total active projects monitored" />
                    </span>
                    <span className="metric-value">{currentData.projectCount || 0}</span>
                  </div>
                </div>

                {/* 2. Original Cost */}
                <div className="metric-cell">
                  <div className="metric-icon-box">
                    <Coins size={28} className="cell-icon" />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label">
                      Original Cost (in Cr) <Info size={13} className="info-icon" title="Initial approved budget in Crore INR" />
                    </span>
                    <span className="metric-value">₹ {currentData.originalCost || 0}</span>
                  </div>
                </div>

                {/* 3. Latest Revised Cost */}
                <div className="metric-cell">
                  <div className="metric-icon-box">
                    <CircleDollarSign size={28} className="cell-icon" />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label">
                      Latest Revised Cost (in Cr) <Info size={13} className="info-icon" title="Sanctioned revised cost" />
                    </span>
                    <span className="metric-value">₹ {currentData.revisedCost || 0}</span>
                  </div>
                </div>

                {/* 4. Expenditure (Cumm.) */}
                <div className="metric-cell">
                  <div className="metric-icon-box">
                    <TrendingUp size={28} className="cell-icon" />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label">
                      Expenditure(Cumm.) (in Cr) <Info size={13} className="info-icon" title="Total expenditure till date" />
                    </span>
                    <span className="metric-value">₹ {currentData.expenditure || 0}</span>
                  </div>
                </div>

                {/* 5. Completed During Month */}
                <div className="metric-cell">
                  <div className="metric-icon-box">
                    <CalendarDays size={28} className="cell-icon" />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label">
                      Completed During Month (No.) <Info size={13} className="info-icon" title="Projects handed over this month" />
                    </span>
                    <span className="metric-value">{currentData.completed || 0}</span>
                  </div>
                </div>

                {/* 6. Newly Added */}
                <div className="metric-cell">
                  <div className="metric-icon-box">
                    <Building size={28} className="cell-icon" />
                  </div>
                  <div className="metric-details">
                    <span className="metric-label">
                      Newly Added (No.) <Info size={13} className="info-icon" title="New projects sanctioned this month" />
                    </span>
                    <span className="metric-value">{currentData.newlyAdded || 0}</span>
                  </div>
                </div>
              </div>

              {/* AI Predictive Analytics Strip */}
              <div className="card-ai-footer">
                <div className="ai-stat-item">
                  <CheckCircle size={14} className="text-green" />
                  <span>AI Efficiency Score: <strong>{currentData.aiEfficiency || '90%'}</strong></span>
                </div>
                <div className="ai-stat-item">
                  <Zap size={14} className="text-blue" />
                  <span>Est. Delay Forecast: <strong>{currentData.avgDelay || '0 Mos'}</strong></span>
                </div>
                <div className="ai-stat-item">
                  <AlertTriangle size={14} className="text-orange" />
                  <span>Cost Overrun Variance: <strong>{currentData.predictedCostOverrun || '0%'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
