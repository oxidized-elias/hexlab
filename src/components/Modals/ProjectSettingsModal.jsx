import React from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';

// Project Settings — configuration that is scoped to (and persisted with)
// the currently active project, as opposed to global app chrome. Currently
// centers on Hierarchy Mode (order-sensitive nesting rules), since that's
// exactly the kind of thing one project might want strict and another
// might want freeform.
export default function ProjectSettingsModal() {
  const open = useDiagramStore(s => s.projectSettingsOpen);
  const close = useDiagramStore(s => s.closeProjectSettings);
  const hierarchyEnforced = useDiagramStore(s => s.hierarchyEnforced);
  const toggleHierarchyEnforced = useDiagramStore(s => s.toggleHierarchyEnforced);
  const minimalUi = useDiagramStore(s => s.minimalUi);
  const toggleMinimalUi = useDiagramStore(s => s.toggleMinimalUi);
  const gridSnapEnabled = useDiagramStore(s => s.gridSnapEnabled);
  const toggleGridSnap = useDiagramStore(s => s.toggleGridSnap);
  const projects = useDiagramStore(s => s.projects);
  const activeProjectId = useDiagramStore(s => s.activeProjectId);
  const active = projects.find(p => p.id === activeProjectId);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Project Settings — {active?.name || 'Untitled'}</div>
          <button className="btn icon-only small" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          <div className="inspector-section-title">Hierarchy Mode</div>
          <div className="toggle-row" title="When on, nesting is restricted by logical containment rules (e.g. a VM can only be dropped inside a Hypervisor, an Application only inside a runtime host). Turn off for a fully freeform diagram in this project.">
            <span className="toggle-row-label">Enforce Hierarchy Order</span>
            <div className={`mini-switch ${hierarchyEnforced ? 'on' : ''}`} onClick={toggleHierarchyEnforced}><div className="knob" /></div>
          </div>
          <div className="rail-empty">
            {hierarchyEnforced
              ? 'Strict: nodes may only nest inside logically valid parent types (Physical Machines on top, Hypervisor/VM inside, Docker inside that, Applications innermost).'
              : 'Freeform: any node can be nested inside any container, purely for aesthetic/manual layout.'}
          </div>

          <div className="inspector-section-title" style={{ marginTop: 6 }}>Display</div>
          <div className="toggle-row" title="Icon-only canvas view — hides node detail text, keeping only the type icon and name.">
            <span className="toggle-row-label">Minimal UI (canvas)</span>
            <div className={`mini-switch ${minimalUi ? 'on' : ''}`} onClick={toggleMinimalUi}><div className="knob" /></div>
          </div>
          <div className="toggle-row">
            <span className="toggle-row-label">Grid Snapping</span>
            <div className={`mini-switch ${gridSnapEnabled ? 'on' : ''}`} onClick={toggleGridSnap}><div className="knob" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn primary" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  );
}
