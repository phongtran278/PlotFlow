import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
  'tools/ensure-staging-media-optimizer.mjs',
  'tools/build-private-state-staging.mjs',
  'tools/prepare-cloudflare-staging.mjs',
  'tools/optimize-built-media.mjs',
  'tools/audit-runtime-assets.mjs',
];

for (const relative of scripts) {
  test(`staging build script parses: ${relative}`, () => {
    const absolute = path.join(appRoot, relative);
    const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout || `node --check failed for ${relative}`);
  });
}
