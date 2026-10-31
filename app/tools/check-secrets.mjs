import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(appRoot, '..');
const roots = [join(appRoot, 'src'), join(appRoot, 'tools'), join(repositoryRoot, '.github', 'workflows')];
const extensions = new Set(['.js', '.jsx', '.mjs', '.json', '.yml', '.yaml', '.html', '.css']);
const patterns = [
  { name: 'Embedded Azure AccountKey', expression: /AccountKey\s*=\s*[a-zA-Z0-9+/=]{24,}/i },
  { name: 'Embedded SAS signature', expression: /[?&]sig=[a-zA-Z0-9%+/]{24,}/i },
];
const findings = [];
let scanned = 0;

function scan(path) {
  let status;
  try { status = statSync(path); } catch { return; }
  if (status.isDirectory()) {
    for (const entry of readdirSync(path)) scan(join(path, entry));
    return;
  }
  if (!status.isFile() || !extensions.has(extname(path)) || status.size > 1024 * 1024) return;
  scanned += 1;
  const content = readFileSync(path, 'utf8');
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) findings.push(`${path.replace(repositoryRoot, '')}: ${pattern.name}`);
  }
}

for (const root of roots) scan(root);
if (findings.length) {
  console.error('Potential hard-coded secrets (values intentionally not printed):');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.info(`Secret guard: ${scanned} text files checked (not a live credential/security audit)`);
}
