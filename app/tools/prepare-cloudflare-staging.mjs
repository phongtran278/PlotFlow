import fs from 'node:fs';
import path from 'node:path';

const isStaging = Boolean(process.env.VITE_STATE_API_BASE_URL);
if (!isStaging) {
  console.log('[staging-assets] Skipped: not a State API staging build.');
  process.exit(0);
}

const root = path.resolve('dist');
const MAX_BYTES = 25 * 1024 * 1024;
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
    fs.unlinkSync(absolute);
    removed.push({ path: relative, sizeMiB: Number((size / 1048576).toFixed(2)) });
  }
}
visit(root);
console.log('[staging-assets] Scanned', scanned, 'built files.');
console.log('[staging-assets] Omitted oversized media files:', removed.length);
for (const { path: file, sizeMiB } of removed) console.log('[staging-assets] omitted:', file, '(' + sizeMiB + ' MiB)');
fs.writeFileSync(path.join(root, 'staging-omitted-assets.json'), JSON.stringify({ omitted: removed }, null, 2));
