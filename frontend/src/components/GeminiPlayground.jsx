import React, { useState } from 'react';
import { Sparkles, Send, Lightbulb, RefreshCw } from 'lucide-react';
import { sendChatMessage, generateIdea } from '../services/api';

export default function GeminiPlayground() {
  // Chat state
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your hackathon assistant powered by Google Gemini. Ask me to outline architecture, draft API models, or refine your pitch.',
      model: 'gemini-2.5-flash'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Idea generator state
  const [topic, setTopic] = useState('AI Code Reviewer for Git PRs');
  const [audience, setAudience] = useState('Developers and Engineering Teams');
  const [ideaResult, setIdeaResult] = useState(null);
  const [isIdeaLoading, setIsIdeaLoading] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;

    const userText = inputMessage;
    setInputMessage('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      const res = await sendChatMessage(userText);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.reply,
          model: res.model,
          isMock: res.is_mock
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: `Error generating response: ${err.message}`, isError: true }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateIdea = async () => {
    if (!topic.trim() || isIdeaLoading) return;
    setIsIdeaLoading(true);
    try {
      const idea = await generateIdea(topic, audience);
      setIdeaResult(idea);
    } catch (err) {
      console.error(err);
    } finally {
      setIsIdeaLoading(false);
    }
  };

  return (
    <div className="grid-2">
      {/* Interactive Chat */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Sparkles size={18} color="#6366f1" />
              <span>Gemini AI Chat Loop</span>
            </div>
            <p className="card-subtitle">Fast multimodal responses via FastAPI backend</p>
          </div>
        </div>

        <div className="chat-container">
          {messages.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.sender}`}>
              <div>{msg.text}</div>
              {msg.model && (
                <div className="message-meta">
                  {msg.model} {msg.isMock ? '• [Mock Mode]' : '• [Live API]'}
                </div>
              )}
            </div>
          ))}
          {isChatLoading && (
            <div className="message-bubble ai" style={{ opacity: 0.7 }}>
              <span>Thinking with Gemini...</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="text-input"
            placeholder="Ask Gemini anything about your hackathon app..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isChatLoading}
          />
          <button type="submit" className="btn btn-primary" disabled={isChatLoading || !inputMessage.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Structured Output Idea Generator */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Lightbulb size={18} color="#f59e0b" />
              <span>Structured Pitch Generator</span>
            </div>
            <p className="card-subtitle">Pydantic-enforced structured JSON output</p>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Project Topic / Problem</label>
          <input
            type="text"
            className="text-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. AI-assisted Medical Triage, Carbon Footprint Tracker"
          />
        </div>

        <div className="input-group">
          <label className="input-label">Target Audience</label>
          <input
            type="text"
            className="text-input"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. University Students, Emergency Clinics"
          />
        </div>

        <button
          onClick={handleGenerateIdea}
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={isIdeaLoading}
        >
          {isIdeaLoading ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>Synthesizing Concept...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Generate Hackathon Pitch</span>
            </>
          )}
        </button>

        {ideaResult && (
          <div className="idea-box">
            <h3 className="idea-title">{ideaResult.title}</h3>
            <p className="idea-tagline">"{ideaResult.tagline}"</p>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <strong>Target Users:</strong> {ideaResult.target_users}
            </div>

            <ul className="feature-list">
              {ideaResult.core_features?.map((feat, idx) => (
                <li key={idx} className="feature-item">
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <div className="tag-list" style={{ marginTop: '8px' }}>
              {ideaResult.suggested_tech_stack?.map((tech, idx) => (
                <span key={idx} className="tag">{tech}</span>
              ))}
            </div>

            <div className="pitch-hook">
              <strong>Winning Hook:</strong> {ideaResult.winning_pitch_hook}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
