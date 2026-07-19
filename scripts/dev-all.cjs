// Runs the Vite dev server and the storage server (server/index.cjs) side by
// side, so `npm run dev` can't accidentally leave the storage server off —
// which previously caused every /api/* request to fail with a 502 Bad
// Gateway (Vite's proxy had nothing listening on :4173 to forward to).
//
// Dependency-free on purpose, matching server/index.cjs — no `concurrently`
// or similar package required.
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function run(name, command, args) {
  const proc = spawn(command, args, { cwd: root, stdio: 'pipe', shell: true });
  proc.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  proc.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    // If either process dies, bring the whole thing down rather than
    // silently running half a stack (frontend up, storage down, or vice versa).
    shutdown();
  });
  return proc;
}

const procs = [
  run('server', 'node', ['server/index.cjs']),
  run('vite', 'npx', ['vite']),
];

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  procs.forEach((p) => p.kill());
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
