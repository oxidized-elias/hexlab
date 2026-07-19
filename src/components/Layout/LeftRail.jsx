import React, { useState } from 'react';
import { useDiagramStore, TYPE_DEFAULTS } from '../../store/useDiagramStore.js';

const PALETTE_ORDER = ['internet', 'group', 'network', 'firewall', 'device', 'hypervisor', 'k8s', 'docker', 'storage', 'storagepool', 'directory', 'application'];

export default function LeftRail() {
  const [paletteSearch, setPaletteSearch] = useState('');
  const addNode = useDiagramStore(s => s.addNode);
  const gridSnapEnabled = useDiagramStore(s => s.gridSnapEnabled);
  const toggleGridSnap = useDiagramStore(s => s.toggleGridSnap);
  const nodes = useDiagramStore(s => s.nodes);
  const vlanFilter = useDiagramStore(s => s.vlanFilter);
  const setVlanFilter = useDiagramStore(s => s.setVlanFilter);
  const toggleTypeManager = useDiagramStore(s => s.toggleTypeManager);
  const customTypes = useDiagramStore(s => s.customTypes);
  const pan = useDiagramStore(s => s.pan);
  const zoom = useDiagramStore(s => s.zoom);
  const hierarchyEnforced = useDiagramStore(s => s.hierarchyEnforced);
  const toggleHierarchyEnforced = useDiagramStore(s => s.toggleHierarchyEnforced);
  const minimalUi = useDiagramStore(s => s.minimalUi);
  const toggleMinimalUi = useDiagramStore(s => s.toggleMinimalUi);

  const vlans = Array.from(new Set(Object.values(nodes)
    .filter(n => n.type === 'network' && n.fields.vlanId)
    .map(n => n.fields.vlanId)));

  const centerWorld = () => ({
    x: (-pan.x + 400) / zoom,
    y: (-pan.y + 250) / zoom,
  });

  const quickAdd = (type) => addNode(type, centerWorld());

  return (
    <div className="rail">
      <div>
        <div className="rail-section-title">Quick-Add Node</div>
        <input
          className="field-input palette-search"
          placeholder="Search node types…"
          value={paletteSearch}
          onChange={(e) => setPaletteSearch(e.target.value)}
        />
        <div className="palette-list">
          {PALETTE_ORDER.filter(type => TYPE_DEFAULTS[type].label.toLowerCase().includes(paletteSearch.toLowerCase())).map(type => (
            <button
              key={type}
              className="palette-btn"
              style={{ '--type-color': TYPE_DEFAULTS[type].color }}
              onClick={() => quickAdd(type)}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('application/x-hexlab-node-type', type); e.dataTransfer.effectAllowed = 'copy'; }}
              title="Click to add at center, or drag onto the canvas to place it exactly"
            >
              <span className="pb-label">{TYPE_DEFAULTS[type].label}</span>
            </button>
          ))}
          {customTypes.filter(ct => ct.label.toLowerCase().includes(paletteSearch.toLowerCase())).map(ct => (
            <button
              key={ct.id}
              className="palette-btn"
              style={{ '--type-color': ct.color }}
              onClick={() => addNode('application', { ...centerWorld(), custom: ct })}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('application/x-hexlab-custom-type', ct.id); e.dataTransfer.effectAllowed = 'copy'; }}
              title="Click to add at center, or drag onto the canvas to place it exactly"
            >
              <span className="pb-label">{ct.label} (custom)</span>
            </button>
          ))}
          {PALETTE_ORDER.filter(type => TYPE_DEFAULTS[type].label.toLowerCase().includes(paletteSearch.toLowerCase())).length === 0 &&
            customTypes.filter(ct => ct.label.toLowerCase().includes(paletteSearch.toLowerCase())).length === 0 && (
            <div className="rail-empty">No node types match "{paletteSearch}".</div>
          )}
        </div>
        <button className="btn small" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={toggleTypeManager}>
          ✎ Manage Custom Types
        </button>
      </div>

      <div>
        <div className="rail-section-title">Canvas Controls</div>
        <div className="toggle-row" title="Snap node positions and sizes to a 20px grid while dragging/resizing.">
          <span className="toggle-row-label">Grid Snapping</span>
          <div className={`mini-switch ${gridSnapEnabled ? 'on' : ''}`} onClick={toggleGridSnap}><div className="knob" /></div>
        </div>
        <div className="toggle-row" title="When on, nesting is restricted by logical containment rules (e.g. a VM can only be dropped inside a Hypervisor). Turn off for a freeform diagram.">
          <span className="toggle-row-label">Enforce Hierarchy Order</span>
          <div className={`mini-switch ${hierarchyEnforced ? 'on' : ''}`} onClick={toggleHierarchyEnforced}><div className="knob" /></div>
        </div>
        <div className="toggle-row" title="Icon-only canvas view — hides node detail text, keeping only the type icon and name.">
          <span className="toggle-row-label">Minimal UI</span>
          <div className={`mini-switch ${minimalUi ? 'on' : ''}`} onClick={toggleMinimalUi}><div className="knob" /></div>
        </div>
      </div>

      <div>
        <div className="rail-section-title">VLAN / Subnet Isolation</div>
        {vlans.length === 0 && <div className="rail-empty">No VLAN IDs declared on Network nodes.</div>}
        <div className="rail-list">
          {vlans.map(v => (
            <div key={v} className={`rail-row ${vlanFilter === v ? 'active' : ''}`} onClick={() => setVlanFilter(vlanFilter === v ? null : v)}>
              <span><span className="swatch" style={{ background: TYPE_DEFAULTS.network.color }} />VLAN {v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
