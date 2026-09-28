import React, { useState } from "react";
import { useEffect } from "react";
import {
  Copy,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Activity,
  Building2,
  BrainCircuit,
} from "lucide-react";

import "./Login.css";
import { ADMIN_TOKEN_KEY, API_BASE } from "../api";

const SHOW_DEMO_CREDENTIALS = import.meta.env.VITE_ENABLE_DEMO_CREDENTIALS !== "false";

const ADMIN_DEMO = {
  email: "admin.demo@integra-ews.in",
  password: "SIH2026Demo!",
};

export default function Login({ onLogin, initialMode = "admin" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ministry, setMinistry] = useState("");
  const [ministries, setMinistries] = useState([]);
  const [demoCredentials, setDemoCredentials] = useState([]);
  const [credentialsLoaded, setCredentialsLoaded] = useState(!SHOW_DEMO_CREDENTIALS);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedDemoField, setCopiedDemoField] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (mode !== "ministry" || ministries.length) return;
    setCatalogLoading(true);
    fetch(`${API_BASE}/catalog/ministries`)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load the Ministry list.");
        return response.json();
      })
      .then((data) => setMinistries(data.ministries || []))
      .catch((catalogError) => setError(catalogError.message))
      .finally(() => setCatalogLoading(false));
  }, [mode, ministries.length]);

  useEffect(() => {
    if (mode !== "ministry" || credentialsLoaded || !SHOW_DEMO_CREDENTIALS) return;
    fetch(`${API_BASE}/demo/ministry-credentials`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load demo credentials.");
        if (!Array.isArray(data.credentials)) {
          throw new Error("The demo credentials service returned an invalid response.");
        }
        setDemoCredentials(data.credentials);
      })
      .catch((credentialsError) => setError(credentialsError.message))
      .finally(() => setCredentialsLoaded(true));
  }, [mode, credentialsLoaded]);

  useEffect(() => {
    if (mode !== "ministry" || !ministry || !credentialsLoaded) return;
    const credential = demoCredentials.find((item) => item.ministry === ministry);
    setEmail(credential?.username || "");
    setPassword("");
    setCopiedDemoField("");
  }, [mode, ministry, demoCredentials, credentialsLoaded]);

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setEmail("");
    setPassword("");
    if (nextMode === "admin") setMinistry("");
  };

  const copyDemoValue = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedDemoField(field);
    } catch {
      setError("Clipboard access is unavailable. Select the demo value to copy it.");
    }
  };

  const submitLogin = (username, loginPassword, selectedMinistry) => {
    setError("");

    if (!username || !loginPassword || (mode === "ministry" && !selectedMinistry)) {
      setError(mode === "ministry"
        ? "Select your Ministry and enter your username and password."
        : "Please enter your email and password.");
      return;
    }

    setLoading(true);

    if (mode === "admin") {
      fetch(`${API_BASE}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: loginPassword }),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.detail || "Unable to sign in. Please verify your credentials.");
          if (!data.access_token || data.user?.role !== "admin") {
            throw new Error("The authentication service returned an incomplete Admin session.");
          }
          sessionStorage.setItem(ADMIN_TOKEN_KEY, data.access_token);
          onLogin();
        })
        .catch((loginError) => {
          setError(loginError.message);
          setLoading(false);
        });
      return;
    }

    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password: loginPassword, ministry: selectedMinistry }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to sign in. Please verify your credentials.");
        if (!data.access_token || !data.user?.id || !data.user?.ministry) {
          throw new Error("The authentication service returned an incomplete session.");
        }
        localStorage.setItem("ministry_token", data.access_token);
        localStorage.setItem("ministry_user", JSON.stringify(data.user));
        window.location.assign("/ministry/dashboard");
      })
      .catch((loginError) => {
        setError(loginError.message);
        setLoading(false);
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitLogin(email, password, ministry);
  };

  const ministryDemo = demoCredentials.find((credential) => credential.ministry === ministry);

  return (
    <div className="login-page">

      {/* ================= BACKGROUND ================= */}

      <div className="login-background">
        <div className="login-grid-pattern"></div>
        <div className="login-glow login-glow-one"></div>
        <div className="login-glow login-glow-two"></div>

        {/* Infrastructure illustration */}
        <div className="infra-scene">

          <div className="bridge">
            <div className="bridge-road"></div>

            <div className="bridge-pillar pillar-one"></div>
            <div className="bridge-pillar pillar-two"></div>
            <div className="bridge-pillar pillar-three"></div>

            <div className="bridge-cable cable-one"></div>
            <div className="bridge-cable cable-two"></div>
            <div className="bridge-cable cable-three"></div>
            <div className="bridge-cable cable-four"></div>
          </div>

          <div className="city">
            <div className="city-building city-one"></div>
            <div className="city-building city-two"></div>
            <div className="city-building city-three"></div>
            <div className="city-building city-four"></div>
            <div className="city-building city-five"></div>
            <div className="city-building city-six"></div>
          </div>

          <div className="metro-line">
            <div className="metro-track"></div>
            <div className="metro-train">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div className="network-node node-one"></div>
          <div className="network-node node-two"></div>
          <div className="network-node node-three"></div>
          <div className="network-node node-four"></div>

        </div>
      </div>


      {/* ================= MAIN CONTENT ================= */}

      <div className="login-content">

        {/* ================= LEFT PANEL ================= */}

        <section className="login-info-panel">

          {/* BRAND */}

          <div className="login-brand">

            <div className="login-brand-symbol">
              <span className="brand-bar bar-one"></span>
              <span className="brand-bar bar-two"></span>
              <span className="brand-bar bar-three"></span>
              <span className="brand-arrow">↗</span>
            </div>

            <div>
              <div className="login-brand-name">
                IntegRA <span>EWS</span>
              </div>

              <div className="login-brand-sub">
                INTEGRATED RISK ANALYSIS EARLY WARNING SYSTEM
              </div>
            </div>

          </div>


          {/* AI TAG */}

          <div className="login-ai-tag">
            <Sparkles size={15} />
            AI-POWERED INFRASTRUCTURE INTELLIGENCE
          </div>


          {/* MAIN HEADING */}

          <div className="login-info-main">

            <h1>
              Predict.
              <span> Monitor.</span>
              <br />
              Prevent.
            </h1>

            <p>
              Intelligent infrastructure project monitoring,
              AI-based risk prediction and proactive delay
              forecasting in one unified platform.
            </p>

          </div>


          {/* FEATURES */}

          <div className="login-feature-list">

            <div className="login-feature">

              <div className="login-feature-icon">
                <Activity size={22} />
              </div>

              <div>
                <strong>Real-Time Monitoring</strong>
                <span>
                  Track critical infrastructure projects
                </span>
              </div>

            </div>


            <div className="login-feature">

              <div className="login-feature-icon">
                <BrainCircuit size={22} />
              </div>

              <div>
                <strong>AI Risk Intelligence</strong>
                <span>
                  Predict project delays and cost risks
                </span>
              </div>

            </div>


            <div className="login-feature">

              <div className="login-feature-icon">
                <Building2 size={22} />
              </div>

              <div>
                <strong>Infrastructure Governance</strong>
                <span>
                  Centralized project intelligence
                </span>
              </div>

            </div>

          </div>


          {/* BUILDING MESSAGE */}

          <div className="resilient-message">
            <span>Building a Resilient India</span>

            <div className="tricolor-line">
              <i></i>
              <b></b>
              <em></em>
            </div>
          </div>

        </section>


        {/* ================= LOGIN CARD ================= */}

        <section className="login-card-wrapper">

          <div className="login-card">

            <div className="login-card-accent"></div>


            {/* HEADER */}

            <div className="login-card-header">

              <div className="login-lock-icon">
                <Lock size={24} />
              </div>

              <div>
                <h2>Welcome Back</h2>

                <p>{mode === "admin" ? "Sign in to the Admin Dashboard" : "Sign in to the Ministry Dashboard"}</p>
              </div>
            </div>

            <div className="login-mode-tabs" role="tablist" aria-label="Login type">
              <button type="button" className={mode === "admin" ? "active" : ""} onClick={() => selectMode("admin")}>Admin Login</button>
              <button type="button" className={mode === "ministry" ? "active" : ""} onClick={() => selectMode("ministry")}>Ministry Login</button>
            </div>


            {/* SECURITY BADGE */}

            <div className="login-security-badge">
              <ShieldCheck size={15} />
              Authorized Access Only
            </div>


            {/* ERROR */}

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}


            {/* FORM */}

            <form
              className="login-form"
              onSubmit={handleSubmit}
            >

              {mode === "ministry" && (
                <div className="login-field">
                  <label htmlFor="ministry-select">Select Ministry</label>
                  <div className="login-input-wrapper">
                    <Building2 size={18} />
                    <select
                      id="ministry-select"
                      value={ministry}
                      onChange={(event) => {
                        const selectedMinistry = event.target.value;
                        const selectedDemo = demoCredentials.find(
                          (credential) => credential.ministry === selectedMinistry
                        );
                        setMinistry(selectedMinistry);
                        setEmail(selectedDemo?.username || "");
                        setPassword("");
                        setCopiedDemoField("");
                        setError("");
                      }}
                      disabled={catalogLoading}
                    >
                      <option value="">{catalogLoading ? "Loading ministries…" : "Select Ministry"}</option>
                      {ministries.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}{item.project_count ? ` (${item.project_count} Projects)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {ministry && SHOW_DEMO_CREDENTIALS && (
                    <section className="ministry-demo-credentials" aria-label="Selected Ministry demo credentials">
                      <div className="demo-login ministry-active-credential">
                        <div className="demo-login-title">DEMO ACCESS</div>
                        {ministryDemo ? (
                          <>
                            <div className="demo-credential-row">
                              <span>Username: <code>{ministryDemo.username}</code></span>
                              <button type="button" onClick={() => copyDemoValue(ministryDemo.username, "Username")}>
                                {copiedDemoField === "Username" ? "COPIED" : <><Copy size={12} /> COPY</>}
                              </button>
                            </div>
                            <div className="demo-credential-row">
                              <span>Password: <code>{ministryDemo.password}</code></span>
                              <button type="button" onClick={() => copyDemoValue(ministryDemo.password, "Password")}>
                                {copiedDemoField === "Password" ? "COPIED" : <><Copy size={12} /> COPY</>}
                              </button>
                            </div>
                            <span className="demo-prototype-note">SIH Prototype Account</span>
                          </>
                        ) : (
                          <div className="demo-login-text">
                            <span>
                              {credentialsLoaded
                                ? "No demo account is configured for this Ministry."
                                : "Loading demo credentials…"}
                            </span>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              )}

              <div className="login-field">

                <label>{mode === "admin" ? "Email Address" : "Ministry Email Address"}</label>

                <div className="login-input-wrapper">

                  <Mail size={18} />

                  <input
                    type="text"
                    placeholder={mode === "admin" ? "Enter your email" : "Enter your username"}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    autoComplete="username"
                  />

                </div>

              </div>


              {/* PASSWORD */}

              <div className="login-field">

                <div className="login-label-row">

                  <label>Password</label>

                  <button
                    type="button"
                    className="forgot-password"
                    onClick={() =>
                      setError(
                        "Please contact the system administrator to reset your password."
                      )
                    }
                  >
                    Forgot password?
                  </button>

                </div>


                <div className="login-input-wrapper">

                  <Lock size={18} />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    autoComplete="current-password"
                  />


                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>

                </div>

              </div>


              {/* REMEMBER */}

              <label className="remember-row">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>
                  Keep me signed in
                </span>

              </label>


              {/* SIGN IN */}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >

                {loading ? (
                  <>
                    <span className="login-spinner"></span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    {mode === "ministry" ? "Sign In to Ministry" : "Sign In"}
                    <ArrowRight size={18} />
                  </>
                )}

              </button>

            </form>


            {/* DEMO ACCESS */}

            {mode === "admin" && SHOW_DEMO_CREDENTIALS ? (
              <div className="demo-login">
                <div className="demo-login-title">ADMIN DEMO ACCESS</div>
                <div className="demo-login-text">
                  <span>Email: <strong>{ADMIN_DEMO.email}</strong></span>
                  <span>Password: <strong>{ADMIN_DEMO.password}</strong></span>
                </div>
                <button
                  type="button"
                  className="credential-login-button demo-fill-button"
                  onClick={() => {
                    setEmail(ADMIN_DEMO.email);
                    setPassword(ADMIN_DEMO.password);
                    setError("");
                  }}
                >
                  Use Admin demo account
                </button>
              </div>
            ) : null}


            {/* FOOTER */}

            <div className="login-card-footer">

              <ShieldCheck size={14} />

              Your session is protected by secure
              authentication.

            </div>

          </div>

        </section>

      </div>


      {/* ================= COPYRIGHT ================= */}

      <div className="login-copyright">
        © 2026 IntegRA EWS · Integrated Risk Analysis Early Warning System
      </div>

    </div>
  );
}