import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const hasStagingWrangler = fs.existsSync(path.resolve('wrangler.jsonc'));
const isStaging = Boolean(process.env.VITE_STATE_API_BASE_URL)
  || process.env.PLOTFLOW_PRIVATE_STAGING === '1'
  || hasStagingWrangler;
if (!isStaging) {
  console.log('[staging-assets] Skipped: no staging Wrangler config or State API build env.');
  process.exit(0);
}

const root = path.resolve('dist');
const MAX_BYTES = 25 * 1024 * 1024;
if (!fs.existsSync(root)) throw new Error('Missing dist directory; cannot validate Cloudflare assets.');

// Optimize only the generated deployment copy. The source assets/ tree and LFS
// originals are never modified. Keep original file names/extensions so runtime
// catalog URLs remain stable.
console.log('[staging-assets] Optimizing oversized house/amenity images in dist only.');
const optimizer = spawnSync(process.execPath, [path.resolve('tools/optimize-built-media.mjs')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLOTFLOW_MEDIA_MAX_WIDTH: process.env.PLOTFLOW_MEDIA_MAX_WIDTH || '3200',
    PLOTFLOW_MEDIA_TARGET_MIB: process.env.PLOTFLOW_MEDIA_TARGET_MIB || '8',
  },
});
if (optimizer.error || optimizer.status !== 0) {
  throw new Error('Staging media optimization failed. No oversized files were silently removed.');
}

// Verify that every source house/amenity image still has a same-path deployment
// copy and that no tracked image exceeds Cloudflare's 25 MiB limit.
const audit = spawnSync(process.execPath, [path.resolve('tools/audit-runtime-assets.mjs'), '--strict'], {
  stdio: 'inherit',
  env: process.env,
});
if (audit.error || audit.status !== 0) {
  throw new Error('Staging runtime asset audit failed. No assets were silently omitted.');
}

const oversized = [];
let scanned = 0;
function visit(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) {
      visit(absolute);
      continue;
    }
    if (!item.isFile()) continue;
    scanned += 1;
    const size = fs.statSync(absolute).size;
    if (size > MAX_BYTES) {
      oversized.push({
        path: path.relative(root, absolute).split(path.sep).join('/'),
        sizeMiB: Number((size / 1048576).toFixed(2)),
      });
    }
  }
}
visit(root);
if (oversized.length) {
  for (const item of oversized) {
    console.error('[staging-assets] OVER LIMIT:', item.path, item.sizeMiB + ' MiB');
  }
  throw new Error(oversized.length + ' asset(s) still exceed Cloudflare 25 MiB limit. Deployment blocked; originals preserved.');
}

const report = {
  optimizedInDistOnly: true,
  sourceAssetsModified: false,
  scannedFiles: scanned,
  omittedAssets: [],
  maxAssetBytes: MAX_BYTES,
  status: 'pass',
};
fs.writeFileSync(path.join(root, 'staging-omitted-assets.json'), JSON.stringify(report, null, 2));
console.log('[staging-assets] PASS: optimized deployment copies, preserved all source image paths, and verified', scanned, 'files under 25 MiB.');
