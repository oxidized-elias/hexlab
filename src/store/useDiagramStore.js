import { create } from 'zustand';

export const GRID = 20;
export const snap = (v) => Math.round(v / GRID) * GRID;

// ---- Node type registry -----------------------------------------------
export const TYPE_DEFAULTS = {
  // WAN/uplink — the outside-world root a top-level Network typically
  // connects out to. Root-only and non-container: nothing nests inside it.
  internet:    { label: 'Internet',           color: '#22D3EE', w: 160, h: 90,  container: false },
  group:       { label: 'Group',            color: '#4B5563', w: 340, h: 220, container: true },
  network:     { label: 'Network',          color: '#FF7A00', w: 300, h: 190, container: true },
  // A perimeter firewall appliance (OPNsense/pfSense/etc) — it can host a
  // routed Network inside it, same as a Physical Device would.
  firewall:    { label: 'Firewall',         color: '#EF4444', w: 220, h: 110, container: true },
  device:      { label: 'Physical Device',  color: '#71717A', w: 300, h: 190, container: true },
  hypervisor:  { label: 'Hypervisor',       color: '#8B5CF6', w: 260, h: 160, container: true },
  vm:          { label: 'Virtual Machine',  color: '#A78BFA', w: 190, h: 100, container: false },
  k8s:         { label: 'Kubernetes Host',  color: '#8B5CF6', w: 260, h: 150, container: true },
  docker:      { label: 'Docker Host',      color: '#00E5FF', w: 240, h: 140, container: true },
  storage:     { label: 'Storage',          color: '#F59E0B', w: 180, h: 100, container: false },
  // First-class Storage Pool — same underlying idea as the storage
  // "Storage Pool" subtype, but promoted to its own quick-add type since a
  // pool (RAID/ZFS array etc) is usually diagrammed as its own box rather
  // than a subtype of a generic storage device.
  storagepool: { label: 'Storage Pool',     color: '#D97706', w: 260, h: 150, container: true },
  directory:   { label: 'Directory',        color: '#F59E0B', w: 170, h: 90,  container: false },
  application: { label: 'Application',      color: '#10B981', w: 180, h: 80,  container: false },
};

const CONTAINER_TYPES = new Set(['group', 'network', 'device', 'hypervisor', 'k8s', 'docker', 'storagepool', 'firewall']);

// ---- Hierarchy / order-sensitivity rules -------------------------------
// Defines which node types are logically allowed to sit inside which parent
// container types. 'root' means the type is allowed with no parent at all.
// This is what makes containment "order sensitive" (e.g. a VM can only ever
// live inside a Hypervisor, an Application only inside a runtime host, etc)
// instead of any box being droppable into any other box. Enforcement is
// gated by the `hierarchyEnforced` store flag so it's fully configurable.
export const HIERARCHY_RULES = {
  // Root-only, and nothing can be dropped into it — it represents the
  // outside world, not a container you manage devices inside of.
  internet:    { root: true,  parents: [] },
  group:       { root: true,  parents: ['group', 'network'] },
  // A Network can also live inside a Device or Firewall (e.g. a routed
  // subnet behind an OPNsense box), in addition to sitting inside a Group.
  network:     { root: true,  parents: ['group', 'device', 'firewall'] },
  // A perimeter firewall appliance — sits at the same level as a Physical
  // Device (usually just inside a Network or at the top level).
  firewall:    { root: true,  parents: ['group', 'network', 'device', 'hypervisor', 'vm'] },
  device:      { root: true,  parents: ['group', 'network'] },
  // A Hypervisor is software running on a physical box — it must sit
  // directly inside a Physical Device, never floating at the top level.
  hypervisor:  { root: false, parents: ['device'] },
  vm:          { root: false, parents: ['hypervisor'] },
  // Kubernetes/Docker hosts are compute runtimes: they need to ultimately
  // live on a Physical Device, either bare-metal or virtualized (VM/Hypervisor).
  k8s:         { root: false, parents: ['device', 'hypervisor', 'vm'] },
  docker:      { root: false, parents: ['device', 'hypervisor', 'vm', 'k8s'] },
  storage:     { root: true,  parents: ['group', 'network', 'device', 'hypervisor', 'vm', 'storagepool'] },
  storagepool: { root: true,  parents: ['group', 'network', 'device', 'hypervisor', 'vm'] },
  directory:   { root: true,  parents: ['group', 'network', 'device', 'hypervisor', 'vm', 'storage', 'storagepool'] },
  application: { root: true,  parents: ['group', 'network', 'device', 'hypervisor', 'vm', 'k8s', 'docker'] },
};
// Rendering / evaluation order rank — used for z-ordering and any place
// where "which type sits on top of which" logically matters (Physical
// Machines on top, Hypervisor/VM inside, Docker inside that, Application
// innermost, etc).
export const ORDER_RANK = ['internet', 'network', 'group', 'firewall', 'device', 'hypervisor', 'vm', 'k8s', 'docker', 'storage', 'storagepool', 'directory', 'application'];
export const rankOf = (type) => {
  const i = ORDER_RANK.indexOf(type);
  return i === -1 ? ORDER_RANK.length : i;
};

// Custom types (declared via the Type Manager) are always allowed anywhere,
// since the user defines their own semantics for them.
function isAllowedParent(childType, parentType, isCustom) {
  if (isCustom) return true;
  const rule = HIERARCHY_RULES[childType];
  if (!rule) return true;
  if (parentType === null) return rule.root;
  return rule.parents.includes(parentType);
}

const LEGACY_LS_KEY = 'hexlab-workspace-v1';
const LS_INDEX_KEY = 'hexlab-projects-index-v1';
const projectKey = (id) => `hexlab-project-${id}`;

// ---- Server-side project storage ---------------------------------------
// Projects are persisted on the server (server/index.cjs) so a diagram
// isn't stuck to one browser/machine. localStorage is kept only as a
// last-resort offline cache: if the server can't be reached (not running,
// no network), reads/writes fall back to it so the app still works, and
// the same helpers transparently prefer the server whenever it's up.
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}
async function apiPut(path, body) {
  const res = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PUT ${path} failed`);
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed`);
  return res.json();
}

let idCounter = 1;
const genId = (prefix = 'n') => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

// True if any of the node's fields differ from that type's fresh defaults —
// used by the Link Tool to decide which of two nodes is the "real" source
// of data when linking applications together.
function isCustomized(node) {
  const defaults = defaultFieldsFor(node.type);
  return Object.entries(node.fields || {}).some(([k, v]) => v !== defaults[k]);
}

function defaultFieldsFor(type) {
  switch (type) {
    case 'device':
      return { manufacturer: '', model: '', formFactor: '1U', os: '', cpu: '', ram: '', ip: '', serial: '', rackId: '' };
    case 'firewall':
      return { firewallOs: 'OPNsense', firewallOsOther: '', wanIp: '', lanCidr: '', rulesSummary: '' };
    case 'group':
      return { mode: 'aesthetic' }; // 'aesthetic' | 'functional'
    case 'network':
      return { cidr: '192.168.1.0/24', dhcpStart: '', dhcpEnd: '', dns: '', gateway: '192.168.1.1', vlanId: '' };
    case 'hypervisor':
      return { hostOs: 'Proxmox VE', totalCpu: '', totalRam: '', guestCpu: '', guestRam: '' };
    case 'vm':
      return { guestOs: '', vCpu: '', vRam: '', ip: '', hostPorts: '', diskSize: '' };
    case 'k8s':
      return { nodeRole: 'Worker', namespace: 'default', podCidr: '', apiEndpoint: '', cpuLimit: '', memLimit: '' };
    case 'docker':
      return { networkMode: 'bridge', env: '' };
    case 'storage':
      return { subtype: 'Storage Device', capacity: '', raidLevel: 'N/A', mountPath: '', readWrite: '', redundancy: 'OK' };
    case 'storagepool':
      return { capacity: '', raidLevel: 'N/A', mountPath: '', fsType: '' };
    case 'internet':
      return { isp: '', publicIp: '', wanSpeed: '' };
    case 'directory':
      return { subtype: 'Local Directory', symlinkTarget: '', isBackupJob: false, backupTarget: '' };
    case 'application':
      return { image: '', port: '', status: 'Active', externalUrl: '', monitorUrl: '', tags: '', docsUrl: '', compose: '' };
    default:
      return {};
  }
}

let zCounter = 1;

function makeNode({ type, name, x, y, parentId = null, custom = null }) {
  const base = custom || TYPE_DEFAULTS[type];
  return {
    id: genId(type),
    type,
    customTypeId: custom ? custom.id : null,
    name: name || (custom ? custom.label : TYPE_DEFAULTS[type].label),
    parentId,
    x: snap(x), y: snap(y),
    w: base.w, h: base.h,
    color: null, // override; null = use type default
    icon: null,
    // Monotonically increasing — used to stack newer items above older ones
    // (selection/drag priority) regardless of type or nesting.
    zOrder: zCounter++,
    fields: custom ? Object.fromEntries((custom.attrs || []).map(a => [a.key, ''])) : defaultFieldsFor(type),
    telemetry: { endpoint: '', status: 'unknown', cpu: null, ram: null, disk: null, latency: null, lastCheck: null },
  };
}

export const useDiagramStore = create((set, get) => ({
  // ---- core data ----
  nodes: {},          // id -> node
  connections: {},     // id -> {id, from, to}
  rootOrder: [],       // ids in creation order (render order fallback)
  customTypes: [],     // [{id,label,color,category,attrs:[{key,label}]}]

  // ---- selection / ui ----
  selectedId: null,
  selectedIds: [], // for multi-select (shift-click); selectedId tracks the most recently (de)selected id
  connectMode: false,
  pendingConnectFrom: null,
  contextMenu: null,   // {x,y,nodeId}
  inspectorOpen: false,
  addNodeModal: null,  // {parentId} | null
  typeManagerOpen: false,
  toast: null,

  // ---- view state ----
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridSnapEnabled: true,
  vlanFilter: null,

  // ================= Configurable behavior toggles =================
  // Order sensitivity: when on, drag-and-drop nesting and reparenting are
  // restricted by HIERARCHY_RULES (e.g. a VM can only be dropped inside a
  // Hypervisor). Toggle-able so users can disable it for a purely
  // freeform/aesthetic diagram.
  hierarchyEnforced: true,
  // Node id currently open in the icon picker popover, or null.
  iconPickerNodeId: null,
  openIconPicker: (id) => set({ iconPickerNodeId: id }),
  closeIconPicker: () => set({ iconPickerNodeId: null }),

  // Node id currently open in the full-form Edit modal (right-click > Edit),
  // or null. Distinct from selectedId/Inspector so a node can be edited in
  // a comfortable two-column overlay instead of only the sidebar.
  editNodeId: null,
  openEditNode: (id) => set({ editNodeId: id }),
  closeEditNode: () => set({ editNodeId: null }),

  // Project Settings modal (hierarchy/privacy/display toggles scoped to
  // the active project).
  projectSettingsOpen: false,
  openProjectSettings: () => set({ projectSettingsOpen: true }),
  closeProjectSettings: () => set({ projectSettingsOpen: false }),

  // Icon-only canvas view — hides node detail text, keeping only the type
  // icon and name.
  minimalUi: false,
  toggleMinimalUi: () => set(state => ({ minimalUi: !state.minimalUi })),

  toggleHierarchyEnforced: () => set(state => ({ hierarchyEnforced: !state.hierarchyEnforced })),

  // Workspace Diagnostics panel (shown in the Inspector when nothing is
  // selected) can be dismissed by the user.
  diagnosticsDismissed: false,
  dismissDiagnostics: () => set({ diagnosticsDismissed: true }),
  reopenDiagnostics: () => set({ diagnosticsDismissed: false }),

  // ================= Views =================
  // A View is just a lens onto the SAME shared nodes/connections/apps — not
  // a copy. Switching views only changes which node types are visible and
  // the saved camera (pan/zoom), so links and applications stay identical
  // across every view in a project; this is what lets a view be used to
  // declutter (e.g. hide raw hardware/network plumbing) without losing or
  // duplicating anything.
  views: [{ id: 'default', name: 'All', hiddenTypes: [] }],
  activeViewId: 'default',

  // Confidentiality Mode — display-only redaction of external
  // hostnames/IPs, internal IPs, and generated Docker Compose/K8s output.
  // Not persisted with the project file — it's a per-session screen-share
  // toggle, not a data change.
  confidentialMode: false,
  toggleConfidentialMode: () => set(s => ({ confidentialMode: !s.confidentialMode })),

  createView: (name) => {
    const id = genId('view');
    set(s => ({ views: [...s.views, { id, name: name || 'New View', hiddenTypes: [] }], activeViewId: id }));
    return id;
  },
  switchView: (id) => {
    const v = get().views.find(v => v.id === id);
    if (!v) return;
    set({ activeViewId: id });
    if (v.pan) get().setPan(v.pan);
    if (v.zoom) get().setZoom(v.zoom);
  },
  renameView: (id, name) => set(s => ({ views: s.views.map(v => v.id === id ? { ...v, name } : v) })),
  deleteView: (id) => {
    if (id === 'default') return;
    set(s => {
      const views = s.views.filter(v => v.id !== id);
      return { views, activeViewId: s.activeViewId === id ? 'default' : s.activeViewId };
    });
  },
  toggleViewHiddenType: (type) => set(s => ({
    views: s.views.map(v => v.id === s.activeViewId
      ? { ...v, hiddenTypes: v.hiddenTypes.includes(type) ? v.hiddenTypes.filter(t => t !== type) : [...v.hiddenTypes, type] }
      : v),
  })),
  saveViewCamera: () => set(s => ({
    views: s.views.map(v => v.id === s.activeViewId ? { ...v, pan: s.pan, zoom: s.zoom } : v),
  })),

  // ================= Undo / Redo =================
  // Snapshot-based history of the graph (nodes/connections/rootOrder).
  // Discrete actions (add/delete/clone/reparent/connect, and the start of a
  // drag or resize) push a snapshot of the state *before* the change; undo
  // moves it to the future stack and restores that snapshot, redo does the
  // reverse.
  history: { past: [], future: [] },
  _snapshotGraph: () => {
    const s = get();
    return { nodes: s.nodes, connections: s.connections, rootOrder: s.rootOrder };
  },
  snapshotForUndo: () => set(state => {
    const past = [...state.history.past, get()._snapshotGraph()].slice(-50);
    return { history: { past, future: [] } };
  }),
  undo: () => {
    const state = get();
    const { past, future } = state.history;
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const current = get()._snapshotGraph();
    set({
      nodes: prev.nodes, connections: prev.connections, rootOrder: prev.rootOrder,
      history: { past: past.slice(0, -1), future: [...future, current].slice(-50) },
      selectedId: null,
      selectedIds: [],
    });
  },
  redo: () => {
    const state = get();
    const { past, future } = state.history;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = get()._snapshotGraph();
    set({
      nodes: next.nodes, connections: next.connections, rootOrder: next.rootOrder,
      history: { past: [...past, current].slice(-50), future: future.slice(0, -1) },
      selectedId: null,
      selectedIds: [],
    });
  },

  // ================= Node CRUD =================
  addNode: (type, { x = 200, y = 200, parentId = null, custom = null } = {}) => {
    const state = get();
    get().snapshotForUndo();
    // Order sensitivity: validate the requested parent is a logically valid
    // container for this type before creating the node. Falls back to the
    // canvas root (with a toast) rather than silently creating an invalid
    // hierarchy, but only when enforcement is switched on.
    let effectiveParentId = parentId;
    if (state.hierarchyEnforced) {
      const parentNode = parentId ? state.nodes[parentId] : null;
      const parentType = parentNode ? parentNode.type : null;
      if (!isAllowedParent(type, parentType, !!custom)) {
        effectiveParentId = parentId; // keep as requested; just warn — we can't guess a valid parent for the user
        const label = TYPE_DEFAULTS[type]?.label || type;
        if (parentId) {
          effectiveParentId = null;
          get().showToast(`${label} can't nest inside ${parentNode?.name || 'that item'} — placed at root instead`, 'warn');
        } else {
          get().showToast(`${label} needs to be nested inside a Physical Device — drag it onto one`, 'warn');
        }
      }
    }
    const node = makeNode({ type, x, y, parentId: effectiveParentId, custom });
    set(s => ({
      nodes: { ...s.nodes, [node.id]: node },
      rootOrder: [...s.rootOrder, node.id],
      selectedId: node.id,
      selectedIds: [node.id],
    }));
    get().growParentToFit(node.id);
    return node.id;
  },

  // Selection/drag priority: bump a node (and, implicitly via z-order, its
  // stack position) to the front so newly-touched items always sit above
  // older ones and can be dragged without older cards intercepting events.
  bringToFront: (id) => set(state => {
    if (!state.nodes[id]) return {};
    return { nodes: { ...state.nodes, [id]: { ...state.nodes[id], zOrder: zCounter++ } } };
  }),

  updateNode: (id, patch) => set(state => {
    if (!state.nodes[id]) return {};
    return { nodes: { ...state.nodes, [id]: { ...state.nodes[id], ...patch } } };
  }),

  // Blurs a node's contents and marks it visually hidden (right-click ->
  // Hide) without removing it from the diagram — a quick way to obscure
  // sensitive info before a screen-share/screenshot.
  toggleNodeHidden: (id) => set(state => {
    if (!state.nodes[id]) return {};
    return { nodes: { ...state.nodes, [id]: { ...state.nodes[id], hidden: !state.nodes[id].hidden } } };
  }),

  updateNodeFields: (id, fieldPatch) => set(state => {
    const n = state.nodes[id];
    if (!n) return {};
    const nodes = { ...state.nodes, [id]: { ...n, fields: { ...n.fields, ...fieldPatch } } };
    // Keep any node symlinked (Link Tool "applink") to this one mirroring
    // its fields going forward — linkApplications previously only copied
    // data once at the moment the link was made, so a later edit to the
    // source silently desynced the two. Propagate one level to every node
    // whose syncedFromId points at this node.
    Object.values(state.nodes).forEach(other => {
      if (other.id !== id && other.syncedFromId === id) {
        nodes[other.id] = { ...other, fields: { ...other.fields, ...fieldPatch } };
      }
    });
    return { nodes };
  }),

  deleteNode: (id) => { get().snapshotForUndo(); return set(state => {
    const toDelete = new Set(get().getDescendantIds(id).concat(id));
    const nodes = { ...state.nodes };
    toDelete.forEach(nid => delete nodes[nid]);
    const connections = Object.fromEntries(
      Object.entries(state.connections).filter(([, c]) => !toDelete.has(c.from) && !toDelete.has(c.to))
    );
    return {
      nodes,
      connections,
      rootOrder: state.rootOrder.filter(nid => !toDelete.has(nid)),
      selectedId: state.selectedId && toDelete.has(state.selectedId) ? null : state.selectedId,
      selectedIds: state.selectedIds.filter(nid => !toDelete.has(nid)),
    };
  }); },

  // Deletes every node in `ids` (and their descendants) as a single undo
  // step — used for multi-select (shift-click) delete, so Ctrl/Cmd+Z
  // undoes the whole batch at once instead of one node at a time.
  deleteNodes: (ids) => { get().snapshotForUndo(); return set(state => {
    const toDelete = new Set(ids.flatMap(id => get().getDescendantIds(id).concat(id)));
    const nodes = { ...state.nodes };
    toDelete.forEach(nid => delete nodes[nid]);
    const connections = Object.fromEntries(
      Object.entries(state.connections).filter(([, c]) => !toDelete.has(c.from) && !toDelete.has(c.to))
    );
    return {
      nodes,
      connections,
      rootOrder: state.rootOrder.filter(nid => !toDelete.has(nid)),
      selectedId: state.selectedId && toDelete.has(state.selectedId) ? null : state.selectedId,
      selectedIds: state.selectedIds.filter(nid => !toDelete.has(nid)),
    };
  }); },

  cloneNode: (id) => {
    const state = get();
    const src = state.nodes[id];
    if (!src) return;
    get().snapshotForUndo();
    const offset = 30;
    const idMap = {};
    const all = [id, ...get().getDescendantIds(id)];
    const newNodes = {};
    all.forEach(nid => {
      const n = state.nodes[nid];
      const newId = genId(n.type);
      idMap[nid] = newId;
    });
    all.forEach(nid => {
      const n = state.nodes[nid];
      const newId = idMap[nid];
      newNodes[newId] = {
        ...n,
        id: newId,
        name: nid === id ? `${n.name} (copy)` : n.name,
        x: n.x + offset,
        y: n.y + offset,
        parentId: n.parentId ? (idMap[n.parentId] || n.parentId) : null,
      };
    });
    set(s => ({
      nodes: { ...s.nodes, ...newNodes },
      rootOrder: [...s.rootOrder, ...Object.values(idMap)],
      selectedId: idMap[id],
      selectedIds: [idMap[id]],
    }));
  },

  getDescendantIds: (id) => {
    const { nodes } = get();
    // Build the parentId -> children index once (O(n)) instead of rescanning
    // every node for every id popped off the BFS stack. The old version was
    // O(n) per stack-pop (so O(n * subtree size) overall) — expensive for
    // deep containers on every drag/delete/clone. This is always O(n) total.
    const childrenOf = new Map();
    Object.values(nodes).forEach(n => {
      if (n.parentId != null) {
        if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
        childrenOf.get(n.parentId).push(n.id);
      }
    });
    const result = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const kids = childrenOf.get(cur);
      if (kids) kids.forEach(k => { result.push(k); stack.push(k); });
    }
    return result;
  },

  getChildren: (id) => Object.values(get().nodes).filter(n => n.parentId === id),

  getDepth: (id) => {
    const { nodes } = get();
    let d = 0, cur = nodes[id];
    while (cur && cur.parentId) { d++; cur = nodes[cur.parentId]; }
    return d;
  },

  // ================= Movement / nesting =================
  moveNode: (id, dx, dy) => set(state => {
    const ids = [id, ...get().getDescendantIds(id)];
    const nodes = { ...state.nodes };
    ids.forEach(nid => {
      const n = nodes[nid];
      nodes[nid] = { ...n, x: n.x + dx, y: n.y + dy };
    });
    return { nodes };
  }),

  setNodePosition: (id, x, y) => {
    const state = get();
    const n = state.nodes[id];
    if (!n) return;
    const dx = x - n.x, dy = y - n.y;
    get().moveNode(id, dx, dy);
  },

  // returns absolute bbox (already absolute since we store absolute coords)
  getAbsRect: (id) => {
    const n = get().nodes[id];
    if (!n) return null;
    return { x: n.x, y: n.y, w: n.w, h: n.h };
  },

  // find deepest container whose bounds contain point, excluding self+descendants
  findDropTarget: (id, cx, cy) => {
    const state = get();
    const dragged = state.nodes[id];
    const excluded = new Set([id, ...get().getDescendantIds(id)]);
    let best = null, bestArea = Infinity;
    Object.values(state.nodes).forEach(n => {
      if (excluded.has(n.id)) return;
      const def = TYPE_DEFAULTS[n.type];
      if (!def?.container) return;
      if (state.hierarchyEnforced && dragged && !isAllowedParent(dragged.type, n.type, !!dragged.customTypeId)) return;
      if (cx >= n.x && cx <= n.x + n.w && cy >= n.y && cy <= n.y + n.h) {
        const area = n.w * n.h;
        if (area < bestArea) { bestArea = area; best = n.id; }
      }
    });
    return best;
  },

  reparentNode: (id, newParentId) => {
    const state = get();
    if (id === newParentId) return;
    const descendants = new Set(get().getDescendantIds(id));
    if (newParentId && descendants.has(newParentId)) return; // prevent cycles
    const node = state.nodes[id];
    if (!node) return;
    if (state.hierarchyEnforced) {
      const parentNode = newParentId ? state.nodes[newParentId] : null;
      const parentType = parentNode ? parentNode.type : null;
      if (!isAllowedParent(node.type, parentType, !!node.customTypeId)) {
        get().showToast(`${node.name} can't nest inside ${parentNode?.name || 'root'}`, 'warn');
        return;
      }
    }
    get().snapshotForUndo();
    set(s => ({ nodes: { ...s.nodes, [id]: { ...s.nodes[id], parentId: newParentId } } }));
    // A Physical Device dropped inside a Hypervisor logically becomes a
    // Virtual Machine (and converts back if it's pulled back out).
    get().autoConvertDeviceVm(id, newParentId);
  },

  // Physical Device <-> Virtual Machine auto-conversion based on containment.
  autoConvertDeviceVm: (id, newParentId) => {
    const state = get();
    const node = state.nodes[id];
    if (!node) return;
    const parent = newParentId ? state.nodes[newParentId] : null;

    if (node.type === 'device' && parent && parent.type === 'hypervisor') {
      const f = node.fields || {};
      const def = TYPE_DEFAULTS.vm;
      get().updateNode(id, {
        type: 'vm',
        w: def.w, h: def.h,
        // Fall back to the full vm default field set, then overlay whatever
        // carries over from the device's fields — otherwise any field not
        // explicitly mapped here silently disappears.
        fields: { ...defaultFieldsFor('vm'), guestOs: f.os || '', vCpu: f.cpu || '', vRam: f.ram || '', ip: f.ip || '' },
      });
      get().showToast(`${node.name} converted to a Virtual Machine (nested in ${parent.name})`);
    } else if (node.type === 'vm' && (!parent || parent.type !== 'hypervisor')) {
      const f = node.fields || {};
      const def = TYPE_DEFAULTS.device;
      get().updateNode(id, {
        type: 'device',
        w: def.w, h: def.h,
        fields: { ...defaultFieldsFor('device'), os: f.guestOs || '', cpu: f.vCpu || '', ram: f.vRam || '', ip: f.ip || '' },
      });
      get().showToast(`${node.name} converted back to a Physical Device`);
    }
  },

  growParentToFit: (id) => {
    const state = get();
    const n = state.nodes[id];
    if (!n || !n.parentId) return;
    const parent = state.nodes[n.parentId];
    if (!parent) return;
    const PAD = 40;
    let { x: px, y: py, w: pw, h: ph } = parent;
    const nx1 = n.x - PAD, ny1 = n.y - PAD - 20, nx2 = n.x + n.w + PAD, ny2 = n.y + n.h + PAD;
    let changed = false;
    let newX = px, newY = py, newW = pw, newH = ph;
    if (nx1 < px) { newW += (px - nx1); newX = nx1; changed = true; }
    if (ny1 < py) { newH += (py - ny1); newY = ny1; changed = true; }
    if (nx2 > px + pw) { newW = nx2 - newX; changed = true; }
    if (ny2 > py + ph) { newH = ny2 - newY; changed = true; }
    if (changed) {
      const dx = newX - px, dy = newY - py;
      set(s => ({ nodes: { ...s.nodes, [parent.id]: { ...s.nodes[parent.id], x: snap(newX), y: snap(newY), w: snap(newW), h: snap(newH) } } }));
      get().growParentToFit(parent.id);
    }
  },

  // Resize a container node to (newW,newH), proportionally scaling every
  // descendant's position/size along with it, and clamping to a reasonable
  // minimum so children are never squeezed smaller than a usable floor.
  resizeContainerWithChildren: (id, newW, newH) => {
    const state = get();
    const n = state.nodes[id];
    if (!n) return;
    const children = get().getChildren(id);
    const MIN_W = 120, MIN_H = 60;
    let minW = MIN_W, minH = MIN_H;
    if (children.length) {
      const maxCx = Math.max(...children.map(c => (c.x - n.x) + c.w));
      const maxCy = Math.max(...children.map(c => (c.y - n.y) + c.h));
      minW = Math.max(MIN_W, maxCx + 20);
      minH = Math.max(MIN_H, maxCy + 20);
    }
    const clampedW = Math.max(minW, newW);
    const clampedH = Math.max(minH, newH);
    const scaleX = clampedW / n.w, scaleY = clampedH / n.h;
    set(s => {
      const nodes = { ...s.nodes };
      children.forEach(c => {
        const relX = c.x - n.x, relY = c.y - n.y;
        nodes[c.id] = { ...c, x: snap(n.x + relX * scaleX), y: snap(n.y + relY * scaleY), w: Math.max(30, snap(c.w * scaleX)), h: Math.max(24, snap(c.h * scaleY)) };
      });
      nodes[id] = { ...nodes[id], w: snap(clampedW), h: snap(clampedH) };
      return { nodes };
    });
    return { w: clampedW, h: clampedH };
  },

  // Rescales every root-level node (and its descendants move with it) so the
  // whole workspace is visible at a reasonable size — a "zoom to fit",
  // computed against the actual on-screen viewport. This never touches node
  // geometry, only zoom/pan, so it's safe to hit repeatedly.
  autoScaleCanvas: () => {
    const state = get();
    const all = Object.values(state.nodes);
    if (all.length === 0) { get().showToast('Nothing to scale — add some nodes first', 'warn'); return; }
    const minX = Math.min(...all.map(n => n.x));
    const minY = Math.min(...all.map(n => n.y));
    const maxX = Math.max(...all.map(n => n.x + n.w));
    const maxY = Math.max(...all.map(n => n.y + n.h));
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const viewportEl = typeof document !== 'undefined' ? document.querySelector('.canvas-viewport') : null;
    const vw = viewportEl?.clientWidth || 1400;
    const vh = viewportEl?.clientHeight || 900;
    const PAD = 80;
    const fitScale = Math.min((vw - PAD * 2) / contentW, (vh - PAD * 2) / contentH);
    const newZoom = Math.max(0.15, Math.min(2, fitScale));
    get().setZoom(newZoom);
    get().setPan({ x: PAD - minX * newZoom, y: PAD - minY * newZoom });
    get().showToast('Auto-scaled to fit the workspace');
  },

  // Right-click "Scale Nodes to Smallest": an auto-sizer. Shrinks nodes back
  // down to their sensible default dimensions, working from the leaves up —
  // repacking whatever ends up inside a container into a tidy grid (so
  // shrinking never leaves overlapping siblings) and then shrinking the
  // container itself to snugly wrap that grid. Passing a containerId scopes
  // this to just what's inside that box; passing null runs it over every
  // root-level node (i.e. the whole canvas).
  scaleNodesToSmallest: (containerId) => {
    const PAD = 24, HEADER = 34, GAP = 14;

    const defaultSize = (n) => {
      if (n.customTypeId) {
        const ct = get().customTypes.find(c => c.id === n.customTypeId);
        return { w: ct?.w || 180, h: ct?.h || 90 };
      }
      const def = TYPE_DEFAULTS[n.type];
      return { w: def?.w || 180, h: def?.h || 90 };
    };

    // Shrink from the leaves up: reset this node's own size to its default,
    // then (if it has children) repack them into a grid and grow just
    // enough to wrap that grid snugly.
    const process = (id) => {
      const kids = get().getChildren(id);
      kids.forEach(k => process(k.id));

      const n = get().nodes[id];
      if (!n) return;
      const freshKids = get().getChildren(id);

      if (freshKids.length === 0) {
        const { w, h } = defaultSize(n);
        set(s => ({ nodes: { ...s.nodes, [id]: { ...s.nodes[id], w, h } } }));
        return;
      }

      const cols = Math.max(1, Math.ceil(Math.sqrt(freshKids.length)));
      let x = n.x + PAD, y = n.y + HEADER + PAD, rowH = 0, col = 0;
      let maxX = x, maxY = y;
      const updates = {};
      freshKids.forEach(k => {
        updates[k.id] = { x: snap(x), y: snap(y) };
        maxX = Math.max(maxX, x + k.w);
        rowH = Math.max(rowH, k.h);
        maxY = Math.max(maxY, y + k.h);
        col++;
        x += k.w + GAP;
        if (col >= cols) { col = 0; x = n.x + PAD; y += rowH + GAP; rowH = 0; }
      });
      set(s => {
        const nodes = { ...s.nodes };
        Object.entries(updates).forEach(([kid, pos]) => { nodes[kid] = { ...nodes[kid], ...pos }; });
        return { nodes };
      });
      const { w: defW, h: defH } = defaultSize(n);
      const newW = Math.max(defW, maxX - n.x + PAD);
      const newH = Math.max(defH, maxY - n.y + PAD);
      set(s => ({ nodes: { ...s.nodes, [id]: { ...s.nodes[id], w: snap(newW), h: snap(newH) } } }));
    };

    get().snapshotForUndo();
    // Run several passes per click: repacking a container can change its own
    // size, which changes how its parent repacks, etc. — a single pass
    // doesn't always settle, so we iterate instead of making the user click
    // repeatedly to reach the smallest layout.
    const PASSES = 10;
    if (containerId) {
      const targets = get().getChildren(containerId);
      if (targets.length === 0) { get().showToast('Nothing inside this box to scale', 'warn'); return; }
      for (let i = 0; i < PASSES; i++) {
        process(containerId);
        get().growParentToFit(containerId);
      }
      get().showToast('Scaled the contents of this box to their smallest reasonable size');
    } else {
      const roots = Object.values(get().nodes).filter(n => !n.parentId);
      if (roots.length === 0) { get().showToast('Nothing to scale — add some nodes first', 'warn'); return; }
      for (let i = 0; i < PASSES; i++) {
        roots.forEach(r => process(r.id));
      }
      get().showToast('Scaled every node to its smallest reasonable size');
    }
  },

  // ================= Connections =================
  addConnection: (from, to, kind = 'link', label = null) => {
    if (from === to) return;
    const exists = Object.values(get().connections).some(c => (c.from === from && c.to === to) || (c.from === to && c.to === from));
    if (exists) return;
    get().snapshotForUndo();
    const id = genId('c');
    set(state => ({ connections: { ...state.connections, [id]: { id, from, to, kind, label } } }));
    get().applySmartBinding(from, to);
  },

  // Walk up the parent chain from a node and find the nearest hosting
  // Device or Hypervisor — used so a reverse proxy that gets linked to an
  // application can also be connected to wherever that application actually
  // runs, since "the reverse proxy has to run somewhere".
  nearestDeviceAncestor: (id) => {
    const state = get();
    let cur = state.nodes[id];
    while (cur && cur.parentId) {
      cur = state.nodes[cur.parentId];
      if (cur && (cur.type === 'device' || cur.type === 'hypervisor')) return cur.id;
    }
    return null;
  },

  // The Link Tool's behavior when connecting two Applications together:
  // the data from the FIRST node picked is copied onto the SECOND, and the
  // two are symlinked (kind: 'applink') so it's visually distinct from a
  // plain topology link — just a straightforward "make B mirror A" action.
  linkApplications: (fromId, toId) => {
    const state = get();
    const from = state.nodes[fromId], to = state.nodes[toId];
    if (!from || !to || fromId === toId) return;
    get().snapshotForUndo();

    // Prefer whichever of the two nodes already has real (non-default) data
    // as the source of truth, regardless of which one was clicked first —
    // so linking a blank placeholder to an already-configured app doesn't
    // wipe out the configured one.
    let sourceId = fromId, targetId = toId;
    if (isCustomized(to) && !isCustomized(from)) {
      sourceId = toId; targetId = fromId;
    }
    const source = state.nodes[sourceId], target = state.nodes[targetId];

    set(s => ({
      nodes: {
        ...s.nodes,
        [targetId]: {
          ...s.nodes[targetId],
          fields: { ...s.nodes[sourceId].fields },
          syncedFromId: sourceId,
        },
      },
    }));

    const cid = genId('c');
    set(s => ({ connections: { ...s.connections, [cid]: { id: cid, from: sourceId, to: targetId, kind: 'applink' } } }));

    get().showToast(`${target.name} symlinked to ${source.name}`);
  },

  removeConnection: (id) => { get().snapshotForUndo(); return set(state => {
    const c = { ...state.connections };
    delete c[id];
    return { connections: c };
  }); },

  unlinkNode: (id) => { get().snapshotForUndo(); return set(state => ({
    connections: Object.fromEntries(Object.entries(state.connections).filter(([, c]) => c.from !== id && c.to !== id))
  })); },

  getNodeConnections: (id) => Object.values(get().connections).filter(c => c.from === id || c.to === id),

  applySmartBinding: (from, to) => {
    const state = get();
    const a = state.nodes[from], b = state.nodes[to];
    if (!a || !b) return;
    const pair = [a, b];
    const net = pair.find(n => n.type === 'network');
    const other = pair.find(n => n.type !== 'network');
    if (net && other && 'ip' in other.fields) {
      const base = (net.fields.cidr || '192.168.1.0/24').split('/')[0].split('.').slice(0, 3).join('.');
      const suggestedIp = `${base}.${50 + Math.floor(Math.random() * 150)}`;
      get().updateNodeFields(other.id, { ip: other.fields.ip || suggestedIp, gateway: net.fields.gateway });
    }
    const storage = pair.find(n => n.type === 'storage');
    const app = pair.find(n => n.type === 'application' || n.type === 'directory');
    if (storage && app && 'mountPath' in (app.fields || {})) {
      get().updateNodeFields(app.id, { mountPath: app.fields.mountPath || storage.fields.mountPath || '/mnt/data' });
    } else if (storage && app) {
      get().updateNodeFields(app.id, { symlinkTarget: storage.fields.mountPath || '/mnt/data' });
    }
  },

  // ================= Selection / UI =================
  // `additive` (shift-click) toggles the node in/out of the current
  // multi-selection instead of replacing it. A plain select (no modifier)
  // always collapses back down to a single-node selection.
  select: (id, additive = false) => set(state => {
    if (additive && id) {
      const has = state.selectedIds.includes(id);
      const nextIds = has ? state.selectedIds.filter(nid => nid !== id) : [...state.selectedIds, id];
      return {
        selectedIds: nextIds,
        selectedId: nextIds.length ? id : null,
        inspectorOpen: nextIds.length > 0,
        nodes: state.nodes[id] ? { ...state.nodes, [id]: { ...state.nodes[id], zOrder: zCounter++ } } : state.nodes,
      };
    }
    return {
      selectedId: id,
      selectedIds: id ? [id] : [],
      inspectorOpen: !!id,
      nodes: id && state.nodes[id] ? { ...state.nodes, [id]: { ...state.nodes[id], zOrder: zCounter++ } } : state.nodes,
    };
  }),
  closeInspector: () => set({ inspectorOpen: false }),
  openContextMenu: (x, y, nodeId, worldPos = null) => set({ contextMenu: { x, y, nodeId, worldPos } }),
  closeContextMenu: () => set({ contextMenu: null }),
  toggleConnectMode: () => set(state => ({ connectMode: !state.connectMode, pendingConnectFrom: null })),
  setPendingConnectFrom: (id) => set({ pendingConnectFrom: id }),
  openAddNodeModal: (parentId = null) => set({ addNodeModal: { parentId } }),
  closeAddNodeModal: () => set({ addNodeModal: null }),
  toggleTypeManager: () => set(state => ({ typeManagerOpen: !state.typeManagerOpen })),
  showToast: (msg, kind = 'info') => {
    set({ toast: { msg, kind, t: Date.now() } });
    setTimeout(() => {
      if (get().toast && get().toast.t === get().toast.t) set(s => (Date.now() - s.toast?.t >= 2400 ? { toast: null } : {}));
    }, 2500);
  },

  // ================= View =================
  setZoom: (z) => set({ zoom: Math.min(2.5, Math.max(0.2, z)) }),
  setPan: (p) => set({ pan: p }),
  toggleGridSnap: () => set(state => ({ gridSnapEnabled: !state.gridSnapEnabled })),
  setVlanFilter: (v) => set({ vlanFilter: v }),

  // ================= Custom types =================
  addCustomType: (def) => {
    const id = genId('ctype');
    const ct = { id, label: def.label, color: def.color || '#71717A', category: def.category || 'device', attrs: def.attrs || [] };
    set(state => ({ customTypes: [...state.customTypes, ct] }));
    return id;
  },
  removeCustomType: (id) => set(state => ({ customTypes: state.customTypes.filter(c => c.id !== id) })),

  // ================= Derived: IPAM =================
  getIpamEntries: () => {
    const { nodes } = get();
    const entries = [];
    Object.values(nodes).forEach(n => {
      if (n.type === 'network' && n.fields.cidr) {
        entries.push({ nodeId: n.id, name: n.name, ip: n.fields.gateway, role: 'Gateway', cidr: n.fields.cidr });
      }
      if (n.fields?.ip) {
        entries.push({ nodeId: n.id, name: n.name, ip: n.fields.ip, role: n.type, cidr: null });
      }
    });
    return entries;
  },

  getIpCollisions: () => {
    const entries = get().getIpamEntries();
    const byIp = {};
    entries.forEach(e => { if (!e.ip) return; (byIp[e.ip] = byIp[e.ip] || []).push(e); });
    return Object.entries(byIp).filter(([, list]) => list.length > 1).map(([ip, list]) => ({ ip, list }));
  },

  // ================= Derived: Port conflicts =================
  getPortConflicts: () => {
    const { nodes } = get();
    const byPort = {};
    Object.values(nodes).forEach(n => {
      const ports = [];
      if (n.type === 'application' && n.fields.port) ports.push(...String(n.fields.port).split(',').map(s => s.trim()).filter(Boolean));
      // Mapped host ports are a VM-level concept, not Docker Host — Docker
      // Hosts only carry a network mode; only VMs expose host port mappings.
      if (n.type === 'vm' && n.fields.hostPorts) ports.push(...String(n.fields.hostPorts).split(',').map(s => s.trim()).filter(Boolean));
      ports.forEach(p => {
        const portNum = p.split(':')[0].trim();
        (byPort[portNum] = byPort[portNum] || []).push(n.id);
      });
    });
    return Object.entries(byPort).filter(([, ids]) => ids.length > 1).map(([port, ids]) => ({ port, ids }));
  },

  // ================= Export / Import =================
  exportJSON: () => {
    const state = get();
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes: state.nodes,
      connections: state.connections,
      rootOrder: state.rootOrder,
      customTypes: state.customTypes,
      views: state.views,
    }, null, 2);
  },

  importJSON: (json) => {
    try {
      const data = JSON.parse(json);
      set({
        nodes: data.nodes || {},
        connections: data.connections || {},
        rootOrder: data.rootOrder || Object.keys(data.nodes || {}),
        customTypes: data.customTypes || [],
        views: data.views && data.views.length ? data.views : [{ id: 'default', name: 'All', hiddenTypes: [] }],
        activeViewId: 'default',
        selectedId: null,
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  resetWorkspace: () => set({ nodes: {}, connections: {}, rootOrder: [], customTypes: [], selectedId: null, selectedIds: [] }),

  // ================= Multi-project support =================
  // Each project is a fully independent workspace (nodes/connections/toggles/
  // layout style) stored under its own localStorage key. A small index
  // ({ activeId, projects: [{id,name,createdAt}] }) tracks what exists.
  projects: [],
  activeProjectId: null,
  newProjectModalOpen: false,

  openNewProjectModal: () => set({ newProjectModalOpen: true }),
  closeNewProjectModal: () => set({ newProjectModalOpen: false }),

  _snapshotForSave: () => {
    const s = get();
    return {
      nodes: s.nodes, connections: s.connections, rootOrder: s.rootOrder, customTypes: s.customTypes,
      hierarchyEnforced: s.hierarchyEnforced,
      gridSnapEnabled: s.gridSnapEnabled, minimalUi: s.minimalUi,
      views: s.views, activeViewId: s.activeViewId,
    };
  },

  _applySnapshot: (data) => set({
    nodes: data.nodes || {},
    connections: data.connections || {},
    rootOrder: data.rootOrder || Object.keys(data.nodes || {}),
    customTypes: data.customTypes || [],
    hierarchyEnforced: data.hierarchyEnforced ?? true,
    gridSnapEnabled: data.gridSnapEnabled ?? true,
    minimalUi: data.minimalUi ?? false,
    views: data.views && data.views.length ? data.views : [{ id: 'default', name: 'All', hiddenTypes: [] }],
    activeViewId: data.activeViewId || 'default',
    selectedId: null, selectedIds: [], contextMenu: null,
  }),

  // Called once on app boot. Restores the project index from the server,
  // migrating an old browser-only save (pre-server-storage) up to the
  // server the first time it runs. Falls back to localStorage entirely if
  // the server can't be reached, so the app still works offline. Returns
  // true if an existing project was loaded, so the caller knows whether to
  // seed a fresh demo instead.
  hydrateFromStorage: async () => {
    // Try the server first — this is the source of truth.
    try {
      const index = await apiGet('/api/index');
      if (index && index.projects && index.projects.length) {
        const active = index.projects.find(p => p.id === index.activeId) || index.projects[0];
        const data = await apiGet(`/api/projects/${active.id}`);
        set({ projects: index.projects, activeProjectId: active.id });
        if (data && Object.keys(data).length) get()._applySnapshot(data);
        return true;
      }
      // Server reachable but empty — check for a pre-existing local save to
      // migrate up to it (first run after upgrading to server storage).
      const migrated = get()._migrateLocalStorageToServer();
      if (migrated) return true;
      return false;
    } catch {
      // Server unreachable — fall back to whatever's in localStorage.
      try {
        const rawIndex = localStorage.getItem(LS_INDEX_KEY);
        if (rawIndex) {
          const index = JSON.parse(rawIndex);
          const active = index.projects.find(p => p.id === index.activeId) || index.projects[0];
          if (!active) return false;
          const raw = localStorage.getItem(projectKey(active.id));
          const data = raw ? JSON.parse(raw) : null;
          set({ projects: index.projects, activeProjectId: active.id });
          if (data) get()._applySnapshot(data);
          get().showToast('Storage server unreachable — using local offline copy', 'warn');
          return true;
        }
        const legacyRaw = localStorage.getItem(LEGACY_LS_KEY);
        if (legacyRaw) {
          const data = JSON.parse(legacyRaw);
          if (data && data.nodes) {
            const id = genId('proj');
            const project = { id, name: 'Default', createdAt: Date.now() };
            set({ projects: [project], activeProjectId: id });
            get()._applySnapshot(data);
            localStorage.setItem(projectKey(id), legacyRaw);
            localStorage.setItem(LS_INDEX_KEY, JSON.stringify({ activeId: id, projects: [project] }));
            localStorage.removeItem(LEGACY_LS_KEY);
            return true;
          }
        }
        return false;
      } catch {
        return false;
      }
    }
  },

  // One-time upgrade path: if the server has no projects yet but this
  // browser has a localStorage save from before server-side storage
  // existed, push it up to the server so it isn't lost.
  _migrateLocalStorageToServer: () => {
    try {
      const rawIndex = localStorage.getItem(LS_INDEX_KEY);
      const legacyRaw = localStorage.getItem(LEGACY_LS_KEY);
      let index = rawIndex ? JSON.parse(rawIndex) : null;
      if (!index && legacyRaw) {
        const data = JSON.parse(legacyRaw);
        if (data && data.nodes) {
          const id = genId('proj');
          index = { activeId: id, projects: [{ id, name: 'Default', createdAt: Date.now() }] };
          localStorage.setItem(projectKey(id), legacyRaw);
        }
      }
      if (!index || !index.projects?.length) return false;
      const active = index.projects.find(p => p.id === index.activeId) || index.projects[0];
      const raw = localStorage.getItem(projectKey(active.id));
      const data = raw ? JSON.parse(raw) : {};
      set({ projects: index.projects, activeProjectId: active.id });
      if (Object.keys(data).length) get()._applySnapshot(data);
      apiPut('/api/index', index).catch(() => {});
      apiPut(`/api/projects/${active.id}`, data).catch(() => {});
      get().showToast('Migrated local project to the server');
      return true;
    } catch {
      return false;
    }
  },

  // Persists the currently-active project's data plus the project index to
  // the server. Also mirrors to localStorage as an offline cache/fallback.
  persistToStorage: async () => {
    const s = get();
    if (!s.activeProjectId) return;
    const snapshot = get()._snapshotForSave();
    const index = { activeId: s.activeProjectId, projects: s.projects };
    try {
      localStorage.setItem(projectKey(s.activeProjectId), JSON.stringify(snapshot));
      localStorage.setItem(LS_INDEX_KEY, JSON.stringify(index));
    } catch {
      // Local cache full/unavailable — not fatal, server write below is what matters.
    }
    try {
      await apiPut(`/api/projects/${s.activeProjectId}`, snapshot);
      await apiPut('/api/index', index);
    } catch {
      // Server unreachable — the localStorage mirror above keeps things
      // working locally until it's back.
    }
  },

  // Creates a brand-new, empty project and switches to it immediately.
  createProject: async (name) => {
    await get().persistToStorage(); // flush the outgoing project first
    const id = genId('proj');
    const project = { id, name: name?.trim() || 'Untitled Project', createdAt: Date.now() };
    set(s => ({ projects: [...s.projects, project], activeProjectId: id, newProjectModalOpen: false }));
    get()._applySnapshot({});
    await get().persistToStorage();
    return id;
  },

  switchProject: async (id) => {
    const s = get();
    if (id === s.activeProjectId) return;
    await s.persistToStorage(); // flush the outgoing project first
    let data = {};
    try {
      data = await apiGet(`/api/projects/${id}`);
    } catch {
      const raw = localStorage.getItem(projectKey(id));
      data = raw ? JSON.parse(raw) : {};
    }
    set({ activeProjectId: id });
    get()._applySnapshot(data);
  },

  renameProject: (id, name) => {
    if (!name?.trim()) return;
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, name: name.trim() } : p) }));
    get().persistToStorage();
  },

  deleteProject: async (id) => {
    const s = get();
    if (s.projects.length <= 1) { get().showToast('At least one project must remain', 'warn'); return; }
    const remaining = s.projects.filter(p => p.id !== id);
    localStorage.removeItem(projectKey(id));
    apiDelete(`/api/projects/${id}`).catch(() => {});
    if (s.activeProjectId === id) {
      const next = remaining[0];
      set({ projects: remaining, activeProjectId: next.id });
      let data = {};
      try {
        data = await apiGet(`/api/projects/${next.id}`);
      } catch {
        const raw = localStorage.getItem(projectKey(next.id));
        data = raw ? JSON.parse(raw) : {};
      }
      get()._applySnapshot(data);
    } else {
      set({ projects: remaining });
    }
    get().persistToStorage();
  },
}));

// Auto-save on every relevant state change (debounced to a trailing tick so
// rapid drag-move updates don't hammer localStorage on every pixel).
let persistTimer = null;
useDiagramStore.subscribe(() => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => useDiagramStore.getState().persistToStorage(), 300);
});

export { CONTAINER_TYPES, isAllowedParent };
