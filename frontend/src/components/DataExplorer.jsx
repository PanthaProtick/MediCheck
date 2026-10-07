import React, { useState, useEffect } from 'react';
import { Database, Plus, Check, Tag } from 'lucide-react';
import { fetchItems, createItem } from '../services/api';

export default function DataExplorer() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('FastAPI, Postgres');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadItems = () => {
    fetchItems().then(setItems);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const newItem = await createItem({
      title,
      description: desc,
      tags: tagList
    });

    setItems((prev) => [newItem, ...prev]);
    setTitle('');
    setDesc('');
    setIsSubmitting(false);
  };

  return (
    <div className="grid-2">
      {/* Create Item Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Plus size={18} color="#10b981" />
              <span>Create Record</span>
            </div>
            <p className="card-subtitle">Test persistence and API data round-trips</p>
          </div>
        </div>

        <form onSubmit={handleAddItem}>
          <div className="input-group">
            <label className="input-label">Title</label>
            <input
              type="text"
              className="text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. User Profile Feature"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea
              className="text-area"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Brief details about this record..."
            />
          </div>

          <div className="input-group">
            <label className="input-label">Tags (comma separated)</label>
            <input
              type="text"
              className="text-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Auth, API, UI"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting || !title.trim()}>
            <Check size={16} />
            <span>Save to Database / Memory</span>
          </button>
        </form>
      </div>

      {/* Record List */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Database size={18} color="#06b6d4" />
              <span>Existing Records ({items.length})</span>
            </div>
            <p className="card-subtitle">Active items stored in backend memory or Neon</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '14px',
                background: 'rgba(10, 14, 23, 0.6)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>{item.title}</h4>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {item.description && (
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {item.description}
                </p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="tag-list" style={{ marginTop: '8px' }}>
                  {item.tags.map((tg, idx) => (
                    <span key={idx} className="tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={10} />
                      <span>{tg}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No records found. Create one using the form on the left!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
