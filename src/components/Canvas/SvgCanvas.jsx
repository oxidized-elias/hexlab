import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useDiagramStore, rankOf } from '../../store/useDiagramStore.js';
import NodeCard from './NodeCard.jsx';

function connPath(a, b) {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const mx = (ax + bx) / 2;
  return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
}

export default function SvgCanvas() {
  const viewportRef = useRef(null);
  const nodes = useDiagramStore(s => s.nodes);
  const connections = useDiagramStore(s => s.connections);
  const zoom = useDiagramStore(s => s.zoom);
  const pan = useDiagramStore(s => s.pan);
  const setZoom = useDiagramStore(s => s.setZoom);
  const setPan = useDiagramStore(s => s.setPan);
  const select = useDiagramStore(s => s.select);
  const selectedId = useDiagramStore(s => s.selectedId);
  const connectMode = useDiagramStore(s => s.connectMode);
  const pendingConnectFrom = useDiagramStore(s => s.pendingConnectFrom);
  const setPendingConnectFrom = useDiagramStore(s => s.setPendingConnectFrom);
  const toggleConnectMode = useDiagramStore(s => s.toggleConnectMode);
  const vlanFilter = useDiagramStore(s => s.vlanFilter);
  const getDescendantIds = useDiagramStore(s => s.getDescendantIds);
  const closeContextMenu = useDiagramStore(s => s.closeContextMenu);
  const views = useDiagramStore(s => s.views);
  const activeViewId = useDiagramStore(s => s.activeViewId);
  const openContextMenu = useDiagramStore(s => s.openContextMenu);

  const [panning, setPanning] = useState(false);
  const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });

  const toWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const panZoomRef = useRef({ pan, zoom });
  panZoomRef.current = { pan, zoom };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      // preventDefault() on a passive listener is a silent no-op — this is
      // why pinch-zoom / ctrl+wheel on a trackpad could previously escape to
      // zoom the whole page. Binding manually with { passive: false } makes
      // the prevention actually take effect.
      e.preventDefault();
      const { pan: curPan, zoom: curZoom } = panZoomRef.current;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const worldX = (mx - curPan.x) / curZoom, worldY = (my - curPan.y) / curZoom;
      const newZoom = Math.min(2.5, Math.max(0.2, curZoom * (e.deltaY < 0 ? 1.08 : 0.93)));
      setZoom(newZoom);
      setPan({ x: mx - worldX * newZoom, y: my - worldY * newZoom });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleBackgroundPointerDown = (e) => {
    if (e.target !== e.currentTarget && !e.target.classList?.contains('canvas-world')) {
      if (e.target.closest('.node-card')) return;
    }
    if (connectMode) {
      setPendingConnectFrom(null);
      return;
    }
    select(null);
    closeContextMenu();
    setPanning(true);
    const startX = e.clientX, startY = e.clientY;
    const originPan = { ...pan };
    const onMove = (ev) => {
      setPan({ x: originPan.x + (ev.clientX - startX), y: originPan.y + (ev.clientY - startY) });
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Right-clicking anywhere on the canvas background (not just on a node
  // card) opens a context menu. NodeCard's own onContextMenu handler already
  // stops propagation for clicks on a card, so this only fires for empty
  // canvas space.
  const handleCanvasContextMenu = (e) => {
    e.preventDefault();
    const world = toWorld(e.clientX, e.clientY);
    openContextMenu(e.clientX, e.clientY, null, world);
  };

  const handleCanvasDragOver = (e) => {
    if (e.dataTransfer.types.includes('application/x-hexlab-node-type') || e.dataTransfer.types.includes('application/x-hexlab-custom-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleCanvasDrop = (e) => {
    const type = e.dataTransfer.getData('application/x-hexlab-node-type');
    const customId = e.dataTransfer.getData('application/x-hexlab-custom-type');
    if (!type && !customId) return;
    e.preventDefault();
    const world = toWorld(e.clientX, e.clientY);
    const x = world.x - 90, y = world.y - 45;
    const addNode = useDiagramStore.getState().addNode;
    if (type) {
      const id = addNode(type, { x, y });
      const target = useDiagramStore.getState().findDropTarget(id, world.x, world.y);
      if (target) {
        useDiagramStore.getState().reparentNode(id, target);
        useDiagramStore.getState().growParentToFit(id);
      }
    } else if (customId) {
      const custom = useDiagramStore.getState().customTypes.find(c => c.id === customId);
      if (custom) {
        const id = addNode('application', { x, y, custom });
        const target = useDiagramStore.getState().findDropTarget(id, world.x, world.y);
        if (target) {
          useDiagramStore.getState().reparentNode(id, target);
          useDiagramStore.getState().growParentToFit(id);
        }
      }
    }
  };

  const handleMouseMoveForConnect = (e) => {
    if (connectMode && pendingConnectFrom) {
      setMouseWorld(toWorld(e.clientX, e.clientY));
    }
  };

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { setPendingConnectFrom(null); if (connectMode) toggleConnectMode(); } };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [connectMode]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      const state = useDiagramStore.getState();
      const ids = state.selectedIds.length ? state.selectedIds : (state.selectedId ? [state.selectedId] : []);
      if (ids.length === 0) return;
      e.preventDefault();
      state.deleteNodes(ids);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const hiddenTypes = views.find(v => v.id === activeViewId)?.hiddenTypes || [];

  // Depth used to be recomputed per-comparison inside the sort (getDepth
  // walks the parent chain from scratch each call), so an N-node sort did
  // O(N log N) chain-walks on every render — including every drag-move
  // frame. Compute each node's depth once in a single O(n) pass instead.
  const nodeList = useMemo(() => {
    const depthOf = new Map();
    // Depth of a node = 1 + depth of its parent. Walk up from each node,
    // stopping early whenever we hit an already-memoized ancestor, then
    // assign depths back down the walked chain. Every node is visited a
    // constant number of times total (not per-comparison), so this is O(n)
    // for the whole node set instead of O(n log n) chain-walks in the sort.
    const depthFor = (n) => {
      if (depthOf.has(n.id)) return depthOf.get(n.id);
      const chain = [];
      let cur = n;
      while (cur && !depthOf.has(cur.id)) {
        chain.push(cur.id);
        cur = cur.parentId != null ? nodes[cur.parentId] : null;
      }
      let d = cur ? depthOf.get(cur.id) : -1; // -1 so the root of the chain gets depth 0
      for (let i = chain.length - 1; i >= 0; i--) {
        d += 1;
        depthOf.set(chain[i], d);
      }
      return depthOf.get(n.id);
    };
    const list = Object.values(nodes).filter(n => !hiddenTypes.includes(n.type));
    list.forEach(depthFor);
    return list.sort((a, b) => {
      const da = depthOf.get(a.id) || 0;
      const db = depthOf.get(b.id) || 0;
      if (da !== db) return da - db;
      return rankOf(a.type) - rankOf(b.type);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, hiddenTypes.join(',')]);

  // VLAN filter: compute highlighted set (memoized — was recomputed every render)
  const highlightSet = useMemo(() => {
    if (!vlanFilter) return null;
    const set = new Set();
    Object.values(nodes).forEach(n => {
      if (n.type === 'network' && n.fields.vlanId === vlanFilter) {
        set.add(n.id);
        getDescendantIds(n.id).forEach(id => set.add(id));
      }
    });
    return set;
  }, [nodes, vlanFilter, getDescendantIds]);

  // Port conflicts used to be computed fresh inside *every* NodeCard's own
  // render (an O(n) scan per card = O(n^2) total, redone on every drag
  // frame since it wasn't memoized). Compute it once here and hand each
  // card a plain boolean.
  const portConflicts = useDiagramStore(s => s.getPortConflicts);
  const conflictedIds = useMemo(() => {
    const ids = new Set();
    portConflicts().forEach(pc => pc.ids.forEach(id => ids.add(id)));
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const pendingFromNode = pendingConnectFrom ? nodes[pendingConnectFrom] : null;

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${panning ? 'panning' : ''} ${connectMode ? 'connect-mode' : ''}`}
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px, ${pan.x}px ${pan.y}px, ${pan.x}px ${pan.y}px`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px, ${20 * zoom}px ${20 * zoom}px, ${20 * zoom}px ${20 * zoom}px`,
      }}
      onPointerDown={handleBackgroundPointerDown}
      onMouseMove={handleMouseMoveForConnect}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      <div
        className="canvas-world"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg className="canvas-svg-layer" width="8000" height="6000">
          <defs>
            <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" /><feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {Object.values(connections).map(c => {
            const a = nodes[c.from], b = nodes[c.to];
            if (!a || !b) return null;
            if (hiddenTypes.includes(a.type) || hiddenTypes.includes(b.type)) return null;
            const dimmedByVlan = highlightSet && !(highlightSet.has(a.id) && highlightSet.has(b.id));
            return (
              <g key={c.id}>
                <path
                  d={connPath(a, b)}
                  className={`conn-path ${c.kind === 'applink' ? 'applink' : 'link'} ${dimmedByVlan ? 'dimmed' : ''}`}
                />
              </g>
            );
          })}
          {pendingFromNode && (
            <path
              d={`M ${pendingFromNode.x + pendingFromNode.w / 2} ${pendingFromNode.y + pendingFromNode.h / 2} L ${mouseWorld.x} ${mouseWorld.y}`}
              className="conn-live-line"
            />
          )}
        </svg>

        {nodeList.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            isDropTarget={false}
            dimmed={highlightSet ? !highlightSet.has(node.id) : false}
            conflicted={conflictedIds.has(node.id)}
            onContextMenu={(e, id) => openContextMenu(e.clientX, e.clientY, id)}
          />
        ))}
      </div>
    </div>
  );
}
