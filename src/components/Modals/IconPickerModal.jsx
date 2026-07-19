import React, { useState, useEffect } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';
import { resolveIcon, iconGlyphFor, searchIcons } from '../../utils/icons.js';

function IconThumb({ name, selected, onPick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    resolveIcon(name).then(res => { if (!cancelled) setUrl(res.url); });
    return () => { cancelled = true; };
  }, [name]);
  return (
    <button
      className={`icon-grid-thumb ${selected ? 'selected' : ''}`}
      onClick={() => onPick(name)}
      title={name}
      type="button"
    >
      {url ? <img src={url} width="22" height="22" alt="" /> : <span className="icon-grid-thumb-fallback">{name.slice(0, 2).toUpperCase()}</span>}
      <span className="icon-grid-thumb-label">{name}</span>
    </button>
  );
}

// Search-and-select icon picker: type to filter the dashboard-icons library
// and click a result, rather than having to already know (or guess) the
// exact icon slug in a plain text field.
export default function IconPickerModal() {
  const iconPickerNodeId = useDiagramStore(s => s.iconPickerNodeId);
  const closeIconPicker = useDiagramStore(s => s.closeIconPicker);
  const node = useDiagramStore(s => (iconPickerNodeId ? s.nodes[iconPickerNodeId] : null));
  const updateNode = useDiagramStore(s => s.updateNode);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const RENDER_CAP = 240;

  useEffect(() => {
    setQuery('');
  }, [iconPickerNodeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchIcons(query).then(names => { if (!cancelled) { setResults(names); setLoading(false); } });
    return () => { cancelled = true; };
  }, [query]);

  if (!iconPickerNodeId || !node) return null;

  const pick = (name) => { updateNode(node.id, { icon: name }); closeIconPicker(); };
  const clear = () => { updateNode(node.id, { icon: null }); closeIconPicker(); };
  const shown = results.slice(0, RENDER_CAP);

  return (
    <div className="modal-backdrop" onClick={closeIconPicker}>
      <div className="modal-panel" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Set Icon — {node.name}</div>
          <button className="btn icon-only small" onClick={closeIconPicker}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="field-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search icons, or browse everything below…"
            autoFocus
          />
          <div className="icon-grid">
            {loading && <div className="rail-empty">Loading icons…</div>}
            {!loading && results.length === 0 && <div className="rail-empty">No icons match "{query}".</div>}
            {!loading && shown.map(name => (
              <IconThumb key={name} name={name} selected={node.icon === name} onPick={pick} />
            ))}
          </div>
          {!loading && results.length > RENDER_CAP && (
            <div className="rail-empty">Showing {RENDER_CAP} of {results.length} — keep typing to narrow it down.</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="icon-preview-box">
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--nc-color, var(--c-device))" strokeWidth="2" fill="none">
                <path d={iconGlyphFor(node.type)} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {node.icon ? `Current: ${node.icon}` : 'Using default type icon'}
            </span>
            {node.icon && <button className="btn small" onClick={clear} style={{ marginLeft: 'auto' }}>Clear / Use Default</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
