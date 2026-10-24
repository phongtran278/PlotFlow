import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/index.js';
import { projectRole } from '../src/auth.js';

const state = { version: 1, projectId: 'project-a', storage: { 'layout': '{}' } };
const env = {
  ALLOWED_ORIGINS: 'https://staging.example.org',
  PROJECT_ACL_JSON: JSON.stringify({
    'project-a': {
      'viewer@example.org': 'viewer',
      'editor@example.org': 'editor',
      'admin@example.org': 'admin',
    },
  }),
};
const url = 'https://api.example.net/v1/projects/project-a/state';
const user = (email) => async () => email ? { id: email, email } : null;
const handler = (email, overrides = {}) => createApp({
  authenticate: user(email),
  read: async () => ({ status: 200, etag: '"v1"', state }),
  write: async () => ({ status: 201, etag: '"v2"' }),
  ...overrides,
});
const request = (method, body, headers = {}) => new Request(url, {
  method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('unauthenticated and non-members cannot read project state', async () => {
  assert.equal((await handler(null)(request('GET'), env)).status, 401);
  assert.equal((await handler('stranger@example.org')(request('GET'), env)).status, 403);
});
test('viewer can read but cannot write', async () => {
  const app = handler('viewer@example.org');
  const response = await app(request('GET'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('etag'), '"v1"');
  assert.deepEqual(await response.json(), state);
  assert.equal((await app(request('PUT', state, { 'If-Match': '"v1"' }), env)).status, 403);
});
test('editor can write only with a concrete previous ETag', async () => {
  const app = handler('editor@example.org');
  assert.equal((await app(request('PUT', state), env)).status, 428);
  assert.equal((await app(request('PUT', state, { 'If-Match': '*' }), env)).status, 428);
  const result = await app(request('PUT', state, { 'If-Match': '"v1"' }), env);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('etag'), '"v2"');
});
test('stale version returns conflict, never retries blind overwrite', async () => {
  const app = handler('admin@example.org', { write: async () => ({ status: 412 }) });
  const result = await app(request('PUT', state, { 'If-Match': '"stale"' }), env);
  assert.equal(result.status, 412);
  assert.equal((await result.json()).error, 'version_conflict');
});
test('invalid project payload and oversized state are rejected', async () => {
  const app = handler('editor@example.org');
  assert.equal((await app(request('PUT', { ...state, projectId: 'project-b' }, { 'If-Match': '"v1"' }), env)).status, 400);
  const huge = { ...state, storage: { layout: 'x'.repeat(300_000) } };
  assert.equal((await app(request('PUT', huge, { 'If-Match': '"v1"' }), env)).status, 413);
});
test('unknown project, forbidden origins and missing routes are denied', async () => {
  const app = handler('admin@example.org');
  assert.equal((await app(new Request(url.replace('project-a','project-b')), env)).status, 403);
  assert.equal((await app(request('GET', undefined, { Origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await app(new Request('https://api.example.net/unknown'), env)).status, 404);
});
test('ACL is explicit per email and project', () => {
  assert.equal(projectRole(env, 'project-a', { email: 'editor@example.org' }), 'editor');
  assert.equal(projectRole(env, 'project-b', { email: 'editor@example.org' }), null);
});

test('missing Access verification settings give a specific non-secret diagnostic', async () => {
  const app = createApp({ authenticate: async (_request, variables) => {
    const { AccessConfigError } = await import('../src/auth.js');
    if (!variables.ACCESS_AUD) throw new AccessConfigError();
  } });
  const result = await app(request('GET'), env);
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error, 'access_config_invalid');
});

test('staging test page renders without exposing credentials', async () => {
  const response = await createApp()(new Request('https://api.example.net/test'), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /Thử chống ghi đè/);
  assert.doesNotMatch(html, /sig=|ACCESS_AUD|AZURE_BLOB_URLS_JSON.*=/);
});
