import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Cloudflare Preview builds have no State API env vars by design.
// The staging UI still needs the 25 MiB asset guard when its Wrangler config is present.
// The Azure production branch has no Wrangler config and is unaffected.
const hasStagingWrangler = fs.existsSync(path.resolve('wrangler.jsonc'));
const isStaging = Boolean(process.env.VITE_STATE_API_BASE_URL) || hasStagingWrangler;
if (!isStaging) {
  console.log('[staging-assets] Skipped: no staging Wrangler config or State API build env.');
  process.exit(0);
}

const root = path.resolve('dist');
const MAX_BYTES = 25 * 1024 * 1024;
const strictMedia = process.env.PLOTFLOW_MEDIA_OPTIMIZE === '1';
if (strictMedia) {
  const result = spawnSync(process.execPath, ['tools/optimize-built-media.mjs'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Media optimization failed; refusing to publish incomplete output');
}
const removed = [];
let scanned = 0;

function visit(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, item.name);
    if (item.isDirectory()) { visit(absolute); continue; }
    if (!item.isFile()) continue;
    scanned++;
    const size = fs.statSync(absolute).size;
    if (size <= MAX_BYTES) continue;
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (/\.(html|js|mjs|css)$/i.test(relative)) {
      throw new Error('Critical application asset exceeds Cloudflare 25 MiB limit: ' + relative);
    }
    if (strictMedia) throw new Error('Built asset exceeds Cloudflare 25 MiB limit: ' + relative);
    fs.unlinkSync(absolute);
    removed.push({ path: relative, sizeMiB: Number((size / 1048576).toFixed(2)) });
  }
}
visit(root);
console.log('[staging-assets] Scanned', scanned, 'built files.');
console.log('[staging-assets] Omitted oversized media files:', removed.length);
for (const { path: file, sizeMiB } of removed) console.log('[staging-assets] omitted:', file, '(' + sizeMiB + ' MiB)');
fs.writeFileSync(path.join(root, 'staging-omitted-assets.json'), JSON.stringify({ omitted: removed }, null, 2));
if (strictMedia) {
  const result = spawnSync(process.execPath, ['tools/audit-runtime-assets.mjs', '--strict'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Asset audit failed; refusing to publish incomplete output');
}
