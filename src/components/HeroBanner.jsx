import React, { useEffect, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  MapPinned,
  Building2,
} from "lucide-react";
import { API_BASE } from "../api";

import "./HeroBanner.css";

const sectors = [
  "ROAD TRANSPORT & HIGHWAYS",
  "RAILWAYS",
  "POWER",
  "JAL SHAKTI",
  "NEW & RENEWABLE ENERGY",
  "HOUSING & URBAN AFFAIRS",
  "PORTS & SHIPPING",
  "CIVIL AVIATION",
  "AGRICULTURE & FARMERS WELFARE",
  "HEALTH & FAMILY WELFARE",
  "EDUCATION",
  "DEFENCE",
  "ENVIRONMENT & FOREST",
  "COMMUNICATIONS",
  "CHEMICALS & FERTILIZERS",
  "STEEL",
  "PETROLEUM & NATURAL GAS",
  "FINANCE",
  "COMMERCE & INDUSTRY",
  "HEAVY INDUSTRIES",
  "ELECTRONICS & IT",
];

const slides = [
  {
    eyebrow: "AI-POWERED MONITORING & FORECASTING",
    titleTop: "AI Risk Intelligence &",
    titleBottom: "Integrated Risk Analysis",
    description:
      "Predictive signals for delays, cost overruns & infrastructure project risks",
    metric1: "1,775",
    metric1Label: "Projects Monitored",
    metric2: "86%",
    metric2Label: "Risk Detection Rate",
    metric3: "24/7",
    metric3Label: "Predictive Monitoring",
  },
  {
    eyebrow: "NATIONAL INFRASTRUCTURE INTELLIGENCE",
    titleTop: "Centralized Project",
    titleBottom: "Monitoring Platform",
    description:
      "Unified visibility across ministries, sectors, states and major infrastructure projects",
    metric1: "1,775",
    metric1Label: "Projects Monitored",
    metric2: "94.2%",
    metric2Label: "Portfolio Coverage",
    metric3: "21",
    metric3Label: "Major Sectors",
  },
  {
    eyebrow: "PREDICTIVE INFRASTRUCTURE GOVERNANCE",
    titleTop: "Predict. Monitor.",
    titleBottom: "Prevent.",
    description:
      "AI-driven early warnings to identify emerging project risks before they become critical",
    metric1: "21",
    metric1Label: "Infrastructure Sectors",
    metric2: "86%",
    metric2Label: "AI Detection Rate",
    metric3: "24/7",
    metric3Label: "Integrated Risk Analysis",
  },
];

export default function HeroBanner() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeSector, setActiveSector] = useState(0);
  const [portfolioStats, setPortfolioStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/analytics/summary`).then((response) => response.ok ? response.json() : null),
      fetch(`${API_BASE}/catalog/sectors`).then((response) => response.ok ? response.json() : null),
    ]).then(([summary, catalog]) => {
      if (!cancelled && summary) {
        const sectorsCount = (catalog?.sectors || []).filter((sector) => sector.available).length;
        setPortfolioStats({
          projects: Number(summary.total_projects || 0).toLocaleString('en-IN'),
          sectors: sectorsCount || 0,
          riskRate: summary.total_projects
            ? `${Math.round((summary.high_risk_count / summary.total_projects) * 100)}%`
            : '0%',
        });
      }
    }).catch((error) => console.warn('Hero portfolio metrics unavailable:', error));
    return () => { cancelled = true; };
  }, []);

  /*
    Change sector every 2 seconds
  */
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSector((prev) => (prev + 1) % sectors.length);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  /*
    Change hero slide every 7 seconds
  */
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 7000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slides.length);
  };

  const previousSlide = () => {
    setActiveSlide(
      (prev) => (prev - 1 + slides.length) % slides.length
    );
  };

  const slide = slides[activeSlide];
  const liveSlide = portfolioStats ? {
    ...slide,
    metric1: portfolioStats.projects,
    metric2: activeSlide === 1 ? `${Math.max(0, 100 - Number(portfolioStats.riskRate.replace('%', '')))}%` : portfolioStats.riskRate,
    metric3: activeSlide === 1 ? String(portfolioStats.sectors) : slide.metric3,
  } : slide;

  return (
    <section className="hero-banner">
      <div className="hero-background">
        <img
          src="/src/assets/hero.png"
          alt="Infrastructure"
          className="hero-bg-image"
        />

        <div className="hero-dark-overlay"></div>
        <div className="hero-blue-glow glow-left"></div>
        <div className="hero-blue-glow glow-right"></div>
      </div>

      {/* ==========================================
          MINISTRY / SECTOR BACKGROUND
      =========================================== */}

      <div className="ministry-marquee">
        <div className="ministry-row ministry-row-one">
          <div className="ministry-track">
            {[...sectors, ...sectors].map((sector, index) => (
              <React.Fragment key={`row1-${index}`}>
                <span>{sector}</span>
                <b>◆</b>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="ministry-row ministry-row-two">
          <div className="ministry-track reverse-track">
            {[...sectors, ...sectors].map((sector, index) => (
              <React.Fragment key={`row2-${index}`}>
                <span>{sector}</span>
                <b>◆</b>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="ministry-row ministry-row-three">
          <div className="ministry-track">
            {[...sectors, ...sectors].map((sector, index) => (
              <React.Fragment key={`row3-${index}`}>
                <span>{sector}</span>
                <b>◆</b>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ==========================================
          SIDE LEFT MESSAGE
      =========================================== */}

      <div className="hero-side-message hero-left-message">
        <div className="side-line"></div>

        <span>DATA</span>
        <span>INSIGHTS</span>
        <span>SAFER</span>
        <span>INFRASTRUCTURE</span>
        <span>STRONGER</span>
        <span>NATION</span>
      </div>

      {/* ==========================================
          SIDE RIGHT MESSAGE
      =========================================== */}

      <div className="hero-side-message hero-right-message">
        <span>PREDICT</span>
        <span>MONITOR</span>
        <span>PREVENT</span>

        <div className="side-line"></div>

        <small>FOR A</small>
        <strong>RESILIENT</strong>
        <strong>INDIA</strong>
      </div>

      {/* ==========================================
          PREVIOUS BUTTON
      =========================================== */}

      <button
        className="hero-arrow hero-prev"
        onClick={previousSlide}
        aria-label="Previous slide"
      >
        <ChevronLeft size={23} />
      </button>

      {/* ==========================================
          MAIN MIDDLE BOX
      =========================================== */}

      <div className="hero-content">
        <div className="hero-card">

          {/* AI BADGE */}

          <div className="hero-ai-badge">
            <Sparkles size={15} />
            <span>{slide.eyebrow}</span>
          </div>

          {/* TITLE */}

          <h1 className="hero-title">
            <span>{slide.titleTop}</span>
            <strong>{slide.titleBottom}</strong>
          </h1>

          <p className="hero-description">
            {slide.description}
          </p>

          {/* ======================================
              SECTOR ROTATOR
          ======================================= */}

          <div className="sector-rotator">

            <div className="sector-rotator-label">
              <Building2 size={15} />
              <span>SECTOR COVERAGE</span>
            </div>

            <div className="sector-display">
              <div
                key={activeSector}
                className="sector-name-animation"
              >
                {sectors[activeSector]}
              </div>

              <div className="sector-counter">
                {String(activeSector + 1).padStart(2, "0")}
                <span>/</span>
                {String(sectors.length).padStart(2, "0")}
              </div>
            </div>

          </div>

          {/* ======================================
              METRICS
          ======================================= */}

          <div className="hero-metrics">

            <div className="hero-metric">
              <div className="metric-icon blue">
                <TrendingUp size={17} />
              </div>

              <div>
                <strong>{liveSlide.metric1}</strong>
                <span>{liveSlide.metric1Label}</span>
              </div>
            </div>

            <div className="hero-metric">
              <div className="metric-icon green">
                <CircleCheck size={17} />
              </div>

              <div>
                <strong>{liveSlide.metric2}</strong>
                <span>{liveSlide.metric2Label}</span>
              </div>
            </div>

            <div className="hero-metric">
              <div className="metric-icon cyan">
                <Sparkles size={17} />
              </div>

              <div>
                <strong>{liveSlide.metric3}</strong>
                <span>{liveSlide.metric3Label}</span>
              </div>
            </div>

          </div>

          {/* LOCATION */}

          <div className="hero-network-label">
            <MapPinned size={13} />
            <span>
              National Infrastructure Intelligence Network
            </span>
          </div>

        </div>
      </div>

      {/* ==========================================
          NEXT BUTTON
      =========================================== */}

      <button
        className="hero-arrow hero-next"
        onClick={nextSlide}
        aria-label="Next slide"
      >
        <ChevronRight size={23} />
      </button>

      {/* ==========================================
          SLIDE DOTS
      =========================================== */}

      <div className="hero-pagination">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`hero-dot ${
              activeSlide === index ? "active" : ""
            }`}
            onClick={() => setActiveSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* ==========================================
          LIVE AI TICKER
      =========================================== */}

      <div className="hero-live-ticker">

        <div className="ticker-label">
          <span className="ticker-live-dot"></span>
          LIVE AI PREDICTIVE ALERT
        </div>

        <div className="ticker-window">
          <div className="ticker-track">
            <span>
              Road Transport & Highways — Project delay probability
              detected
            </span>

            <i>•</i>

            <span>
              Railways — Alignment progress monitored
            </span>

            <i>•</i>

            <span>
              Power — Cost variance under AI observation
            </span>

            <i>•</i>

            <span>
              Jal Shakti — Early warning analysis active
            </span>

            <i>•</i>

            <span>
              Renewable Energy — Project milestone tracking active
            </span>

            <i>•</i>

            <span>
              Ports & Shipping — Predictive monitoring enabled
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}