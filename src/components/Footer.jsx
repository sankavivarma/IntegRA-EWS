import React from 'react';
import { ExternalLink, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div className="footer-brand-section">
          <div className="footer-logo">
            <span className="logo-main">IntegRA <span className="logo-highlight">EWS</span></span>
          </div>
          <p className="footer-desc">
            IntegRA EWS is the Integrated Risk Analysis Early Warning System for infrastructure projects.
          </p>
        </div>

        <div className="footer-links-grid">
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#hero">Home</a></li>
              <li><a href="#dashboard">Ministry Dashboard</a></li>
              <li><a href="#state-map">State-wise Map</a></li>
              <li><a href="#high-value">High Value Projects</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Government Portals</h4>
            <ul>
              <li><a href="https://www.mospi.gov.in" target="_blank" rel="noreferrer">MoSPI Official Portal <ExternalLink size={11} /></a></li>
              <li><a href="https://www.india.gov.in" target="_blank" rel="noreferrer">National Portal of India <ExternalLink size={11} /></a></li>
              <li><a href="https://pmg.gov.in" target="_blank" rel="noreferrer">Project Monitoring Group (PMG) <ExternalLink size={11} /></a></li>
              <li><a href="https://niti.gov.in" target="_blank" rel="noreferrer">NITI Aayog <ExternalLink size={11} /></a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Compliance & Standards</h4>
            <ul>
              <li>Website Policies</li>
              <li>Accessibility Statement</li>
              <li>Help & FAQ</li>
              <li>Terms of Service</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <div className="container bottom-flex">
          <div className="copyright-text">
            © 2026 IntegRA EWS. All Rights Reserved.
          </div>
          <div className="tech-badge">
            <Cpu size={14} /> Powered by React.js, Vite & Modern CSS
          </div>
        </div>
      </div>
    </footer>
  );
}
