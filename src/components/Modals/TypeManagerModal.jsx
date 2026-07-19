import React, { useState } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';

export default function TypeManagerModal() {
  const open = useDiagramStore(s => s.typeManagerOpen);
  const toggle = useDiagramStore(s => s.toggleTypeManager);
  const customTypes = useDiagramStore(s => s.customTypes);
  const addCustomType = useDiagramStore(s => s.addCustomType);
  const removeCustomType = useDiagramStore(s => s.removeCustomType);

  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#71717A');
  const [attrs, setAttrs] = useState([{ key: '', label: '' }]);

  if (!open) return null;

  const addAttrRow = () => setAttrs([...attrs, { key: '', label: '' }]);
  const updateAttr = (i, patch) => setAttrs(attrs.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const removeAttr = (i) => setAttrs(attrs.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!label.trim()) return;
    const cleanAttrs = attrs.filter(a => a.key.trim()).map(a => ({ key: a.key.trim(), label: a.label.trim() || a.key.trim() }));
    addCustomType({ label: label.trim(), color, attrs: cleanAttrs });
    setLabel(''); setAttrs([{ key: '', label: '' }]);
  };

  return (
    <div className="modal-backdrop" onClick={toggle}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Custom Node Types</div>
          <button className="btn icon-only small" onClick={toggle}>✕</button>
        </div>
        <div className="modal-body">
          <div className="inspector-section-title">Existing Custom Types</div>
          {customTypes.length === 0 && <div className="rail-empty">No custom types declared yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {customTypes.map(ct => (
              <div key={ct.id} className="rail-row">
                <span><span className="swatch" style={{ background: ct.color }} />{ct.label} <span style={{ color: 'var(--text-dim)' }}>({ct.attrs.length} attrs)</span></span>
                <button className="btn small danger" onClick={() => removeCustomType(ct.id)}>Remove</button>
              </div>
            ))}
          </div>

          <div className="inspector-section-title" style={{ marginTop: 8 }}>Declare New Type</div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Label</label>
              <input className="field-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. NAS Appliance" />
            </div>
            <div className="field-group">
              <label className="field-label">Accent Color</label>
              <input type="color" className="color-input-native" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Custom Attribute Fields</label>
            {attrs.map((a, i) => (
              <div key={i} className="field-row" style={{ marginBottom: 6 }}>
                <input className="field-input" placeholder="key (e.g. firmware)" value={a.key} onChange={e => updateAttr(i, { key: e.target.value })} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="field-input" placeholder="display label" value={a.label} onChange={e => updateAttr(i, { label: e.target.value })} />
                  <button className="btn icon-only small danger" onClick={() => removeAttr(i)}>✕</button>
                </div>
              </div>
            ))}
            <button className="btn small" onClick={addAttrRow}>+ Add Attribute</button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={toggle}>Close</button>
          <button className="btn primary" onClick={submit}>Save Type</button>
        </div>
      </div>
    </div>
  );
}
