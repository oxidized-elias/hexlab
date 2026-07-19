import React from 'react';
import { useDiagramStore, TYPE_DEFAULTS } from '../../store/useDiagramStore.js';
import { TypeFields, Field } from '../Inspector/Inspector.jsx';
import ColorPickerPopover from '../Common/ColorPickerPopover.jsx';

// Right-click "Edit" opens this instead of only the (sometimes cramped)
// right-hand Inspector sidebar — a full-size modal overlay with every field
// for the node laid out in a comfortable two-column form, so editing a
// heavily-configured node doesn't require constant scrolling.
export default function EditNodeModal() {
  const editNodeId = useDiagramStore(s => s.editNodeId);
  const closeEditNode = useDiagramStore(s => s.closeEditNode);
  const node = useDiagramStore(s => (editNodeId ? s.nodes[editNodeId] : null));
  const updateNode = useDiagramStore(s => s.updateNode);
  const updateNodeFields = useDiagramStore(s => s.updateNodeFields);
  const openIconPicker = useDiagramStore(s => s.openIconPicker);

  if (!editNodeId || !node) return null;

  const def = TYPE_DEFAULTS[node.type] || { color: '#71717A' };
  const color = node.color || def.color;
  const set = (patch) => updateNode(node.id, patch);
  const setF = (patch) => updateNodeFields(node.id, patch);

  return (
    <div className="modal-backdrop" onClick={closeEditNode}>
      <div className="modal-panel edit-overlay-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit — {node.name}</div>
            <div className="inspector-subtype">{node.type}{node.customTypeId ? ' · custom' : ''}</div>
          </div>
          <button className="btn icon-only small" onClick={closeEditNode}>✕</button>
        </div>
        <div className="modal-body edit-overlay-grid">
          <div>
            <Field label="Name">
              <input className="field-input" value={node.name} onChange={e => set({ name: e.target.value })} />
            </Field>
            <Field label="Accent Color Override">
              <ColorPickerPopover
                value={color}
                onChange={(c) => set({ color: c })}
                onReset={() => set({ color: null })}
                resettable={!!node.color}
              />
            </Field>
            <Field label="Icon">
              <button className="btn small" onClick={() => openIconPicker(node.id)}>🖼 Choose Icon…</button>
            </Field>
          </div>
          <div>
            <div className="inspector-section-title" style={{ marginTop: 0 }}>Configuration</div>
            <TypeFields node={node} setF={setF} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn primary" onClick={closeEditNode}>Done</button>
        </div>
      </div>
    </div>
  );
}
