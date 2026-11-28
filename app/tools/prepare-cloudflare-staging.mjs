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
// All staging builds, including Workers Previews without API variables, must preserve assets.
{
  const result = spawnSync(process.execPath, ['tools/optimize-built-media.mjs'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Media optimization failed; refusing to publish incomplete output');
}
let scanned = 0;
const omitted = [];

function visit(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, item.name);

    if (item.isDirectory()) {
      visit(absolute);
      continue;
    }

    if (!item.isFile()) continue;

    scanned++;

    const size = fs.statSync(absolute).size;
    const relative = path.relative(root, absolute).split(path.sep).join('/');

    if (size <= MAX_BYTES) continue;

    // The canonical Masterplan PDF is retained in Git LFS.
    // Bundled runtime opens this source through the prepared raster manifest.
    if (relative === 'masterplan/masterplan.pdf') {
      fs.unlinkSync(absolute);
      omitted.push({
        path: relative,
        sizeBytes: size,
        reason: 'canonical-masterplan-served-through-prepared-raster-runtime',
      });
      console.log('[staging-assets] Omitted canonical Masterplan PDF:', relative);
      continue;
    }

    throw new Error('Built asset exceeds Cloudflare 25 MiB limit: ' + relative);
  }
}

visit(root);

console.log('[staging-assets] Scanned', scanned, 'built files.');
console.log('[staging-assets] Omitted oversized assets:', omitted.length);

fs.writeFileSync(
  path.join(root, 'staging-omitted-assets.json'),
  JSON.stringify({ omitted }, null, 2)
);
{
  const result = spawnSync(process.execPath, ['tools/audit-runtime-assets.mjs', '--strict'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Asset audit failed; refusing to publish incomplete output');
}
