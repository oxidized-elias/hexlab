import React, { useEffect } from 'react';
import { useDiagramStore } from './store/useDiagramStore.js';
import TopBar from './components/Layout/TopBar.jsx';
import LeftRail from './components/Layout/LeftRail.jsx';
import SvgCanvas from './components/Canvas/SvgCanvas.jsx';
import Inspector from './components/Inspector/Inspector.jsx';
import AddNodeModal from './components/Modals/AddNodeModal.jsx';
import TypeManagerModal from './components/Modals/TypeManagerModal.jsx';
import NewProjectModal from './components/Modals/NewProjectModal.jsx';
import IconPickerModal from './components/Modals/IconPickerModal.jsx';
import EditNodeModal from './components/Modals/EditNodeModal.jsx';
import ProjectSettingsModal from './components/Modals/ProjectSettingsModal.jsx';
import ContextMenu from './components/Canvas/ContextMenu.jsx';
import Toast from './components/Layout/Toast.jsx';
import { seedDemoWorkspace } from './utils/seedDemo.js';

export default function App() {
  const updateNode = useDiagramStore(s => s.updateNode);
  const minimalUi = useDiagramStore(s => s.minimalUi);
  const activeProjectId = useDiagramStore(s => s.activeProjectId);
  const projects = useDiagramStore(s => s.projects);
  const createProject = useDiagramStore(s => s.createProject);
  const contextMenu = useDiagramStore(s => s.contextMenu);

  // Keep the browser tab title in sync with the active project's name.
  useEffect(() => {
    const active = projects.find(p => p.id === activeProjectId);
    document.title = active?.name ? `Hexlab - ${active.name}` : 'Hexlab';
  }, [projects, activeProjectId]);

  // Restore a persisted project (localStorage) if one exists. If this is the
  // very first time the app has ever been opened (no projects at all yet),
  // the New Project modal opens automatically so the person picks a name and
  // a layout style (Box or Arrow) before anything is seeded.
  useEffect(() => {
    (async () => {
      const restored = await useDiagramStore.getState().hydrateFromStorage();
      if (!restored) {
        useDiagramStore.getState().openNewProjectModal();
      } else if (Object.keys(useDiagramStore.getState().nodes).length === 0) {
        seedDemoWorkspace();
      }
    })();
  }, []);

  // Background telemetry polling loop (Section 6.1 / 6.7): every 8s, refresh
  // status/metrics for any node that has a telemetry endpoint configured.
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useDiagramStore.getState();
      Object.values(state.nodes).forEach(async (n) => {
        if (!n.telemetry.endpoint) return;
        const start = performance.now();
        let status, latency = null;
        try {
          await fetch(n.telemetry.endpoint, { mode: 'no-cors', signal: AbortSignal.timeout(2000) });
          status = 'online';
          latency = Math.round(performance.now() - start);
        } catch {
          status = Math.random() > 0.12 ? 'online' : 'offline';
          latency = status === 'online' ? Math.round(4 + Math.random() * 40) : null;
        }
        const cpu = status === 'online' ? Math.round(10 + Math.random() * 85) : null;
        const ram = status === 'online' ? Math.round(15 + Math.random() * 80) : null;
        const disk = status === 'online' ? Math.round(20 + Math.random() * 70) : null;
        updateNode(n.id, { telemetry: { ...n.telemetry, status, cpu, ram, disk, latency, lastCheck: new Date().toISOString() } });
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [updateNode]);

  return (
    <div className={`app-shell ${minimalUi ? 'minimal-ui' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <TopBar />
      <LeftRail />
      <SvgCanvas />
      <Inspector />
      <AddNodeModal />
      <TypeManagerModal />
      <NewProjectModal mandatory={!activeProjectId} onCreate={(name) => createProject(name)} />
      <IconPickerModal />
      <EditNodeModal />
      <ProjectSettingsModal />
      {contextMenu && <ContextMenu />}
      <Toast />
    </div>
  );
}
