import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { loadEnv } from 'vite';

const expected = 'https://plotflow-state-api-staging.phongtran7076.workers.dev';
const project = 'vinhomes-saigon-park';
const env = loadEnv('production', process.cwd(), 'VITE_');
if (env.VITE_PROJECT_STATE_URL) throw new Error('Remove legacy VITE_PROJECT_STATE_URL from staging build configuration');
if (env.VITE_STATE_API_BASE_URL && env.VITE_STATE_API_BASE_URL !== expected) throw new Error('Unexpected staging State API origin');
if (env.VITE_CLOUD_PROJECT_ID && env.VITE_CLOUD_PROJECT_ID !== project) throw new Error('Unexpected staging project');
const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_PROJECT_STATE_URL: '', VITE_STATE_API_BASE_URL: expected,
    VITE_CLOUD_PROJECT_ID: project, VITE_PLOTFLOW_PRIVATE_STAGING: '1' },
});
if (result.error || result.status !== 0) throw new Error('Staging build failed');
let endpointFound = false;
let count = 0;
function scan(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, item.name);
    if (item.isDirectory()) { scan(file); continue; }
    if (!item.isFile() || !['.js','.mjs','.html','.css','.json','.map'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    count++;
    if (text.includes(expected)) endpointFound = true;
    if (/AccountKey\s*=\s*[A-Za-z0-9+/=]{24,}/i.test(text) || /[?&](?:amp;)?sig=[A-Za-z0-9%+/]{16,}/i.test(text) || /blob\.core\.windows\.net[^\s"'<>]{0,800}\/state\.json\?/i.test(text)) {
      throw new Error('Potential Azure credential in built output (value suppressed): ' + item.name);
    }
  }
}
scan(resolve('dist'));
if (!endpointFound) throw new Error('Expected staging API origin missing from build');
console.log('[private-state-staging] PASS: expected API endpoint present; scanned ' + count + ' text assets for Azure credential patterns.');
