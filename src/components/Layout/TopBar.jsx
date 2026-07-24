import React, { useRef, useEffect, useState } from 'react';
import { useDiagramStore, TYPE_DEFAULTS } from '../../store/useDiagramStore.js';
import ProjectMenu from './ProjectMenu.jsx';

export default function TopBar() {
  const nodes = useDiagramStore(s => s.nodes);
  const connections = useDiagramStore(s => s.connections);
  const zoom = useDiagramStore(s => s.zoom);
  const setZoom = useDiagramStore(s => s.setZoom);
  const setPan = useDiagramStore(s => s.setPan);
  const connectMode = useDiagramStore(s => s.connectMode);
  const toggleConnectMode = useDiagramStore(s => s.toggleConnectMode);
  const exportJSON = useDiagramStore(s => s.exportJSON);
  const importJSON = useDiagramStore(s => s.importJSON);
  const showToast = useDiagramStore(s => s.showToast);
  const openAddNodeModal = useDiagramStore(s => s.openAddNodeModal);
  const getPortConflicts = useDiagramStore(s => s.getPortConflicts);
  const getIpCollisions = useDiagramStore(s => s.getIpCollisions);
  const undo = useDiagramStore(s => s.undo);
  const redo = useDiagramStore(s => s.redo);
  const canUndo = useDiagramStore(s => s.history.past.length > 0);
  const canRedo = useDiagramStore(s => s.history.future.length > 0);
  const autoScaleCanvas = useDiagramStore(s => s.autoScaleCanvas);
  const views = useDiagramStore(s => s.views);
  const activeViewId = useDiagramStore(s => s.activeViewId);
  const createView = useDiagramStore(s => s.createView);
  const switchView = useDiagramStore(s => s.switchView);
  const renameView = useDiagramStore(s => s.renameView);
  const deleteView = useDiagramStore(s => s.deleteView);
  const toggleViewHiddenType = useDiagramStore(s => s.toggleViewHiddenType);
  const saveViewCamera = useDiagramStore(s => s.saveViewCamera);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewsPos, setViewsPos] = useState({ top: 0, left: 0 });
  const [savePos, setSavePos] = useState({ top: 0, right: 0 });
  const activeView = views.find(v => v.id === activeViewId) || views[0];
  const fileRef = useRef(null);
  const viewsTriggerRef = useRef(null);
  const saveTriggerRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useDiagramStore.getState().redo(); else useDiagramStore.getState().undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useDiagramStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!viewsOpen && !saveOpen) return;
    const close = () => { setViewsOpen(false); setSaveOpen(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [viewsOpen, saveOpen]);

  // The topbar scrolls horizontally and clips vertical overflow, so these
  // dropdowns are anchored with fixed positioning to their trigger's
  // on-screen location instead of relying on CSS absolute positioning
  // inside the (clipping) topbar — otherwise the canvas below would
  // visually cover the bottom of the panel.
  useEffect(() => {
    if (!viewsOpen) return;
    const rect = viewsTriggerRef.current?.getBoundingClientRect();
    if (rect) setViewsPos({ top: rect.bottom + 6, left: rect.left });
  }, [viewsOpen]);
  useEffect(() => {
    if (!saveOpen) return;
    const rect = saveTriggerRef.current?.getBoundingClientRect();
    if (rect) setSavePos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, [saveOpen]);

  const nodeCount = Object.keys(nodes).length;
  const connCount = Object.keys(connections).length;
  const portConflicts = getPortConflicts();
  const ipCollisions = getIpCollisions();

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hexlab-workspace.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Give the browser a tick to actually start the download before the
    // blob URL is revoked — revoking synchronously right after click() can
    // race the download start in some browsers and silently cancel it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Workspace exported');
  };

  const handleImportClick = () => fileRef.current?.click();
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importJSON(reader.result);
      showToast(ok ? 'Workspace imported' : 'Import failed — invalid JSON', ok ? 'info' : 'warn');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="topbar">
      <ProjectMenu />
      <div className="topbar-sep" />
      <div className="telemetry-readout"><span>NODES</span><b>{nodeCount}</b></div>
      <div className="telemetry-readout"><span>LINKS</span><b>{connCount}</b></div>
      {(portConflicts.length > 0 || ipCollisions.length > 0) && (
        <div className="telemetry-readout" style={{ color: 'var(--c-alert)' }}>
          ⚠ {portConflicts.length + ipCollisions.length} ALERT{portConflicts.length + ipCollisions.length !== 1 ? 'S' : ''}
        </div>
      )}

      <div className="spacer" />

      <button className="btn icon-only" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
      <button className="btn icon-only" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>

      <div className="topbar-sep" />

      <button
        className={`btn ${connectMode ? 'active' : ''}`}
        onClick={toggleConnectMode}
        title="Draw a link between two nodes. Linking two Applications copies the first node's data onto the second and symlinks them."
      >⌁ Link Tool</button>
      <button className="btn" onClick={autoScaleCanvas} title="Zoom/pan to fit everything on the canvas at a reasonable size">⤡ Auto Scale</button>

      <div className="topbar-sep" />

      <div className="views-dropdown">
        <button ref={viewsTriggerRef} className="btn" onClick={(e) => { e.stopPropagation(); setViewsOpen(o => !o); }} title="Views share the same links and applications — they only change which node types are visible, useful for decluttering networks vs hardware">
          👁 View: {activeView?.name || 'All'} ▾
        </button>
        {viewsOpen && (
          <div className="views-panel" style={{ position: 'fixed', top: viewsPos.top, left: viewsPos.left }} onClick={(e) => e.stopPropagation()}>
            <div className="views-list">
              {views.map(v => (
                <div key={v.id} className={`views-list-row ${v.id === activeViewId ? 'active' : ''}`}>
                  <span onClick={() => { switchView(v.id); }}>{v.name}</span>
                  {v.id !== 'default' && <button className="btn icon-only small" title="Delete view" onClick={() => deleteView(v.id)}>✕</button>}
                </div>
              ))}
            </div>
            <button
              className="btn small"
              style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
              onClick={() => { const name = prompt('New view name?'); if (name) createView(name); }}
            >+ New View</button>
            <div className="views-panel-sep" />
            <div className="views-panel-label">Hide node types in this view</div>
            {Object.keys(TYPE_DEFAULTS).map(type => (
              <div key={type} className="toggle-row">
                <span className="toggle-row-label">{TYPE_DEFAULTS[type].label}</span>
                <div className={`mini-switch ${!activeView?.hiddenTypes.includes(type) ? 'on' : ''}`} onClick={() => toggleViewHiddenType(type)}><div className="knob" /></div>
              </div>
            ))}
            <button className="btn small" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => { saveViewCamera(); showToast('View camera saved'); }}>
              Save current pan/zoom to this view
            </button>
          </div>
        )}
      </div>

      <div className="topbar-sep" />

      <div className="topbar-group">
        <button className="btn icon-only" onClick={() => setZoom(zoom - 0.1)} title="Zoom out">−</button>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
        <button className="btn icon-only" onClick={() => setZoom(zoom + 0.1)} title="Zoom in">+</button>
        <button className="btn small" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom and pan">Reset</button>
      </div>

      <div className="topbar-sep" />

      <button className="btn primary" onClick={() => openAddNodeModal(null)} title="Add a new node to the canvas">+ Add Node</button>
      <div className="views-dropdown">
        <button ref={saveTriggerRef} className="btn" onClick={(e) => { e.stopPropagation(); setSaveOpen(o => !o); }} title="Export or import a workspace configuration file">
          💾 Save ▾
        </button>
        {saveOpen && (
          <div className="views-panel" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: savePos.top, left: 'auto', right: savePos.right, minWidth: 220 }}>
            <button className="btn small" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }} onClick={() => { handleExport(); setSaveOpen(false); }} title="Download the workspace as a JSON configuration file">⇩ Export Configuration</button>
            <button className="btn small" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { handleImportClick(); setSaveOpen(false); }} title="Load a previously exported configuration file">⇧ Import Configuration</button>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
    </div>
  );
}
