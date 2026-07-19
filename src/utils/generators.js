function slug(s) {
  return (s || 'service').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'service';
}

export function generateDockerCompose(hostNode, children) {
  const apps = children.filter(c => c.type === 'application');
  if (apps.length === 0) return 'services: {}\n# No Application nodes nested under this Docker Host yet.';
  let out = `version: "3.9"\n\nservices:\n`;
  apps.forEach(app => {
    const name = slug(app.name);
    out += `  ${name}:\n`;
    out += `    image: ${app.fields.image || 'REPLACE_IMAGE'}\n`;
    if (app.fields.port) {
      out += `    ports:\n`;
      app.fields.port.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
        out += `      - "${p}"\n`;
      });
    }
    out += `    restart: unless-stopped\n`;
    out += `    network_mode: ${hostNode.fields.networkMode || 'bridge'}\n`;
    if (app.fields.tags) {
      out += `    labels:\n`;
      app.fields.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
        out += `      - "hexlab.tag=${t}"\n`;
      });
    }
    if (hostNode.fields.env) {
      out += `    environment:\n`;
      hostNode.fields.env.split('\n').map(e => e.trim()).filter(Boolean).forEach(e => {
        out += `      - ${e}\n`;
      });
    }
  });
  return out;
}

export function generateK8sManifests(hostNode, children) {
  const apps = children.filter(c => c.type === 'application');
  if (apps.length === 0) return '# No Application nodes nested under this Kubernetes Host yet.';
  const ns = hostNode.fields.namespace || 'default';
  let out = '';
  apps.forEach(app => {
    const name = slug(app.name);
    const port = (app.fields.port || '80:80').split(':').pop();
    out += `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  namespace: ${ns}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n        - name: ${name}\n          image: ${app.fields.image || 'REPLACE_IMAGE'}\n          ports:\n            - containerPort: ${port}\n          resources:\n            limits:\n              cpu: "${hostNode.fields.cpuLimit || '500m'}"\n              memory: "${hostNode.fields.memLimit || '512Mi'}"\n---\n`;
    out += `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${name}-svc\n  namespace: ${ns}\nspec:\n  selector:\n    app: ${name}\n  ports:\n    - port: ${port}\n      targetPort: ${port}\n---\n`;
  });
  return out.trim();
}

export function generateNginx(node) {
  const domain = node.fields.docsUrl ? node.fields.docsUrl.replace(/^https?:\/\//, '').split('/')[0] : `${slug(node.name)}.local`;
  const port = (node.fields.port || '80').split(':').pop();
  return `server {\n    listen 80;\n    server_name ${domain};\n\n    location / {\n        proxy_pass http://127.0.0.1:${port};\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}`;
}

export function generateTraefik(node) {
  const name = slug(node.name);
  const domain = `${name}.local`;
  const port = (node.fields.port || '80').split(':').pop();
  return `# docker-compose labels\nlabels:\n  - "traefik.enable=true"\n  - "traefik.http.routers.${name}.rule=Host(\`${domain}\`)"\n  - "traefik.http.routers.${name}.entrypoints=websecure"\n  - "traefik.http.routers.${name}.tls=true"\n  - "traefik.http.services.${name}.loadbalancer.server.port=${port}"`;
}

export function generateDnsRewrite(node) {
  const name = slug(node.name);
  const ip = node.fields.ip || node.fields.gateway || '192.168.1.100';
  return `# Pi-hole / AdGuard Home local DNS rewrite\n${ip} ${name}.local\n${ip} ${name}.home.arpa`;
}
