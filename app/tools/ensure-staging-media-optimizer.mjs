import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const staging = fs.existsSync(path.resolve('wrangler.jsonc'));
if (!staging) {
  console.log('[staging-media] Skipped: no staging Wrangler config.');
  process.exit(0);
}

if (fs.existsSync(path.resolve('node_modules/sharp/package.json'))) {
  console.log('[staging-media] sharp is already installed.');
  process.exit(0);
}

console.log('[staging-media] Installing pinned, build-only sharp@0.35.3 for output optimization.');
const result = spawnSync('npm', ['install', '--no-save', '--package-lock=false', 'sharp@0.35.3'], {
  stdio: 'inherit',
  env: process.env,
});
if (result.error || result.status !== 0) {
  throw new Error('Could not install the staging-only image optimizer. No media files were omitted.');
}
if (!fs.existsSync(path.resolve('node_modules/sharp/package.json'))) {
  throw new Error('sharp installation did not produce node_modules/sharp. No media files were omitted.');
}
console.log('[staging-media] PASS: pinned optimizer is available; source assets remain unchanged.');
