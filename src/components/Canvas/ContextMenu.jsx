import React, { useEffect } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore.js';
import { toPng } from 'html-to-image';

// Shared export routine: rasterizes the given node ids' bounding box out of
// the live canvas-world (so nesting/children come along for free), painting
// the same dotted grid that's visible on-screen into the crop so the
// background doesn't come out as a plain black rectangle.
async function exportNodesAsImage(ids, filename, showToast) {
  const s = useDiagramStore.getState();
  const boxes = ids.map(id => s.nodes[id]).filter(Boolean);
  if (boxes.length === 0) { showToast('Nothing to export', 'warn'); return; }
  const PAD = 24;
  const minX = Math.min(...boxes.map(n => n.x)) - PAD;
  const minY = Math.min(...boxes.map(n => n.y)) - PAD;
  const maxX = Math.max(...boxes.map(n => n.x + n.w)) + PAD;
  const maxY = Math.max(...boxes.map(n => n.y + n.h)) + PAD;
  const worldEl = document.querySelector('.canvas-world');
  if (!worldEl) { showToast('Could not locate canvas', 'warn'); return; }

  // Directly mutate the live element's own transform/background instead of
  // only passing an override through toPng's `style` option. The node being
  // captured is still showing whatever pan/zoom the user currently has on
  // screen (e.g. zoomed out and panned somewhere else) — if html-to-image's
  // internal style-baking pass ends up applying after (or clobbering) the
  // `style` option override, the crop ends up looking at empty space where
  // the diagram currently isn't, producing exactly the blank export that
  // was reported. Setting the real DOM style ourselves, snapshotting, then
  // restoring it afterward removes any dependency on that internal order.
  const prevStyle = {
    transform: worldEl.style.transform,
    backgroundImage: worldEl.style.backgroundImage,
    backgroundSize: worldEl.style.backgroundSize,
    backgroundPosition: worldEl.style.backgroundPosition,
    width: worldEl.style.width,
    height: worldEl.style.height,
  };
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));
  worldEl.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
  worldEl.style.backgroundImage =
    'radial-gradient(circle, rgba(255,122,0,0.14) 1px, transparent 1px),' +
    'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),' +
    'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)';
  worldEl.style.backgroundSize = '20px 20px, 20px 20px, 20px 20px';
  worldEl.style.backgroundPosition = `${-minX}px ${-minY}px, ${-minX}px ${-minY}px, ${-minX}px ${-minY}px`;
  worldEl.style.width = `${width}px`;
  worldEl.style.height = `${height}px`;
  // Force layout to flush before html-to-image reads computed styles/rects.
  // eslint-disable-next-line no-unused-expressions
  worldEl.offsetHeight;

  try {
    const dataUrl = await toPng(worldEl, {
      backgroundColor: '#050505',
      pixelRatio: 2,
      width,
      height,
      cacheBust: true,
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Image exported');
  } catch {
    showToast('Export failed — try a smaller selection', 'warn');
  } finally {
    worldEl.style.transform = prevStyle.transform;
    worldEl.style.backgroundImage = prevStyle.backgroundImage;
    worldEl.style.backgroundSize = prevStyle.backgroundSize;
    worldEl.style.backgroundPosition = prevStyle.backgroundPosition;
    worldEl.style.width = prevStyle.width;
    worldEl.style.height = prevStyle.height;
  }
}

export default function ContextMenu() {
  const contextMenu = useDiagramStore(s => s.contextMenu);
  const closeContextMenu = useDiagramStore(s => s.closeContextMenu);
  const deleteNode = useDiagramStore(s => s.deleteNode);
  const cloneNode = useDiagramStore(s => s.cloneNode);
  const unlinkNode = useDiagramStore(s => s.unlinkNode);
  const unlinkFromParent = useDiagramStore(s => s.unlinkFromParent);
  const select = useDiagramStore(s => s.select);
  const showToast = useDiagramStore(s => s.showToast);
  const openAddNodeModal = useDiagramStore(s => s.openAddNodeModal);
  const setZoom = useDiagramStore(s => s.setZoom);
  const setPan = useDiagramStore(s => s.setPan);
  const toggleGridSnap = useDiagramStore(s => s.toggleGridSnap);
  const gridSnapEnabled = useDiagramStore(s => s.gridSnapEnabled);
  const openIconPicker = useDiagramStore(s => s.openIconPicker);
  const openEditNode = useDiagramStore(s => s.openEditNode);
  const scaleNodesToSmallest = useDiagramStore(s => s.scaleNodesToSmallest);
  const toggleNodeHidden = useDiagramStore(s => s.toggleNodeHidden);
  const node = contextMenu?.nodeId ? useDiagramStore.getState().nodes[contextMenu.nodeId] : null;

  useEffect(() => {
    const close = () => closeContextMenu();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  if (!contextMenu) return null;

  // Right-clicked empty canvas space — canvas-level actions.
  if (!contextMenu.nodeId) {
    const exportWholeCanvas = () => {
      closeContextMenu();
      const allIds = Object.keys(useDiagramStore.getState().nodes);
      exportNodesAsImage(allIds, 'hexlab-workspace.png', showToast);
    };
    return (
      <div
        className="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="context-menu-item" onClick={() => { openAddNodeModal(null); closeContextMenu(); }}>＋ Add Node Here</div>
        <div className="context-menu-item" onClick={() => { scaleNodesToSmallest(null); closeContextMenu(); }}>⤓ Scale All Nodes to Smallest</div>
        <div className="context-menu-item" onClick={() => { toggleGridSnap(); closeContextMenu(); }}>{gridSnapEnabled ? '☑' : '☐'} Grid Snapping</div>
        <div className="context-menu-sep" />
        <div className="context-menu-item" onClick={exportWholeCanvas}>▣ Export Entire Canvas as Image</div>
        <div className="context-menu-item" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); closeContextMenu(); }}>⤢ Reset View</div>
      </div>
    );
  }

  if (!node) return null;

  const exportImage = () => {
    closeContextMenu();
    const s = useDiagramStore.getState();
    const ids = [node.id, ...s.getDescendantIds(node.id)];
    exportNodesAsImage(ids, `${node.name.replace(/\s+/g, '_')}_hexlab.png`, showToast);
  };

  return (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="context-menu-item" onClick={() => { select(node.id); openEditNode(node.id); closeContextMenu(); }}>⛶ Edit (full form)</div>
      <div className="context-menu-item" onClick={() => { openIconPicker(node.id); closeContextMenu(); }}>🖼 Set Icon</div>
      <div className="context-menu-item" onClick={() => { cloneNode(node.id); closeContextMenu(); }}>⧉ Clone</div>
      <div className="context-menu-item" onClick={() => { scaleNodesToSmallest(node.id); closeContextMenu(); }}>⤓ Scale Nodes to Smallest</div>
      <div className="context-menu-item" onClick={() => { unlinkNode(node.id); closeContextMenu(); showToast('Connections unlinked'); }}>⌁ Unlink Connections</div>
      <div className="context-menu-item" onClick={() => { toggleNodeHidden(node.id); closeContextMenu(); }}>{node.hidden ? '👁 Unhide' : '🚫 Hide'}</div>
      {node.parentId && (
        <div className="context-menu-item" onClick={() => { unlinkFromParent(node.id); closeContextMenu(); }}>⬈ Unlink from Parent</div>
      )}
      <div className="context-menu-item" onClick={exportImage}>▣ Export Section as Image</div>
      <div className="context-menu-sep" />
      <div className="context-menu-item danger" onClick={() => { deleteNode(node.id); closeContextMenu(); }}>✕ Delete</div>
    </div>
  );
}
