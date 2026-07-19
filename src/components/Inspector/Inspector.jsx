import React, { useState } from 'react';
import { useDiagramStore, TYPE_DEFAULTS } from '../../store/useDiagramStore.js';
import { parseCompose } from '../../utils/composeParser.js';
import { generateDockerCompose, generateK8sManifests, generateNginx, generateTraefik, generateDnsRewrite } from '../../utils/generators.js';
import ColorPickerPopover from '../Common/ColorPickerPopover.jsx';

export function Field({ label, children }) {
  return <div className="field-group"><label className="field-label">{label}</label>{children}</div>;
}

// Builds a best-effort URL for an IP/host string so it can be opened in a
// new tab — adds a scheme if one isn't already present.
function urlFor(value) {
  const v = (value || '').trim();
  if (!v) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `http://${v}`;
}

// An IP/URL text input with a small button that opens the current value in
// a new tab (rather than making the whole field clickable, which would
// conflict with editing it).
function IpField({ label, value, onChange, placeholder }) {
  const url = urlFor(value);
  return (
    <Field label={label}>
      <div className="ip-field-row">
        <input className="field-input mono" value={value} onChange={onChange} placeholder={placeholder} />
        <button
          type="button"
          className="btn icon-only small"
          title={url ? `Open ${url} in a new tab` : 'Enter a value first'}
          disabled={!url}
          onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
        >↗</button>
      </div>
    </Field>
  );
}

export default function Inspector() {
  const selectedId = useDiagramStore(s => s.selectedId);
  const nodes = useDiagramStore(s => s.nodes);
  const node = selectedId ? nodes[selectedId] : null;
  const updateNode = useDiagramStore(s => s.updateNode);
  const updateNodeFields = useDiagramStore(s => s.updateNodeFields);
  const deleteNode = useDiagramStore(s => s.deleteNode);
  const cloneNode = useDiagramStore(s => s.cloneNode);
  const select = useDiagramStore(s => s.select);
  const showToast = useDiagramStore(s => s.showToast);
  const getChildren = useDiagramStore(s => s.getChildren);
  const getIpamEntries = useDiagramStore(s => s.getIpamEntries);
  const getIpCollisions = useDiagramStore(s => s.getIpCollisions);
  const getPortConflicts = useDiagramStore(s => s.getPortConflicts);
  const diagnosticsDismissed = useDiagramStore(s => s.diagnosticsDismissed);
  const dismissDiagnostics = useDiagramStore(s => s.dismissDiagnostics);
  const reopenDiagnostics = useDiagramStore(s => s.reopenDiagnostics);
  const [composeText, setComposeText] = useState('');
  const [genOutput, setGenOutput] = useState(null);

  if (!node) {
    if (diagnosticsDismissed) {
      return (
        <div className="inspector">
          <div className="inspector-empty">
            <button className="btn small" onClick={reopenDiagnostics}>Show Workspace Diagnostics</button>
          </div>
        </div>
      );
    }
    const ipam = getIpamEntries();
    const collisions = getIpCollisions();
    const conflicts = getPortConflicts();
    return (
      <div className="inspector">
        <div className="inspector-header">
          <div className="inspector-title">Workspace Diagnostics</div>
          <button className="btn icon-only small" onClick={dismissDiagnostics} title="Close">✕</button>
        </div>
        <div className="inspector-body">
          <div>
            <div className="inspector-section-title">IPAM Ledger</div>
            {ipam.length === 0 && <div className="rail-empty">No IP allocations yet.</div>}
            {ipam.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {ipam.map((e, i) => (
                  <div key={i} className="node-body kv mono" style={{ background: 'var(--bg-panel-alt)', padding: '5px 8px', borderRadius: 3 }}>
                    <span>{e.name} <span style={{ color: 'var(--text-dim)' }}>({e.role})</span></span>
                    <b>{e.ip}</b>
                  </div>
                ))}
              </div>
            )}
            {collisions.length > 0 && (
              <div className="alert-box" style={{ marginTop: 8 }}>⚠ {collisions.length} IP collision(s) detected</div>
            )}
          </div>
          <div>
            <div className="inspector-section-title">Port Conflict Auditor</div>
            {conflicts.length === 0 && <div className="rail-empty">No port conflicts detected.</div>}
            {conflicts.map((c, i) => (
              <div className="alert-box" key={i} style={{ marginTop: 6 }}>
                ⚠ Port {c.port} used by {c.ids.length} nodes: {c.ids.map(id => nodes[id]?.name).filter(Boolean).join(', ')}
              </div>
            ))}
          </div>
          <div className="inspector-empty">Select a node on the canvas to configure it.</div>
        </div>
      </div>
    );
  }

  const def = TYPE_DEFAULTS[node.type];
  const color = node.color || def.color;
  const isContainer = def.container;
  const parent = node.parentId ? nodes[node.parentId] : null;
  const isAppInContainer = node.type === 'application' && parent && (parent.type === 'docker' || parent.type === 'k8s');
  const children = getChildren(node.id);

  const set = (patch) => updateNode(node.id, patch);
  const setF = (patch) => updateNodeFields(node.id, patch);

  const runParseCompose = () => {
    const parsed = parseCompose(composeText);
    if (!parsed) { showToast('Could not parse compose text', 'warn'); return; }
    setF({
      port: parsed.ports.join(', ') || node.fields.port,
      image: parsed.image || node.fields.image,
      compose: composeText,
    });
    showToast(`Parsed: ${parsed.ports.length} port(s), ${parsed.volumes.length} volume(s), ${parsed.envCount} env var(s)`);
  };

  const runGenerator = (kind) => {
    let out = '';
    if (kind === 'compose') out = generateDockerCompose(node, children);
    if (kind === 'k8s') out = generateK8sManifests(node, children);
    if (kind === 'nginx') out = generateNginx(node);
    if (kind === 'traefik') out = generateTraefik(node);
    if (kind === 'dns') out = generateDnsRewrite(node);
    setGenOutput(out);
  };

  return (
    <div className="inspector">
      <div className="inspector-header">
        <div>
          <div className="inspector-title">{node.name}</div>
          <div className="inspector-subtype">{node.type}{node.customTypeId ? ' · custom' : ''}</div>
        </div>
        <button className="btn icon-only small" onClick={() => select(null)}>✕</button>
      </div>

      <div className="inspector-body">
        <Field label="Name">
          <input className="field-input" value={node.name} onChange={e => set({ name: e.target.value })} />
        </Field>

        <Field label="Accent Color Override">
          <ColorPickerPopover
            value={color}
            onChange={(c) => set({ color: c })}
            onReset={() => set({ color: null })}
            resettable={!!node.color}
          />
        </Field>

        <Field label="Icon (dashboard-icons name, e.g. 'plex', 'proxmox', 'jellyfin')">
          <input className="field-input" value={node.icon || ''} onChange={e => set({ icon: e.target.value || null })} placeholder="Leave blank for default type icon" />
        </Field>

        {/* ---- Type specific fields ---- */}
        <div className="inspector-section-title">Configuration</div>
        <TypeFields node={node} setF={setF} />

        {/* ---- Telemetry ---- */}
        <div className="inspector-section-title">Live Telemetry</div>
        <TelemetryPanel node={node} set={set} />

        {/* ---- Compose paste for nested apps ---- */}
        {isAppInContainer && (
          <>
            <div className="inspector-section-title">Compose / Pod YAML Import</div>
            <Field label="Paste docker-compose.yml or pod spec">
              <textarea className="field-textarea" value={composeText} onChange={e => setComposeText(e.target.value)} placeholder={'image: myapp:latest\nports:\n  - "8080:80"\nvolumes:\n  - /data:/app/data\nenvironment:\n  - KEY=value'} />
            </Field>
            <button className="btn small" onClick={runParseCompose}>Parse & Auto-populate</button>
          </>
        )}

        {/* ---- Generators for docker/k8s host containers ---- */}
        {(node.type === 'docker' || node.type === 'k8s') && (
          <>
            <div className="inspector-section-title">Manifest Generator</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn small" onClick={() => runGenerator(node.type === 'docker' ? 'compose' : 'k8s')}>
                Generate {node.type === 'docker' ? 'docker-compose.yml' : 'K8s Manifests'}
              </button>
            </div>
          </>
        )}

        {/* ---- Ingress / proxy generators for application or network nodes ---- */}
        {(node.type === 'application' || node.type === 'network') && (
          <>
            <div className="inspector-section-title">Ingress / Proxy / DNS Routes</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn small" onClick={() => runGenerator('nginx')}>Nginx</button>
              <button className="btn small" onClick={() => runGenerator('traefik')}>Traefik</button>
              <button className="btn small" onClick={() => runGenerator('dns')}>DNS Rewrite</button>
            </div>
          </>
        )}

        {genOutput && (
          <>
            <div className="output-block">{genOutput}</div>
            <button className="btn small" onClick={() => { navigator.clipboard?.writeText(genOutput); showToast('Copied to clipboard'); }}>Copy</button>
          </>
        )}

        <div className="inspector-section-title">Actions</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn small" onClick={() => cloneNode(node.id)}>Clone</button>
          <button className="btn small danger" onClick={() => deleteNode(node.id)}>Delete</button>
        </div>
      </div>
    </div>
  );
}


export function TypeFields({ node, setF }) {
  const f = node.fields;
  switch (node.type) {
    case 'group':
      return (
        <>
          <Field label="Group Mode">
            <select className="field-select" value={f.mode} onChange={e => setF({ mode: e.target.value })}>
              <option value="aesthetic">Aesthetic (visual only)</option>
              <option value="functional">Functional (data-linked)</option>
            </select>
          </Field>
        </>
      );
    case 'device':
      return (
        <>
          <div className="field-row">
            <Field label="Manufacturer"><input className="field-input" value={f.manufacturer} onChange={e => setF({ manufacturer: e.target.value })} /></Field>
            <Field label="Model"><input className="field-input" value={f.model} onChange={e => setF({ model: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <Field label="Form Factor">
              <select className="field-select" value={f.formFactor} onChange={e => setF({ formFactor: e.target.value })}>
                {['Tower', '1U', '2U', '4U'].map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Operating System">
              <input className="field-input" list="os-list" value={f.os} onChange={e => setF({ os: e.target.value })} />
              <datalist id="os-list">
                {['Debian', 'RHEL', 'TrueNAS', 'Alpine', 'Windows Server', 'Ubuntu Server'].map(v => <option key={v} value={v} />)}
              </datalist>
            </Field>
          </div>
          <div className="field-row">
            <Field label="CPU"><input className="field-input" value={f.cpu} onChange={e => setF({ cpu: e.target.value })} /></Field>
            <Field label="RAM"><input className="field-input" value={f.ram} onChange={e => setF({ ram: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <IpField label="IP Address" value={f.ip} onChange={e => setF({ ip: e.target.value })} />
            <Field label="Serial Number"><input className="field-input" value={f.serial} onChange={e => setF({ serial: e.target.value })} /></Field>
          </div>
          <Field label="Location / Rack ID"><input className="field-input" value={f.rackId} onChange={e => setF({ rackId: e.target.value })} /></Field>
        </>
      );
    case 'network':
      return (
        <>
          <Field label="IP CIDR Block"><input className="field-input mono" value={f.cidr} onChange={e => setF({ cidr: e.target.value })} /></Field>
          <div className="field-row">
            <Field label="DHCP Start"><input className="field-input mono" value={f.dhcpStart} onChange={e => setF({ dhcpStart: e.target.value })} /></Field>
            <Field label="DHCP End"><input className="field-input mono" value={f.dhcpEnd} onChange={e => setF({ dhcpEnd: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <Field label="DNS Server"><input className="field-input mono" value={f.dns} onChange={e => setF({ dns: e.target.value })} /></Field>
            <Field label="Gateway"><input className="field-input mono" value={f.gateway} onChange={e => setF({ gateway: e.target.value })} /></Field>
          </div>
          <Field label="VLAN ID"><input className="field-input" value={f.vlanId} onChange={e => setF({ vlanId: e.target.value })} /></Field>
        </>
      );
    case 'hypervisor':
      return (
        <>
          <Field label="Hypervisor OS">
            <select className="field-select" value={f.hostOs} onChange={e => setF({ hostOs: e.target.value })}>
              {['Proxmox VE', 'ESXi', 'XCP-ng', 'Hyper-V'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <div className="field-row">
            <Field label="Total Host CPU"><input className="field-input" value={f.totalCpu} onChange={e => setF({ totalCpu: e.target.value })} /></Field>
            <Field label="Total Host RAM"><input className="field-input" value={f.totalRam} onChange={e => setF({ totalRam: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <Field label="Guest CPU Alloc"><input className="field-input" value={f.guestCpu} onChange={e => setF({ guestCpu: e.target.value })} /></Field>
            <Field label="Guest RAM Alloc"><input className="field-input" value={f.guestRam} onChange={e => setF({ guestRam: e.target.value })} /></Field>
          </div>
        </>
      );
    case 'vm':
      return (
        <>
          <Field label="Guest OS">
            <input className="field-input" list="os-list" value={f.guestOs} onChange={e => setF({ guestOs: e.target.value })} />
            <datalist id="os-list">
              {['Debian', 'RHEL', 'TrueNAS', 'Alpine', 'Windows Server', 'Ubuntu Server'].map(v => <option key={v} value={v} />)}
            </datalist>
          </Field>
          <div className="field-row">
            <Field label="vCPU"><input className="field-input" value={f.vCpu} onChange={e => setF({ vCpu: e.target.value })} /></Field>
            <Field label="vRAM"><input className="field-input" value={f.vRam} onChange={e => setF({ vRam: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <IpField label="IP Address" value={f.ip} onChange={e => setF({ ip: e.target.value })} />
            <Field label="Disk Size"><input className="field-input" value={f.diskSize} onChange={e => setF({ diskSize: e.target.value })} placeholder="128GB" /></Field>
          </div>
          <Field label="Mapped Host Ports (comma sep)"><input className="field-input" value={f.hostPorts} onChange={e => setF({ hostPorts: e.target.value })} placeholder="8080:80, 443:443" /></Field>
        </>
      );
    case 'k8s':
      return (
        <>
          <Field label="Node Role">
            <select className="field-select" value={f.nodeRole} onChange={e => setF({ nodeRole: e.target.value })}>
              <option>Control Plane</option><option>Worker</option>
            </select>
          </Field>
          <Field label="Namespace"><input className="field-input" value={f.namespace} onChange={e => setF({ namespace: e.target.value })} /></Field>
          <Field label="Pod CIDR"><input className="field-input mono" value={f.podCidr} onChange={e => setF({ podCidr: e.target.value })} /></Field>
          <Field label="API Server Endpoint"><input className="field-input mono" value={f.apiEndpoint} onChange={e => setF({ apiEndpoint: e.target.value })} /></Field>
          <div className="field-row">
            <Field label="CPU Limit"><input className="field-input" value={f.cpuLimit} onChange={e => setF({ cpuLimit: e.target.value })} /></Field>
            <Field label="Memory Limit"><input className="field-input" value={f.memLimit} onChange={e => setF({ memLimit: e.target.value })} /></Field>
          </div>
        </>
      );
    case 'docker':
      return (
        <>
          <Field label="Network Mode">
            <select className="field-select" value={f.networkMode} onChange={e => setF({ networkMode: e.target.value })}>
              <option value="bridge">Bridge</option><option value="host">Host</option><option value="macvlan">Macvlan</option>
            </select>
          </Field>
          <Field label="Container Env Vars (.env)"><textarea className="field-textarea" value={f.env} onChange={e => setF({ env: e.target.value })} placeholder={'KEY=value\nKEY2=value2'} /></Field>
        </>
      );
    case 'storage':
      return (
        <>
          <Field label="Subtype">
            <select className="field-select" value={f.subtype} onChange={e => setF({ subtype: e.target.value })}>
              {['Storage Device', 'Storage Pool', 'Storage Directory', 'Storage Data'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <div className="field-row">
            <Field label="Total Capacity"><input className="field-input" value={f.capacity} onChange={e => setF({ capacity: e.target.value })} placeholder="8TB" /></Field>
            {f.subtype === 'Storage Pool' && (
              <Field label="RAID Level">
                <select className="field-select" value={f.raidLevel} onChange={e => setF({ raidLevel: e.target.value })}>
                  {['N/A', 'RAID0', 'RAID1', 'RAID5', 'RAID6', 'Z1', 'Z2'].map(v => <option key={v}>{v}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Mount Path"><input className="field-input" value={f.mountPath} onChange={e => setF({ mountPath: e.target.value })} placeholder="/mnt/pool0" /></Field>
          <div className="field-row">
            <Field label="R/W Target"><input className="field-input" value={f.readWrite} onChange={e => setF({ readWrite: e.target.value })} placeholder="450MB/s" /></Field>
            <Field label="Redundancy">
              <select className="field-select" value={f.redundancy} onChange={e => setF({ redundancy: e.target.value })}>
                <option>OK</option><option>Degraded</option><option>Rebuilding</option><option>Failed</option>
              </select>
            </Field>
          </div>
        </>
      );
    case 'storagepool':
      return (
        <>
          <div className="field-row">
            <Field label="Total Capacity"><input className="field-input" value={f.capacity} onChange={e => setF({ capacity: e.target.value })} placeholder="48TB" /></Field>
            <Field label="RAID Level">
              <select className="field-select" value={f.raidLevel} onChange={e => setF({ raidLevel: e.target.value })}>
                {['N/A', 'RAID0', 'RAID1', 'RAID5', 'RAID6', 'Z1', 'Z2'].map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Mount Path"><input className="field-input" value={f.mountPath} onChange={e => setF({ mountPath: e.target.value })} placeholder="/mnt/pool0" /></Field>
            <Field label="Filesystem"><input className="field-input" value={f.fsType} onChange={e => setF({ fsType: e.target.value })} placeholder="ZFS / btrfs / ext4" /></Field>
          </div>
        </>
      );
    case 'firewall':
      return (
        <>
          <Field label="Firewall OS / Platform">
            <select className="field-select" value={f.firewallOs} onChange={e => setF({ firewallOs: e.target.value })}>
              {['OPNsense', 'pfSense', 'iptables', 'nftables', 'Ubiquiti UDM', 'Other'].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          {f.firewallOs === 'Other' && (
            <Field label="Specify Firewall OS / Platform">
              <input className="field-input" value={f.firewallOsOther} onChange={e => setF({ firewallOsOther: e.target.value })} placeholder="Enter platform name" />
            </Field>
          )}
          <div className="field-row">
            <IpField label="WAN IP" value={f.wanIp} onChange={e => setF({ wanIp: e.target.value })} />
            <Field label="LAN CIDR"><input className="field-input mono" value={f.lanCidr} onChange={e => setF({ lanCidr: e.target.value })} placeholder="192.168.1.0/24" /></Field>
          </div>
          <Field label="Rules Summary"><textarea className="field-textarea" value={f.rulesSummary} onChange={e => setF({ rulesSummary: e.target.value })} placeholder={'Allow 443 -> reverse proxy\nBlock all inbound except VPN'} /></Field>
        </>
      );
    case 'internet':
      return (
        <>
          <Field label="ISP"><input className="field-input" value={f.isp} onChange={e => setF({ isp: e.target.value })} placeholder="Comcast, AT&T, …" /></Field>
          <div className="field-row">
            <IpField label="Public IP" value={f.publicIp} onChange={e => setF({ publicIp: e.target.value })} />
            <Field label="WAN Speed"><input className="field-input" value={f.wanSpeed} onChange={e => setF({ wanSpeed: e.target.value })} placeholder="1000/50 Mbps" /></Field>
          </div>
        </>
      );
    case 'directory':
      return (
        <>
          <Field label="Subtype">
            <select className="field-select" value={f.subtype} onChange={e => setF({ subtype: e.target.value })}>
              <option>Local Directory</option><option>Symlinked Directory</option>
            </select>
          </Field>
          {f.subtype === 'Symlinked Directory' && (
            <Field label="Symlink Target"><input className="field-input" value={f.symlinkTarget} onChange={e => setF({ symlinkTarget: e.target.value })} /></Field>
          )}
          <div className="field-checkbox-row">
            <input type="checkbox" checked={f.isBackupJob} onChange={e => setF({ isBackupJob: e.target.checked })} />
            <span>Backup Job</span>
          </div>
          {f.isBackupJob && (
            <Field label="Target Storage Pool"><input className="field-input" value={f.backupTarget} onChange={e => setF({ backupTarget: e.target.value })} /></Field>
          )}
        </>
      );
    case 'application':
      return (
        <>
          <div className="field-row">
            <Field label="Image / Tag"><input className="field-input" value={f.image} onChange={e => setF({ image: e.target.value })} placeholder="lscr.io/linuxserver/app:latest" /></Field>
            <Field label="Port(s)"><input className="field-input" value={f.port} onChange={e => setF({ port: e.target.value })} placeholder="8080:80" /></Field>
          </div>
          <IpField label="External URL" value={f.externalUrl} onChange={e => setF({ externalUrl: e.target.value })} placeholder="https://app.example.com" />
          <Field label="Status">
            <select className="field-select" value={f.status} onChange={e => setF({ status: e.target.value })}>
              <option>Active</option><option>Offline</option><option>Updating</option>
            </select>
          </Field>
          <Field label="Uptime Monitor URL"><input className="field-input" value={f.monitorUrl} onChange={e => setF({ monitorUrl: e.target.value })} /></Field>
          <Field label="Labels / Tags"><input className="field-input" value={f.tags} onChange={e => setF({ tags: e.target.value })} placeholder="media, arr-stack" /></Field>
          <Field label="Documentation URL"><input className="field-input" value={f.docsUrl} onChange={e => setF({ docsUrl: e.target.value })} /></Field>
        </>
      );
    default:
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.keys(f).length === 0 && <div className="rail-empty">No custom attributes defined for this type.</div>}
          {Object.entries(f).map(([k, v]) => (
            <Field label={k} key={k}><input className="field-input" value={v} onChange={e => setF({ [k]: e.target.value })} /></Field>
          ))}
        </div>
      );
  }
}

function TelemetryPanel({ node, set }) {
  const [polling, setPolling] = useState(false);
  const t = node.telemetry;

  const runCheck = async () => {
    setPolling(true);
    const endpoint = t.endpoint;
    let status = 'offline', cpu = null, ram = null, disk = null, latency = null;
    const start = performance.now();
    if (endpoint) {
      try {
        await fetch(endpoint, { mode: 'no-cors', signal: AbortSignal.timeout(2500) });
        status = 'online';
        latency = Math.round(performance.now() - start);
      } catch {
        // Sandbox/CORS or unreachable local IP: fall back to simulated stub reading,
        // matching Section 6.7's "Simulator/Stubs" allowance for the ping agent.
        status = Math.random() > 0.15 ? 'online' : 'offline';
        latency = status === 'online' ? Math.round(4 + Math.random() * 40) : null;
      }
      cpu = status === 'online' ? Math.round(10 + Math.random() * 85) : null;
      ram = status === 'online' ? Math.round(15 + Math.random() * 80) : null;
      disk = status === 'online' ? Math.round(20 + Math.random() * 70) : null;
    }
    set({ telemetry: { ...t, status, cpu, ram, disk, latency, lastCheck: new Date().toISOString() } });
    setPolling(false);
  };

  return (
    <>
      <Field label="Telemetry Endpoint (Prometheus / Netdata / Glances / API URI)">
        <input className="field-input" value={t.endpoint} onChange={e => {
          const endpoint = e.target.value;
          set({ telemetry: endpoint ? { ...t, endpoint } : { ...t, endpoint, status: 'unknown', cpu: null, ram: null, disk: null, latency: null, lastCheck: null } });
        }} placeholder="http://192.168.1.20:9100/metrics" />
      </Field>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn small" onClick={runCheck} disabled={!t.endpoint || polling}>{polling ? 'Checking…' : 'Run Ping / Poll'}</button>
        {t.lastCheck && <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>last: {new Date(t.lastCheck).toLocaleTimeString()}</span>}
      </div>
    </>
  );
}
