// Lightweight line-based parser for docker-compose service snippets or basic
// K8s pod-container blocks. Not a full YAML parser (no external deps per the
// greenfield/from-scratch requirement) — it targets the common fields the
// spec calls out: image, ports, volumes, environment variables.

export function parseCompose(text) {
  if (!text || !text.trim()) return null;
  const lines = text.split('\n').map(l => l.replace(/\t/g, '  '));

  let image = '';
  const ports = [];
  const volumes = [];
  let envCount = 0;
  const env = {};

  let section = null; // 'ports' | 'volumes' | 'environment'

  for (let raw of lines) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const trimmed = line.trim();

    const imgMatch = trimmed.match(/^image:\s*["']?([^"'\s]+)["']?/);
    if (imgMatch) { image = imgMatch[1]; section = null; continue; }

    if (/^ports:\s*$/.test(trimmed)) { section = 'ports'; continue; }
    if (/^volumes:\s*$/.test(trimmed)) { section = 'volumes'; continue; }
    if (/^(environment|env):\s*$/.test(trimmed)) { section = 'environment'; continue; }
    if (/^[a-zA-Z_]+:\s*$/.test(trimmed)) { section = null; continue; }

    if (trimmed.startsWith('- ')) {
      const val = trimmed.slice(2).replace(/^["']|["']$/g, '');
      if (section === 'ports') {
        ports.push(val);
      } else if (section === 'volumes') {
        volumes.push(val);
      } else if (section === 'environment') {
        const eq = val.split('=');
        if (eq.length >= 2) { env[eq[0]] = eq.slice(1).join('='); envCount++; }
        else envCount++;
      }
      continue;
    }

    // inline single-line forms: "ports: [\"80:80\"]" or "image: x"
    const inlinePorts = trimmed.match(/^ports:\s*\[(.*)\]/);
    if (inlinePorts) {
      inlinePorts[1].split(',').forEach(p => ports.push(p.trim().replace(/^["']|["']$/g, '')));
    }
  }

  return { image, ports, volumes, envCount, env };
}
