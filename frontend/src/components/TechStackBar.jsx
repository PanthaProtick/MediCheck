import React from 'react';
import { Layers, Zap, Database, Sparkles, Terminal } from 'lucide-react';

export default function TechStackBar() {
  const stack = [
    { name: 'React + Vite', icon: Layers, desc: 'Frontend UI & Reactive Components', color: '#61dafb' },
    { name: 'FastAPI', icon: Zap, desc: 'High-speed Async Python API', color: '#009688' },
    { name: 'Neon Postgres', icon: Database, desc: 'Serverless Branchable DB', color: '#00e599' },
    { name: 'Google Gemini', icon: Sparkles, desc: 'Multimodal LLM & Reasoning', color: '#a855f7' },
    { name: 'uv (Astral)', icon: Terminal, desc: 'Ultra-fast Python Package Manager', color: '#f59e0b' }
  ];

  return (
    <div className="tech-strip">
      {stack.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={idx} className="tech-chip" title={item.desc}>
            <Icon size={16} color={item.color} />
            <span>{item.name}</span>
          </div>
        );
      })}
    </div>
  );
}
