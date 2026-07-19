// Confidentiality Mode — redacts fields that are sensitive to expose on a
// shared screen/screenshot (external hostnames/IPs, internal IPs, and
// generated Docker Compose / K8s manifest output) without deleting the
// underlying data. Purely a display-layer mask: toggling it back off
// reveals the real values again, nothing is mutated.

export const MASK = '•••• hidden ••••';

// Per node-type field keys that hold an internal (LAN-side) IP/CIDR/gateway.
export const INTERNAL_IP_FIELDS = {
  device: ['ip'],
  vm: ['ip'],
  network: ['cidr', 'gateway', 'dhcpStart', 'dhcpEnd'],
  k8s: ['podCidr', 'apiEndpoint'],
  firewall: ['lanCidr'],
};

// Per node-type field keys that hold an externally-facing hostname/IP/URL.
export const EXTERNAL_HOST_FIELDS = {
  internet: ['publicIp'],
  firewall: ['wanIp'],
  application: ['externalUrl', 'monitorUrl', 'docsUrl'],
};

export function isSensitiveField(type, key) {
  return (INTERNAL_IP_FIELDS[type] || []).includes(key) || (EXTERNAL_HOST_FIELDS[type] || []).includes(key);
}

// Returns the masked display value for a field when Confidentiality Mode is
// on and that field is sensitive; otherwise returns the value unchanged.
export function maskField(type, key, value, confidentialMode) {
  if (!confidentialMode || !value) return value;
  return isSensitiveField(type, key) ? MASK : value;
}
