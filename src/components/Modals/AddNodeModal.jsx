import React from 'react';
import { useDiagramStore, TYPE_DEFAULTS } from '../../store/useDiagramStore.js';

const DESCRIPTIONS = {
  group: 'Aesthetic or functional bounding box',
  network: 'VLAN / subnet containment box',
  firewall: 'OPNsense/pfSense-style perimeter appliance',
  device: 'Physical hardware, racks, switches',
  hypervisor: 'Proxmox / ESXi — hosts Virtual Machines',
  vm: 'Virtual Machine — only nests inside a Hypervisor',
  k8s: 'Kubernetes cluster host',
  docker: 'Docker container host',
  storage: 'Disks, pools, RAID/ZFS arrays',
  storagepool: 'Container that groups multiple drives together',
  directory: 'Local or symlinked folder, backups',
  application: 'A running service or container',
  internet: 'WAN uplink / ISP connection',
};

export default function AddNodeModal() {
  const modal = useDiagramStore(s => s.addNodeModal);
  const closeAddNodeModal = useDiagramStore(s => s.closeAddNodeModal);
  const addNode = useDiagramStore(s => s.addNode);
  const customTypes = useDiagramStore(s => s.customTypes);
  const pan = useDiagramStore(s => s.pan);
  const zoom = useDiagramStore(s => s.zoom);

  if (!modal) return null;

  const centerWorld = () => ({ x: (-pan.x + 400) / zoom, y: (-pan.y + 250) / zoom, parentId: modal.parentId });

  const pick = (type, custom = null) => {
    addNode(type, { ...centerWorld(), custom });
    closeAddNodeModal();
  };

  return (
    <div className="modal-backdrop" onClick={closeAddNodeModal}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Select Node Class</div>
          <button className="btn icon-only small" onClick={closeAddNodeModal}>✕</button>
        </div>
        <div className="modal-body">
          <div className="type-select-grid">
            {Object.entries(TYPE_DEFAULTS).map(([type, def]) => (
              <button key={type} className="type-select-card" style={{ '--type-color': def.color }} onClick={() => pick(type)}>
                <span className="tsc-label">{def.label}</span>
                <span className="tsc-desc">{DESCRIPTIONS[type]}</span>
              </button>
            ))}
            {customTypes.map(ct => (
              <button key={ct.id} className="type-select-card" style={{ '--type-color': ct.color }} onClick={() => pick('application', ct)}>
                <span className="tsc-label">{ct.label}</span>
                <span className="tsc-desc">Custom type</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
