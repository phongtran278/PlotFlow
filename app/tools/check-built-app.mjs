import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(appRoot, 'dist');
const indexPath = join(dist, 'index.html');
const assetsDir = join(dist, 'assets');

assert.ok(existsSync(indexPath), 'Missing built index.html');
assert.ok(existsSync(assetsDir), 'Missing built assets directory');

const index = readFileSync(indexPath, 'utf8');
const assets = readdirSync(assetsDir);
const js = assets.filter((filename) => filename.endsWith('.js'));
const css = assets.filter((filename) => filename.endsWith('.css'));

assert.ok(js.length, 'Missing bundled JavaScript');
assert.ok(css.length, 'Missing bundled CSS');
assert.match(index, /assets\//, 'App shell does not reference built assets');

const scripts = js.map((filename) => readFileSync(join(assetsDir, filename), 'utf8'));
assert.ok(scripts.some((source) => source.includes('vinhomes-saigon-park')),
  'Vinhomes Saigon Park project route is missing from build');

console.info(`PlotFlow build smoke: index.html, ${js.length} JS, ${css.length} CSS, project route present`);
