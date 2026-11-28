import fs from 'node:fs';
import { createHash } from 'node:crypto';
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
    PLOTFLOW_MEDIA_ONLY_OVERSIZED: '1',
    PLOTFLOW_MEDIA_MAX_WIDTH: process.env.PLOTFLOW_MEDIA_MAX_WIDTH || '3200',
    PLOTFLOW_MEDIA_TARGET_MIB: process.env.PLOTFLOW_MEDIA_TARGET_MIB || '20',
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
const omitted = [];
const canonicalSha = '1a7f0462b384321487c8eaafc45e66853e797a4a5bb3198f633cb8d4d5ee1dfa';
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
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (relative === 'masterplan/masterplan.pdf') {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'masterplan/generated/manifest.json'), 'utf8'));
        const source = manifest.nativeCoordinateSource;
        const pyramid = manifest.pages?.['1']?.tiles;
        const digest = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
        if (source?.pdfSha256 !== canonicalSha || source.renderer !== 'pymupdf' ||
            source.coordinateMode !== 'native-pdf-points' || digest !== canonicalSha ||
            pyramid?.sourceWidth !== 42000 || pyramid?.sourceHeight !== 29709) {
          throw new Error('Canonical PDF omission rejected: source or prepared raster mismatch');
        }
        fs.unlinkSync(absolute);
        omitted.push({ path: relative, sizeBytes: size, reason: 'canonical-masterplan-served-through-prepared-raster-runtime' });
        continue;
      }
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
  omitted,
  omittedAssets: omitted,
  maxAssetBytes: MAX_BYTES,
  status: 'pass',
};
fs.writeFileSync(path.join(root, 'staging-omitted-assets.json'), JSON.stringify(report, null, 2));
console.log('[staging-assets] PASS: optimized deployment copies, preserved all source image paths, and verified', scanned, 'files under 25 MiB.');
