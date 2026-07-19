import { useDiagramStore } from '../store/useDiagramStore.js';

export function seedDemoWorkspace() {
  const { addNode, updateNodeFields, addConnection } = useDiagramStore.getState();

  const lan = addNode('network', { x: 120, y: 120 });
  updateNodeFields(lan, { cidr: '192.168.1.0/24', gateway: '192.168.1.1', dns: '192.168.1.1', vlanId: '1' });

  const host = addNode('device', { x: 160, y: 220, parentId: lan });
  updateNodeFields(host, { manufacturer: 'Dell', model: 'PowerEdge R730', formFactor: '2U', os: 'Proxmox VE', ip: '192.168.1.5' });

  const hv = addNode('hypervisor', { x: 200, y: 260, parentId: host });
  updateNodeFields(hv, { hostOs: 'Proxmox VE', totalCpu: '16c/32t', totalRam: '128GB' });

  const vm = addNode('vm', { x: 240, y: 300, parentId: hv });
  updateNodeFields(vm, { guestOs: 'Ubuntu Server', vCpu: '4c', vRam: '8GB', ip: '192.168.1.20', hostPorts: '8080:80, 443:443' });

  const docker = addNode('docker', { x: 260, y: 330, parentId: vm });
  updateNodeFields(docker, { networkMode: 'bridge' });

  const app1 = addNode('application', { x: 300, y: 390, parentId: docker });
  updateNodeFields(app1, { image: 'lscr.io/linuxserver/jellyfin:latest', port: '8096:8096', status: 'Active', tags: 'media' });

  const app2 = addNode('application', { x: 460, y: 390, parentId: docker });
  updateNodeFields(app2, { image: 'traefik:v3', port: '443:443', status: 'Active', tags: 'proxy' });

  const nas = addNode('device', { x: 650, y: 140 });
  updateNodeFields(nas, { manufacturer: 'TrueNAS', model: 'Custom Build', formFactor: '4U', os: 'TrueNAS', ip: '192.168.1.10' });

  const pool = addNode('storage', { x: 700, y: 260, parentId: nas });
  updateNodeFields(pool, { subtype: 'Storage Pool', capacity: '48TB', raidLevel: 'Z2', mountPath: '/mnt/pool0' });

  addConnection(hv, lan);
  addConnection(nas, lan);
  addConnection(app1, pool);

  useDiagramStore.getState().select(null);
}
