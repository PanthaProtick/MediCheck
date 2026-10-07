import React from 'react';
import { Cpu, Database, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Header({ health }) {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-logo">⚡</div>
        <div className="brand-text">
          <h1>Hackathon Platform</h1>
          <p>React • FastAPI • Neon • Gemini • uv</p>
        </div>
      </div>

      <div className="status-badges">
        <div className={`badge ${isHealthy ? 'online' : 'offline'}`}>
          <span className="badge-dot"></span>
          <span>API: {isHealthy ? 'Live (8000)' : 'Offline'}</span>
        </div>

        <div className={`badge ${health?.database_configured ? 'online' : 'info'}`}>
          <Database size={12} />
          <span>Neon: {health?.database_configured ? 'Connected' : 'Standby'}</span>
        </div>

        <div className={`badge ${health?.gemini_configured ? 'online' : 'active'}`}>
          <Sparkles size={12} />
          <span>Gemini: {health?.gemini_configured ? 'Ready' : 'Mock Mode'}</span>
        </div>
      </div>
    </header>
  );
}
