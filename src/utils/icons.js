// Unified icon loader.
// Primary source: Homarr Labs "dashboard-icons" project served via jsDelivr CDN.
// Falls back to a raw.githubusercontent.com mirror, then to a local static
// glyph if both network lookups fail (e.g. offline usage).

// Primary source: raw.githubusercontent.com. jsDelivr's "/gh/" shorthand CDN
// (used to be primary here) enforces a hard 50MB total-repo-size cap, and
// dashboard-icons — 1800+ icons across svg/png/webp — has grown past that
// limit, so jsDelivr now fails EVERY request against this repo with
// "Package size exceeded the configured limit of 50 MB", not just missing
// icons. That made icon resolution fail wholesale. raw.githubusercontent.com
// has no such size cap, so it's the reliable primary; jsDelivr is kept as a
// secondary attempt only (e.g. if GitHub raw itself is rate-limited).
export const CDN_PRIMARY = (name) => `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/${name}.svg`;
export const CDN_FALLBACK = (name) => `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${name}.svg`;

// Full list of available icon slugs, lazily fetched once and cached in
// memory for the rest of the session — this is what powers the searchable
// icon picker (type a few letters, see real matching icons) instead of the
// old "guess the exact slug" text box. Uses the GitHub Git Trees API (the
// same source Homarr's own icon picker uses) rather than jsDelivr's package
// metadata API, since that data API sits behind the same 50MB repo-size
// cap described above and was failing to list anything for this repo.
let _allIconNamesPromise = null;
export function getAllIconNames() {
  if (_allIconNamesPromise) return _allIconNamesPromise;
  _allIconNamesPromise = fetch('https://api.github.com/repos/homarr-labs/dashboard-icons/git/trees/main?recursive=true')
    .then(r => r.json())
    .then(data => {
      const tree = data.tree || [];
      return tree
        .filter(f => f.type === 'blob' && f.path.startsWith('svg/') && f.path.endsWith('.svg'))
        .map(f => f.path.slice('svg/'.length, -'.svg'.length))
        .sort();
    })
    .catch(() => []);
  return _allIconNamesPromise;
}

// A short curated list shown immediately while the full catalog is still
// loading (getAllIconNames does one network round-trip) — otherwise the
// picker would look empty for a moment.
export const COMMON_ICON_NAMES = [
  'plex', 'jellyfin', 'sonarr', 'radarr', 'proxmox', 'traefik', 'nginx',
  'homeassistant', 'portainer', 'grafana', 'prometheus', 'pihole', 'adguard-home',
  'nextcloud', 'unifi', 'opnsense', 'pfsense', 'docker', 'kubernetes', 'truenas',
  'synology', 'qbittorrent', 'homarr', 'authelia', 'vaultwarden', 'gitea',
];

export async function searchIcons(query) {
  const q = query.trim().toLowerCase();
  const all = await getAllIconNames();
  const pool = all.length ? all : COMMON_ICON_NAMES;
  if (!q) return pool;
  return pool.filter(name => name.includes(q));
}

// Small in-memory cache so we don't refetch/re-probe the same icon repeatedly.
const resolutionCache = new Map();

/**
 * Resolve an icon name (e.g. "proxmox", "plex", "traefik") to a usable URL.
 * Returns a promise that resolves to { url, source } where source is
 * 'cdn' | 'fallback-cdn' | 'local'.
 */
export async function resolveIcon(name) {
  if (!name) return { url: null, source: 'none' };
  const key = name.toLowerCase().trim();
  if (resolutionCache.has(key)) return resolutionCache.get(key);

  const tryUrl = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

  let result;
  if (await tryUrl(CDN_PRIMARY(key))) {
    result = { url: CDN_PRIMARY(key), source: 'cdn' };
  } else if (await tryUrl(CDN_FALLBACK(key))) {
    result = { url: CDN_FALLBACK(key), source: 'fallback-cdn' };
  } else {
    result = { url: null, source: 'local' };
  }
  resolutionCache.set(key, result);
  return result;
}

// Static local fallback glyphs (inline SVG paths) keyed by node type,
// used when no dashboard-icon is set or resolvable.
export const LOCAL_TYPE_GLYPHS = {
  internet: 'M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10zM2 12h20M12 2c2.5 2.5 4 6 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6-4-10s1.5-7.5 4-10z',
  group: 'M3 7h18M3 12h18M3 17h18',
  network: 'M12 2v6M12 16v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2',
  firewall: 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z M9 11l2 2 4-4',
  device: 'M4 5h16v10H4zM2 19h20M9 19v-4h6v4',
  hypervisor: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  vm: 'M4 4h16v12H4zM8 20h8M12 16v4M8 8l3 2-3 2z',
  k8s: 'M12 2l8 4v12l-8 4-8-4V6zM12 2v20M4 6l8 4 8-4M4 16l8-4 8 4',
  docker: 'M3 13h3v3H3zM7 13h3v3H7zM11 13h3v3h-3zM7 9h3v3H7zM11 9h3v3h-3zM11 5h3v3h-3zM2 16c1 3 4 4 8 4 6 0 10-3 11-8H2z',
  storage: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01',
  storagepool: 'M4 4c0-1 3.6-2 8-2s8 1 8 2-3.6 2-8 2-8-1-8-2zM4 4v6c0 1 3.6 2 8 2s8-1 8-2V4M4 10v6c0 1 3.6 2 8 2s8-1 8-2v-6M4 16v4c0 1 3.6 2 8 2s8-1 8-2v-4',
  directory: 'M3 6h6l2 2h10v11H3z',
  application: 'M4 4h16v16H4zM4 9h16M8 4v5',
};

export function iconGlyphFor(type) {
  return LOCAL_TYPE_GLYPHS[type] || LOCAL_TYPE_GLYPHS.application;
}
