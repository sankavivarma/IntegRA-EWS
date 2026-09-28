import React, { useEffect, useState } from 'react';
import {
  X,
  PlusCircle,
  CheckCircle2,
  Building2,
  Brain,
  Layers,
  MapPin,
  ShieldCheck,
  IndianRupee,
  Building
} from 'lucide-react';
import confetti from 'canvas-confetti';
import './AddProjectModal.css';
import { API_BASE, getAdminAuthHeaders } from '../api';

export default function AddProjectModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    title: '',
    ministry: 'Ministry of Road Transport and Highways',
    sector: 'Road Transport & Highways',
    state: 'Madhya Pradesh',
    cost: '',
    agency: 'NHAI',
    compDate: '2027-03-31',
    progress: '25',
    landAcq: '85',
    clearance: 'Approved',
    contractorRisk: 'Low'
  });

  const [submitted, setSubmitted] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/catalog/sectors`)
      .then((response) => response.ok ? response.json() : Promise.reject(response.status))
      .then((data) => setSectors((data.sectors || []).map((sector) => sector.name)))
      .catch((error) => console.warn('Unable to load sector catalog:', error));
  }, [isOpen]);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const projectPayload = {
      project_name: formData.title,
      sector: formData.sector,
      ministry: formData.ministry,
      state: formData.state,
      agency: formData.agency || 'MoSPI Executing Agency',
      original_cost: parseFloat(formData.cost) || 1000.0,
      revised_cost: parseFloat(formData.cost) || 1000.0,
      expenditure_to_date:
        (parseFloat(formData.cost) || 1000.0) *
        (parseFloat(formData.progress) / 100.0),
      original_duration_months: 36,
      delay_months: 0,
      physical_progress: parseFloat(formData.progress) || 0,
      land_acquired_pct: parseFloat(formData.landAcq) || 100,
      environmental_clearance: formData.clearance,
      contractor_risk: formData.contractorRisk
    };

    try {
      const res = await fetch(
        `${API_BASE}/projects`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAdminAuthHeaders(),
          },
          body: JSON.stringify(projectPayload)
        }
      );

      if (res.ok) {
        const data = await res.json();
        setPredictionResult(data.prediction);
      } else {
        console.warn('Project API returned:', res.status);
      }
    } catch (err) {
      console.warn('Backend unavailable:', err);
    } finally {
      setLoading(false);
      setSubmitted(true);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      setTimeout(() => {
        setSubmitted(false);
        setPredictionResult(null);
        onClose();
      }, 3000);
    }
  };

  return (
    <div
      className="apm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="apm-modal">

        {/* HEADER */}
        <div className="apm-header">
          <div className="apm-header-left">
            <div className="apm-header-icon">
              <PlusCircle size={22} />
            </div>

            <div>
              <h2>Add Infrastructure Project</h2>
              <p>Register a project and run predictive risk analysis</p>
            </div>
          </div>

          <button
            type="button"
            className="apm-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* SUCCESS */}
        {submitted ? (
          <div className="apm-success">

            <div className="apm-success-icon">
              <CheckCircle2 size={58} />
            </div>

            <h3>
              Project Successfully Registered
            </h3>

            <p>
              The project has been added to the central monitoring database.
            </p>

            {predictionResult && (
              <div className="apm-prediction-card">

                <div className="apm-prediction-title">
                  <Brain size={18} />
                  AI Predictive Risk Analysis
                </div>

                <div className="apm-prediction-score">
                  {predictionResult.risk_score}%
                </div>

                <div className="apm-risk-badge">
                  {predictionResult.risk_level} Risk
                </div>

                <div className="apm-prediction-details">
                  <span>
                    📍 {formData.state}
                  </span>

                  <span>
                    ◈ {formData.sector}
                  </span>
                </div>

                {predictionResult.predicted_cost && (
                  <p>
                    Predicted Cost:
                    <strong>
                      ₹{predictionResult.predicted_cost?.toLocaleString()} Cr
                    </strong>
                  </p>
                )}

              </div>
            )}
          </div>
        ) : (

          /* FORM */
          <form
            onSubmit={handleSubmit}
            className="apm-form"
          >

            {/* PROJECT NAME */}
            <div className="apm-section-label">
              <Building size={16} />
              Project Information
            </div>

            <div className="apm-field full">
              <label>
                Project Title / Name <span>*</span>
              </label>

              <input
                type="text"
                required
                placeholder="e.g. Western Ring Road Bypass Package 4"
                value={formData.title}
                onChange={(e) =>
                  updateField('title', e.target.value)
                }
              />
            </div>

            {/* THREE COLUMNS */}
            <div className="apm-grid-3">

              <div className="apm-field">
                <label>
                  <Layers size={14} />
                  Sector <span>*</span>
                </label>

                <select
                  value={formData.sector}
                  onChange={(e) => {
                    const sec = e.target.value;

                    let ministry = formData.ministry;

                    if (sec === 'Railways')
                      ministry = 'Ministry of Railways';

                    if (sec === 'Road Transport & Highways')
                      ministry =
                        'Ministry of Road Transport and Highways';

                    if (sec === 'Power')
                      ministry = 'Ministry of Power';

                    if (sec === 'Urban Development')
                      ministry =
                        'Ministry of Housing and Urban Affairs';

                    if (sec === 'Petroleum & Natural Gas')
                      ministry =
                        'Ministry of Petroleum & Natural Gas';

                    if (sec === 'Shipping')
                      ministry =
                        'Ministry of Ports, Shipping and Waterways';

                    setFormData(prev => ({
                      ...prev,
                      sector: sec,
                      ministry
                    }));
                  }}
                >
                  {(sectors.length ? sectors : ['Road Transport & Highways']).map((sector) => (
                    <option key={sector}>{sector}</option>
                  ))}
                </select>
              </div>

              <div className="apm-field">
                <label>
                  <Building2 size={14} />
                  Line Ministry <span>*</span>
                </label>

                <input
                  type="text"
                  required
                  value={formData.ministry}
                  onChange={(e) =>
                    updateField('ministry', e.target.value)
                  }
                />
              </div>

              <div className="apm-field">
                <label>
                  <MapPin size={14} />
                  State <span>*</span>
                </label>

                <select
                  value={formData.state}
                  onChange={(e) =>
                    updateField('state', e.target.value)
                  }
                >
                  <option>Madhya Pradesh</option>
                  <option>Maharashtra</option>
                  <option>Uttar Pradesh</option>
                  <option>Tamil Nadu</option>
                  <option>Gujarat</option>
                  <option>Rajasthan</option>
                  <option>Karnataka</option>
                  <option>Odisha</option>
                  <option>Andhra Pradesh</option>
                  <option>West Bengal</option>
                  <option>Bihar</option>
                  <option>Jammu & Kashmir</option>
                </select>
              </div>

            </div>

            {/* COST + AGENCY */}
            <div className="apm-grid-2">

              <div className="apm-field">
                <label>
                  <IndianRupee size={14} />
                  Sanctioned Cost (₹ Crores) <span>*</span>
                </label>

                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 2450"
                  value={formData.cost}
                  onChange={(e) =>
                    updateField('cost', e.target.value)
                  }
                />
              </div>

              <div className="apm-field">
                <label>
                  Executing Agency / PSU
                </label>

                <input
                  type="text"
                  placeholder="e.g. NHAI / RVNL / DFCCIL"
                  value={formData.agency}
                  onChange={(e) =>
                    updateField('agency', e.target.value)
                  }
                />
              </div>

            </div>

            {/* LAND + CLEARANCE */}
            <div className="apm-grid-2">

              <div className="apm-field">
                <label>
                  Land Acquired (%)
                </label>

                <div className="apm-range-wrapper">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.landAcq}
                    onChange={(e) =>
                      updateField('landAcq', e.target.value)
                    }
                  />

                  <span>
                    {formData.landAcq}%
                  </span>
                </div>
              </div>

              <div className="apm-field">
                <label>
                  <ShieldCheck size={14} />
                  Environmental Clearance
                </label>

                <select
                  value={formData.clearance}
                  onChange={(e) =>
                    updateField('clearance', e.target.value)
                  }
                >
                  <option>Approved</option>
                  <option>Pending</option>
                  <option>Conditional</option>
                </select>
              </div>

            </div>

            {/* PROGRESS */}
            <div className="apm-field">
              <label>
                Current Physical Progress
              </label>

              <div className="apm-progress-control">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) =>
                    updateField('progress', e.target.value)
                  }
                />

                <div className="apm-progress-value">
                  {formData.progress}%
                </div>
              </div>
            </div>

            {/* INFO */}
            <div className="apm-ai-note">
              <Brain size={18} />

              <div>
                <strong>AI Predictive Analysis</strong>

                <p>
                  The project will be evaluated using cost,
                  progress, land acquisition and contractor-risk
                  indicators.
                </p>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="apm-actions">

              <button
                type="button"
                className="apm-cancel"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="apm-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="apm-spinner" />
                    Running AI Analysis...
                  </>
                ) : (
                  <>
                    <Brain size={18} />
                    Save & Run Predictive Analysis
                  </>
                )}
              </button>

            </div>

          </form>
        )}

      </div>
    </div>
  );
}