import React, { useState, useEffect } from 'react';
import { useDiagramStore, TYPE_DEFAULTS } from '../../store/useDiagramStore.js';
import { iconGlyphFor, resolveIcon } from '../../utils/icons.js';

// First "sub" line — a short type-level label.
function subtitleFor(node) {
  const f = node.fields || {};
  switch (node.type) {
    case 'device': return f.model || f.os || 'No model set';
    case 'firewall': return (f.firewallOs === 'Other' ? f.firewallOsOther : f.firewallOs) || 'Firewall';
    case 'network': return f.cidr || 'No CIDR set';
    case 'hypervisor': return f.hostOs || 'Hypervisor';
    case 'vm': return f.guestOs || 'Virtual Machine';
    case 'k8s': return `${f.nodeRole || 'Worker'} · ${f.namespace || 'default'}`;
    case 'docker': return f.networkMode || 'bridge';
    case 'storage': return f.subtype || 'Storage';
    case 'storagepool': return f.fsType || 'Storage Pool';
    case 'internet': return f.isp || 'Internet / WAN';
    case 'directory': return f.subtype || 'Directory';
    case 'application': return f.port ? `:${f.port}` : (f.image || 'No image set');
    case 'group': return f.mode === 'functional' ? 'Functional Group' : 'Aesthetic Group';
    default: return node.customTypeId ? 'Custom Type' : '';
  }
}

// Second "info" line — distinct detail, so storage/directory (and others)
// don't just repeat the subtype twice.
function infoFor(node) {
  const f = node.fields || {};
  switch (node.type) {
    case 'device': return f.ip || 'No IP set';
    case 'firewall': return f.wanIp || f.lanCidr || 'No WAN/LAN set';
    case 'network': return f.gateway ? `gw ${f.gateway}` : 'No gateway set';
    case 'hypervisor': return f.totalCpu || f.totalRam ? `${f.totalCpu || '—'} / ${f.totalRam || '—'}` : 'No specs set';
    case 'vm': return f.ip || (f.vCpu || f.vRam ? `${f.vCpu || '—'} / ${f.vRam || '—'}` : 'No IP set');
    case 'k8s': return f.apiEndpoint || 'No API endpoint set';
    case 'docker': return f.env ? 'Env configured' : 'No env vars';
    case 'storage': return f.capacity ? (f.subtype === 'Storage Pool' ? `${f.capacity} · ${f.raidLevel || 'N/A'}` : f.capacity) : (f.mountPath || 'No capacity set');
    case 'storagepool': return f.capacity ? `${f.capacity} · ${f.raidLevel || 'N/A'}` : (f.mountPath || 'No capacity set');
    case 'internet': return f.publicIp || f.wanSpeed || 'No WAN info set';
    case 'directory': return f.subtype === 'Symlinked Directory' ? (f.symlinkTarget || 'No symlink target') : (f.isBackupJob ? `Backup → ${f.backupTarget || '—'}` : 'Local directory');
    case 'application': return f.status || 'Unknown status';
    case 'group': return `${f.mode === 'functional' ? 'Functional' : 'Aesthetic'} group`;
    default: return subtitleFor(node);
  }
}


export default function NodeCard({ node, isDropTarget, dimmed, conflicted, onContextMenu }) {
  const selectedIds = useDiagramStore(s => s.selectedIds);
  const select = useDiagramStore(s => s.select);
  const setNodePosition = useDiagramStore(s => s.setNodePosition);
  const growParentToFit = useDiagramStore(s => s.growParentToFit);
  const findDropTarget = useDiagramStore(s => s.findDropTarget);
  const reparentNode = useDiagramStore(s => s.reparentNode);
  const zoom = useDiagramStore(s => s.zoom);
  const connectMode = useDiagramStore(s => s.connectMode);
  const pendingConnectFrom = useDiagramStore(s => s.pendingConnectFrom);
  const setPendingConnectFrom = useDiagramStore(s => s.setPendingConnectFrom);
  const addConnection = useDiagramStore(s => s.addConnection);
  const linkApplications = useDiagramStore(s => s.linkApplications);
  const updateNode = useDiagramStore(s => s.updateNode);
  const openIconPicker = useDiagramStore(s => s.openIconPicker);
  const gridSnapEnabled = useDiagramStore(s => s.gridSnapEnabled);
  const bringToFront = useDiagramStore(s => s.bringToFront);
  const snapshotForUndo = useDiagramStore(s => s.snapshotForUndo);
  const resizeContainerWithChildren = useDiagramStore(s => s.resizeContainerWithChildren);

  const [dragging, setDragging] = useState(false);
  const def = TYPE_DEFAULTS[node.type] || { color: '#71717A', container: false };
  const color = node.color || def.color;
  const selected = selectedIds.includes(node.id);
  const isContainer = def.container;

  const offline = !!node.telemetry.endpoint && node.telemetry.status === 'offline';

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (connectMode) {
      if (!pendingConnectFrom) {
        setPendingConnectFrom(node.id);
      } else if (pendingConnectFrom !== node.id) {
        const fromNode = useDiagramStore.getState().nodes[pendingConnectFrom];
        if (fromNode?.type === 'application' && node.type === 'application') {
          linkApplications(pendingConnectFrom, node.id);
        } else {
          addConnection(pendingConnectFrom, node.id, 'link');
        }
        setPendingConnectFrom(null);
      }
      select(node.id);
      return;
    }

    // Shift-click toggles this node in/out of the multi-selection without
    // starting a drag, so people can build up a selection click by click.
    if (e.shiftKey) {
      select(node.id, true);
      return;
    }

    // Dragging a node that's already part of a multi-selection moves the
    // whole selection together; otherwise it collapses to just this node.
    const wasMultiSelected = selectedIds.length > 1 && selectedIds.includes(node.id);
    if (!wasMultiSelected) {
      select(node.id);
    }
    bringToFront(node.id);
    snapshotForUndo();
    const startX = e.clientX, startY = e.clientY;
    const dragIds = wasMultiSelected ? selectedIds : [node.id];
    const origins = {};
    dragIds.forEach(id => {
      const n = useDiagramStore.getState().nodes[id];
      if (n) origins[id] = { x: n.x, y: n.y };
    });
    let moved = false;
    setDragging(true);

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      dragIds.forEach(id => {
        const origin = origins[id];
        if (!origin) return;
        let nx = origin.x + dx, ny = origin.y + dy;
        if (gridSnapEnabled) {
          nx = Math.round(nx / 20) * 20;
          ny = Math.round(ny / 20) * 20;
        }
        setNodePosition(id, nx, ny);
        // Keep the current parent (if any) growing to fit live, so the card
        // never visually overflows its parent's border while being dragged —
        // previously this only ran once on drop, so fast/partial drags could
        // leave a node hanging outside its container.
        if (useDiagramStore.getState().nodes[id]?.parentId) {
          growParentToFit(id);
        }
      });
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging(false);
      if (moved) {
        dragIds.forEach(id => {
          const cur = useDiagramStore.getState().nodes[id];
          if (!cur) return;
          const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
          const target = findDropTarget(id, cx, cy);
          if (target !== cur.parentId) {
            reparentNode(id, target);
          }
          growParentToFit(id);
        });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };


  const [resizing, setResizing] = useState(false);
  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    bringToFront(node.id);
    snapshotForUndo();
    setResizing(true);
    const startX = e.clientX, startY = e.clientY;
    const originW = node.w, originH = node.h;
    const MIN_W = 120, MIN_H = 60;
    const shrinking = { w: false, h: false };
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let nw = Math.max(MIN_W, originW + dx);
      let nh = Math.max(MIN_H, originH + dy);
      shrinking.w = dx < 0; shrinking.h = dy < 0;
      // Auto-snap to the grid whenever the resize is shrinking the node,
      // even if free-form grid snapping is off, so items settle cleanly
      // instead of landing on odd fractional sizes.
      if (gridSnapEnabled || shrinking.w || shrinking.h) {
        nw = Math.round(nw / 20) * 20;
        nh = Math.round(nh / 20) * 20;
      }
      if (isContainer) {
        resizeContainerWithChildren(node.id, nw, nh);
      } else {
        updateNode(node.id, { w: nw, h: nh });
      }
      if (node.parentId) growParentToFit(node.id);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      growParentToFit(node.id);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const [iconUrl, setIconUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!node.icon) { setIconUrl(null); return; }
    resolveIcon(node.icon).then(res => { if (!cancelled) setIconUrl(res.url); });
    return () => { cancelled = true; };
  }, [node.icon]);

  const cpu = node.telemetry.cpu;
  const ram = node.telemetry.ram;
  const disk = node.telemetry.disk;

  const classes = [
    'node-card',
    isContainer ? 'container-type' : '',
    selected ? 'selected' : '',
    isDropTarget ? 'drop-target' : '',
    dimmed ? 'dimmed' : '',
    offline ? 'alert' : '',
    node.hidden ? 'node-hidden' : '',
  ].filter(Boolean).join(' ');

  // Stacking/click priority: smaller items must always win over larger
  // items that happen to overlap them, so a big container can't visually
  // cover and block clicks on a smaller node sitting on/near it. Rank is
  // primarily by inverse area (smaller area -> higher on top), with the
  // existing container/non-container tier and zOrder only used as a
  // tiebreak for same-size nodes (so "bring to front" still works among
  // equals).
  const area = Math.max(1, node.w * node.h);
  const areaRank = Math.max(0, 500 - Math.round(area / 2000));
  const tierBase = isContainer ? 0 : 600;

  return (
    <div
      className={classes}
      draggable={false}
      style={{
        left: node.x, top: node.y, width: node.w, height: node.h,
        '--nc-color': color,
        zIndex: dragging ? 1500 : tierBase + areaRank + ((node.zOrder || 0) % 100),
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); select(node.id); }}
      title={`${node.name} (${node.type})\n${subtitleFor(node)}\n${infoFor(node)}`}
    >
      {conflicted && <div className="node-badge-corner" title="Port conflict">!</div>}
      {node.hidden && (
        <div className="node-hidden-overlay" title="Hidden — right-click to unhide">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="3" y1="21" x2="21" y2="3" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <div className="node-header">
        <span
          className="node-icon-slot"
          onClick={(e) => { e.stopPropagation(); openIconPicker(node.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Click to set a custom icon"
        >
          {iconUrl ? (
            <img src={iconUrl} width="12" height="12" alt="" className="node-icon-img" draggable={false} onError={() => setIconUrl(null)} />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" stroke={color} strokeWidth="2" fill="none">
              <path d={iconGlyphFor(node.type)} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="type-tag" style={{ color }}>{node.type}</span>
        <span className="node-name">{node.name}</span>
        {node.telemetry.endpoint && (
          <span className={`status-dot ${node.telemetry.status === 'online' ? 'online' : node.telemetry.status === 'offline' ? 'offline' : ''}`} />
        )}
      </div>
      {!isContainer && (
        <div className="node-body">
          <div className="kv"><span>sub</span><b>{subtitleFor(node)}</b></div>
          <div className="kv"><span>info</span><b>{infoFor(node)}</b></div>
          {node.telemetry.endpoint && (
            <>
              <div className="kv"><span>cpu</span><b>{cpu != null ? `${cpu}%` : '—'}</b></div>
              <div className="kv"><span>ram</span><b>{ram != null ? `${ram}%` : '—'}</b></div>
              {node.telemetry.latency != null && <div className="kv"><span>ping</span><b>{node.telemetry.latency}ms</b></div>}
              <div className="node-sparkline">
                {[cpu, ram, disk].map((v, i) => (
                  <div className="spark-bar" key={i}>
                    <div className={`spark-fill ${v > 85 ? 'high' : ''}`} style={{ width: `${v || 0}%` }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {isContainer && (
        <div className="node-body">
          <div className="kv"><span>info</span><b>{subtitleFor(node)}</b></div>
        </div>
      )}
      <div className="node-resize-handle" onPointerDown={handleResizePointerDown} title="Drag to resize" />
    </div>
  );
}
