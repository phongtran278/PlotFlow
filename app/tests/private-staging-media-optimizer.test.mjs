import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../tools/optimize-built-media.mjs', import.meta.url));

test('staging media optimizer leaves every in-limit image byte-for-byte unchanged', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plotflow-media-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, 'app');
  const tools = path.join(app, 'tools');
  const imageDir = path.join(app, 'dist', 'assets', 'houses');
  fs.mkdirSync(tools, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });
  fs.copyFileSync(source, path.join(tools, 'optimize-built-media.mjs'));
  const image = path.join(imageDir, 'small.png');
  const original = Buffer.from('synthetic-image-fixture');
  fs.writeFileSync(image, original);

  const result = spawnSync(process.execPath, [path.join(tools, 'optimize-built-media.mjs')], {
    cwd: app,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readFileSync(image), original);
  const report = JSON.parse(fs.readFileSync(path.join(app, 'media-optimization-report.json'), 'utf8'));
  assert.equal(report.optimized, 0);
  assert.equal(report.unchanged, 1);
  assert.equal(report.entries[0].skippedReason, 'within-cloudflare-limit');
});
