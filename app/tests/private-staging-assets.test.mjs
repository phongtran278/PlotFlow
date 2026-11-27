import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceScript = fileURLToPath(new URL('../tools/prepare-cloudflare-staging.mjs', import.meta.url));

function fixture({ assetBytes = 16, optimizerExit = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plotflow-staging-assets-'));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist', 'assets', 'houses'), { recursive: true });
  fs.writeFileSync(path.join(root, 'wrangler.jsonc'), '{}');
  fs.copyFileSync(sourceScript, path.join(root, 'tools', 'prepare-cloudflare-staging.mjs'));
  fs.writeFileSync(path.join(root, 'tools', 'optimize-built-media.mjs'), `console.log('optimizer stub'); process.exit(${optimizerExit});`);
  fs.writeFileSync(path.join(root, 'tools', 'audit-runtime-assets.mjs'), "console.log('audit stub');");
  const asset = path.join(root, 'dist', 'assets', 'houses', 'fixture.png');
  fs.closeSync(fs.openSync(asset, 'w'));
  fs.truncateSync(asset, assetBytes);
  return { root, asset };
}

test('staging asset preparation keeps in-limit assets and writes an empty omission report', (t) => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [path.join(f.root, 'tools', 'prepare-cloudflare-staging.mjs')], { cwd: f.root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(f.asset), true);
  const report = JSON.parse(fs.readFileSync(path.join(f.root, 'dist', 'staging-omitted-assets.json'), 'utf8'));
  assert.deepEqual(report.omittedAssets, []);
  assert.equal(report.sourceAssetsModified, false);
  assert.match(result.stdout, /PASS: optimized deployment copies/);
});

test('staging asset preparation fails closed and preserves an oversized file', (t) => {
  const f = fixture({ assetBytes: 26 * 1024 * 1024 });
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [path.join(f.root, 'tools', 'prepare-cloudflare-staging.mjs')], { cwd: f.root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(f.asset), true);
  assert.match(result.stderr, /Deployment blocked; originals preserved/);
});

test('staging asset preparation stops when media optimization fails', (t) => {
  const f = fixture({ optimizerExit: 1 });
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [path.join(f.root, 'tools', 'prepare-cloudflare-staging.mjs')], { cwd: f.root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(f.asset), true);
  assert.match(result.stderr, /Staging media optimization failed/);
});
