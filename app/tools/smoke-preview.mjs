import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:4179';
const viteCli = join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [
  viteCli, 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort',
], { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';
server.stdout.on('data', (data) => { output += data.toString(); });
server.stderr.on('data', (data) => { output += data.toString(); });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Preview exited early: ${output}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(600) });
      if (response.ok) return;
    } catch {
      // Wait for Vite to bind its listening port.
    }
    await sleep(200);
  }
  throw new Error(`Preview did not start: ${output}`);
}

try {
  await waitForServer();
  const routes = [
    '/',
    '/pricing',
    '/projects',
    '/projects/vinhomes-saigon-park',
    '/projects/vinhomes-saigon-park/overview',
    '/projects/vinhomes-saigon-park/detail',
  ];
  for (const path of routes) {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, `Preview route failed: ${path}`);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text();
    assert.match(html, /id="root"/, `App shell missing on ${path}`);
    assert.match(html, /assets\//, `Built JS assets missing on ${path}`);
  }
  console.info(`Vite preview: ${routes.length} SPA URLs returned the built app shell`);
} finally {
  server.kill('SIGTERM');
}
