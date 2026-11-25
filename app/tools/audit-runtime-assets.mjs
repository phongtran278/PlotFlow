import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const projectRoot = path.resolve(appRoot, '..');
const distRoot = path.join(appRoot, 'dist');
const sourceRoot = path.join(projectRoot, 'assets');
const MAX_WORKERS_BYTES = 25 * 1024 * 1024;
const imagePattern = /\.(png|jpe?g|webp|gif|avif|tiff?)$/i;
const trackedFolders = ['houses', 'amenities'];
const entries = [];
const errors = [];

function walk(folder, relative = '') {
  if (!fs.existsSync(folder)) return;
  for (const dirent of fs.readdirSync(folder, { withFileTypes: true })) {
    const name = path.posix.join(relative, dirent.name);
    const absolute = path.join(folder, dirent.name);
    if (dirent.isDirectory()) walk(absolute, name);
    else if (dirent.isFile() && imagePattern.test(dirent.name)) {
      const inputBytes = fs.statSync(absolute).size;
      const deployedPath = path.join(distRoot, 'assets', name);
      const deployed = fs.existsSync(deployedPath);
      const deployedBytes = deployed ? fs.statSync(deployedPath).size : null;
      entries.push({ path: name, inputBytes, deployedBytes, deployed, exceedsWorkersLimit: deployed && deployedBytes > MAX_WORKERS_BYTES });
    }
  }
}
for (const folder of trackedFolders) walk(path.join(sourceRoot, folder), folder);

const missing = entries.filter((entry) => !entry.deployed);
const tooLarge = entries.filter((entry) => entry.exceedsWorkersLimit);
if (missing.length) errors.push(`${missing.length} image(s) present in source but missing from build output`);
if (tooLarge.length) errors.push(`${tooLarge.length} built image(s) exceed Cloudflare Workers 25 MiB asset limit`);

const report = {
  generatedAt: new Date().toISOString(),
  scope: trackedFolders,
  total: entries.length,
  missingCount: missing.length,
  oversizeCount: tooLarge.length,
  entries,
  problems: errors,
};
const destination = process.env.PLOTFLOW_ASSET_AUDIT_REPORT || path.join(appRoot, 'asset-audit-report.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(`[asset-audit] Source images: ${entries.length}, missing in dist: ${missing.length}, over 25 MiB in dist: ${tooLarge.length}`);
for (const problem of errors) console.error('[asset-audit] ' + problem);
for (const item of [...missing, ...tooLarge]) console.error(`[asset-audit] ${item.path}: ${item.deployed ? 'oversize' : 'missing'}`);
console.log('[asset-audit] Full report: ' + destination);
if (process.argv.includes('--strict') && errors.length) process.exitCode = 1;
