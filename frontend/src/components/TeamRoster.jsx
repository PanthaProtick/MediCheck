import React, { useEffect, useState } from 'react';
import { Users, ShieldCheck, Code, Layers } from 'lucide-react';
import { fetchTeam } from '../services/api';

export default function TeamRoster() {
  const [team, setTeam] = useState([]);

  useEffect(() => {
    fetchTeam().then((data) => {
      if (data?.team) setTeam(data.team);
    });
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Users size={20} color="#6366f1" />
            <span>Hackathon Team & Capability Matrix</span>
          </div>
          <p className="card-subtitle">
            Synchronized with <code style={{ color: '#c7d2fe' }}>docs/team_skills.md</code>
          </p>
        </div>
      </div>

      <div className="team-grid">
        {team.map((member, idx) => (
          <div key={idx} className="member-card">
            <div className="member-header">
              <div className="avatar">
                {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h4 className="member-name">{member.name}</h4>
                <p className="member-role">{member.role}</p>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              <strong>Strengths & Focus:</strong>
            </div>

            <div className="tag-list">
              {member.strengths.map((s, sIdx) => (
                <span key={sIdx} className="tag">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(10, 14, 23, 0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={15} color="#06b6d4" />
          <span>Workstream Strategy</span>
        </h4>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Frontend UI/UX led by Yousha with Tanvir & Partha. Backend, APIs, and Data modeling handled collaboratively by Pantha, Tanvir, and Partha. AI/ML and System deployment directed by Pantha.
        </p>
      </div>
    </div>
  );
}
