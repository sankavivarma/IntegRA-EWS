import React, { useState } from "react";
import { ArrowRight, Building2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { API_BASE } from "../api";
import "./MinistryPortal.css";

export default function MinistryLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!email || !password) return setError("Enter your official email and password.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to sign in. Please verify your credentials.");
      if (!data.access_token || !data.user || !data.user.id || !data.user.ministry) {
        throw new Error("The authentication service returned an incomplete session.");
      }
      localStorage.setItem("ministry_token", data.access_token);
      localStorage.setItem("ministry_user", JSON.stringify(data.user));
      window.location.assign("/ministry/dashboard");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="ministry-auth">
      <div className="ministry-auth-art">
        <div className="ministry-mark"><Building2 size={24} /></div>
        <p className="ministry-eyebrow">Government of India</p>
        <h1>Ministry<br /><span>Command Centre</span></h1>
        <p className="ministry-auth-copy">A secure, ministry-scoped view of infrastructure delivery, risk and early warnings.</p>
        <div className="ministry-trust"><ShieldCheck size={17} /> Authorised government access</div>
      </div>
      <form className="ministry-login-card" onSubmit={submit}>
        <div className="ministry-card-heading">
          <p className="ministry-eyebrow">IntegRA EWS</p>
          <h2>Ministry sign in</h2>
          <p>Use your registered ministry credentials to continue.</p>
        </div>
        <label>Official email<input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@ministry.gov.in" autoComplete="username" /></label>
        <label>Password<div className="ministry-input-icon"><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" /></div></label>
        {error && <div className="ministry-form-error">{error}</div>}
        <button className="ministry-primary-button" disabled={loading}>{loading ? "Signing in…" : <>Sign in securely <ArrowRight size={17} /></>}</button>
        <p className="ministry-login-note"><Mail size={15} /> Contact your nodal officer for access support.</p>
      </form>
    </div>
  );
}
