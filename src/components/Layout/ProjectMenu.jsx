import React, { useState, useRef, useEffect } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';

export default function ProjectMenu() {
  const projects = useDiagramStore(s => s.projects);
  const activeProjectId = useDiagramStore(s => s.activeProjectId);
  const switchProject = useDiagramStore(s => s.switchProject);
  const renameProject = useDiagramStore(s => s.renameProject);
  const deleteProject = useDiagramStore(s => s.deleteProject);
  const openNewProjectModal = useDiagramStore(s => s.openNewProjectModal);
  const openProjectSettings = useDiagramStore(s => s.openProjectSettings);

  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const active = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); } };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  // The topbar scrolls horizontally and clips vertical overflow, so the
  // dropdown is anchored with fixed positioning to the trigger's on-screen
  // location instead of relying on CSS absolute positioning inside the
  // (clipping) topbar — otherwise the canvas below would visually cover
  // the bottom of the panel.
  useEffect(() => {
    if (!open) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setDropdownPos({ top: rect.bottom + 6, left: rect.left });
  }, [open]);

  return (
    <div className="project-menu" ref={ref}>
      <button className="brand project-menu-trigger" onClick={() => setOpen(o => !o)}>
        <span className="dot" />{active?.name || 'Hexlab'}<span className="pm-caret">▾</span>
      </button>
      {open && (
        <div className="project-menu-dropdown" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}>
          <div className="pm-section-title">Projects</div>
          {projects.map(p => (
            <div key={p.id} className={`pm-project-row ${p.id === activeProjectId ? 'active' : ''}`}>
              {renamingId === p.id ? (
                <input
                  className="field-input small"
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { renameProject(p.id, renameValue); setRenamingId(null); } if (e.key === 'Escape') setRenamingId(null); }}
                  onBlur={() => { renameProject(p.id, renameValue); setRenamingId(null); }}
                />
              ) : (
                <span className="pm-project-name" onClick={() => { switchProject(p.id); setOpen(false); }}>{p.name}</span>
              )}
              <span className="pm-project-actions">
                <button className="btn icon-only tiny" title="Rename" onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }}>✎</button>
                <button
                  className="btn icon-only tiny"
                  title="Delete"
                  onClick={() => { if (window.confirm(`Delete project "${p.name}"? This cannot be undone.`)) deleteProject(p.id); }}
                >✕</button>
              </span>
            </div>
          ))}
          <button className="btn small" style={{ width: '100%', marginTop: 6 }} onClick={() => { openNewProjectModal(); setOpen(false); }}>+ New Project</button>
          <button className="btn small" style={{ width: '100%', marginTop: 6 }} onClick={() => { openProjectSettings(); setOpen(false); }}>⚙ Project Settings</button>
        </div>
      )}
    </div>
  );
}
