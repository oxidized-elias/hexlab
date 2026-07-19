import React, { useState } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';

export default function NewProjectModal({ mandatory, onCreate }) {
  const open = useDiagramStore(s => s.newProjectModalOpen);
  const closeNewProjectModal = useDiagramStore(s => s.closeNewProjectModal);
  const [name, setName] = useState('');

  if (!open) return null;

  const submit = () => {
    onCreate(name || 'Untitled Project');
    setName('');
  };

  return (
    <div className="modal-backdrop" onClick={mandatory ? undefined : closeNewProjectModal}>
      <div className="modal-panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{mandatory ? 'Welcome to HexLab — Create Your First Project' : 'New Project'}</div>
          {!mandatory && <button className="btn icon-only small" onClick={closeNewProjectModal}>✕</button>}
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field-label-block">
            Project Name
            <input
              className="field-input"
              placeholder="e.g. Homelab, Client Network A"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </label>

          <button className="btn primary" onClick={submit} style={{ marginTop: 6 }}>Create Project</button>
        </div>
      </div>
    </div>
  );
}
