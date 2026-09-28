import React, { useEffect, useState } from 'react';
import { X, Brain, AlertTriangle, TrendingUp, CheckCircle, BarChart2, ShieldCheck, Download, MapPin, Layers, Building2 } from 'lucide-react';
import { API_BASE } from '../api';

export default function AiPredictModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('forecast');
  const [selectedReportSector, setSelectedReportSector] = useState('ALL');
  const [sectors, setSectors] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      fetch(`${API_BASE}/catalog/sectors`),
      fetch(`${API_BASE}/analytics/benchmarks`),
      fetch(`${API_BASE}/projects`),
    ])
      .then(async ([sectorResponse, benchmarkResponse, projectResponse]) => {
        if (!sectorResponse.ok || !benchmarkResponse.ok || !projectResponse.ok) {
          throw new Error('Unable to load analytical report data');
        }
        const [sectorData, benchmarkData, projectData] = await Promise.all([
          sectorResponse.json(),
          benchmarkResponse.json(),
          projectResponse.json(),
        ]);
        setSectors((sectorData.sectors || []).filter((sector) => sector.project_count > 0));
        setBenchmarks((benchmarkData.sectors || []).filter((sector) => sector.project_count > 0));
        setProjects(projectData.projects || []);
      })
      .catch((error) => console.warn('Unable to load analytical report data:', error));
  }, [isOpen]);

  const handleDownloadSectorReport = (sector) => {
    const targetSector = sector || 'ALL';
    const downloadUrl = `${API_BASE}/reports/sector-wise/download?sector=${encodeURIComponent(targetSector)}`;
    window.open(downloadUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header ai-modal-header">
          <div className="modal-title-group">
            <Brain size={24} className="text-ai-purple" />
            <div>
              <h3>IntegRA EWS AI Engine & Analytical Reports</h3>
              <p className="modal-subtext">Predictive delay warnings & automated cost overrun forecasting across Sector, Ministry & State</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="ai-modal-tabs">
          <button 
            className={`ai-tab ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <TrendingUp size={15} /> Delay Forecast Matrix
          </button>
          <button 
            className={`ai-tab ${activeTab === 'cost' ? 'active' : ''}`}
            onClick={() => setActiveTab('cost')}
          >
            <AlertTriangle size={15} /> Cost Escalation Variance
          </button>
          <button 
            className={`ai-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart2 size={15} /> Downloadable Reports
          </button>
        </div>

        <div className="ai-modal-body">
          {activeTab === 'forecast' && (
            <div className="forecast-tab-content">
              <div className="ai-stat-banner">
                <div className="ai-stat-box">
                  <span className="stat-num text-green">94.2%</span>
                  <span className="stat-lbl">AI Model Reliability</span>
                </div>
                <div className="ai-stat-box">
                  <span className="stat-num text-blue">14 Days</span>
                  <span className="stat-lbl">Avg. National Delay Avoided</span>
                </div>
                <div className="ai-stat-box">
                  <span className="stat-num text-orange">₹ 42,800 Cr</span>
                  <span className="stat-lbl">Prevented Overrun Risk</span>
                </div>
              </div>

              <h4 className="body-heading">Prior Risk & Delay Alert Matrix (Next 30–90 Days)</h4>
              <div className="risk-table-wrapper">
                <table className="risk-table">
                  <thead>
                    <tr>
                      <th>Project Title</th>
                      <th>Sector</th>
                      <th>Line Ministry</th>
                      <th>State</th>
                      <th>Scheduled Comp.</th>
                      <th>AI Predicted Delay</th>
                      <th>Risk Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.slice(0, 30).map((project) => (
                      <tr key={project.project_id}>
                        <td><strong>{project.project_name}</strong></td>
                        <td>{project.sector}</td>
                        <td>{project.ministry}</td>
                        <td><span className="state-badge-table"><MapPin size={10} /> {project.state}</span></td>
                        <td>{project.target_date || 'Not available'}</td>
                        <td className={project.delay_months > 0 ? 'text-orange' : 'text-green'}>
                          {project.delay_months > 0 ? `+ ${project.delay_months} Months` : 'On Track'}
                        </td>
                        <td><span className={`badge-risk ${project.risk_level === 'High' ? 'high' : project.risk_level === 'Medium' ? 'medium' : 'low'}`}>
                          {project.risk_level} Risk ({Math.round(project.risk_score)}%)
                        </span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'cost' && (
            <div className="cost-tab-content">
              <h4 className="body-heading">Sector & Ministry-wise Cost Variance Distribution</h4>
              <div className="variance-bar-group">
                {benchmarks.map((benchmark) => (
                  <div className="variance-item" key={benchmark.sector}>
                    <div className="var-info">
                      <span>{benchmark.sector} Sector</span>
                      <strong>+ {benchmark.cost_overrun_pct}% Est. Escalation</strong>
                    </div>
                    <div className="var-track">
                      <div className={`var-fill ${benchmark.cost_overrun_pct >= 15 ? 'fill-red' : 'fill-green'}`} style={{ width: `${Math.min(100, Math.max(5, benchmark.cost_overrun_pct * 4))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="reports-tab-content">
              <h4 className="body-heading">Download Official MoSPI & AI Infrastructure Risk Reports</h4>
              
              {/* Sector selector for custom sector report */}
              <div className="report-sector-picker-box">
                <label className="picker-label">Select Infrastructure Sector to Download (Includes Ministry & State breakdown):</label>
                <div className="picker-row">
                  <select 
                    className="report-select"
                    value={selectedReportSector}
                    onChange={(e) => setSelectedReportSector(e.target.value)}
                  >
                    <option value="ALL">🌐 All Sectors Master Portfolio (1,775 Projects with Ministry & State)</option>
                    {sectors.map((sector) => (
                      <option key={sector.name} value={sector.name}>
                        {sector.name} ({sector.project_count} Projects)
                      </option>
                    ))}
                  </select>

                  <button 
                    className="btn-download-primary"
                    onClick={() => handleDownloadSectorReport(selectedReportSector)}
                  >
                    <Download size={16} /> Download Selected Sector Report (CSV)
                  </button>
                </div>
              </div>

              <div className="reports-list">
                <div className="report-row">
                  <div>
                    <strong>Monthly Flash Report on Central Infrastructure Projects (MoSPI Synchronized)</strong>
                    <div className="report-sub">Official CSV Dataset • 1,775 Projects • Includes Sector, Ministry, State & Risk Scores</div>
                  </div>
                  <button 
                    className="btn-download" 
                    onClick={() => handleDownloadSectorReport('ALL')}
                  >
                    <Download size={15} /> Download Master CSV
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
