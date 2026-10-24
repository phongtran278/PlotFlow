import { verifyAccessJwt, projectRole, AccessConfigError } from './auth.js';
import { readState, writeState } from './azure.js';
import { testPage } from './test-page.js';

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const deny = (status, code) => json({ error: code }, status);
const MAX_STATE_BYTES = 256 * 1024;

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}
function validateState(input, projectId) {
  return input && typeof input === 'object' && !Array.isArray(input)
    && input.version === 1 && input.projectId === projectId && input.storage
    && typeof input.storage === 'object' && !Array.isArray(input.storage)
    && Object.values(input.storage).every(v => typeof v === 'string');
}

export function createApp({ authenticate = verifyAccessJwt, read = readState, write = writeState } = {}) {
  return async function handle(request, env) {
    const origin = request.headers.get('Origin');
    const permitted = allowedOrigin(request, env);
    if (origin && !permitted) return deny(403, 'origin_not_allowed');
    const cors = permitted ? { 'access-control-allow-origin': permitted, 'vary': 'Origin' } : {};
    const reply = (data, status = 200, headers = {}) => json(data, status, { ...cors, ...headers });
    if (request.method === 'OPTIONS') {
      if (!permitted) return deny(403, 'origin_not_allowed');
      return new Response(null, {
        status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, PUT, OPTIONS',
          'access-control-allow-headers': 'content-type, if-match', 'access-control-max-age': '600' },
      });
    }
    const path = new URL(request.url).pathname;
    if (path === '/test' && request.method === 'GET') return new Response(testPage, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" } });
    if (path === '/diagnostics' && request.method === 'GET') {
      const team = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/\/$/, '');
      const aud = String(env.ACCESS_AUD || '').trim();
      return reply({
        accessTeamConfigured: team.startsWith('https://') && team.endsWith('.cloudflareaccess.com') && !team.includes(' '),
        accessAudienceConfigured: aud.length > 0,
        projectPermissionsConfigured: Boolean(env.PROJECT_ACL_JSON),
        stagingStorageConfigured: Boolean(env.AZURE_BLOB_URLS_JSON),
      });
    }
    if (path === '/health' && request.method === 'GET') return reply({ ok: true, service: 'plotflow-state-api' });
    const match = /^\/v1\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)\/state$/.exec(path);
    if (!match) return reply({ error: 'not_found' }, 404);
    if (!['GET', 'PUT'].includes(request.method)) return reply({ error: 'method_not_allowed' }, 405, { allow: 'GET, PUT' });
    let identity;
    try { identity = await authenticate(request, env); }
    catch (error) { return reply({ error: error instanceof AccessConfigError ? 'access_config_invalid' : 'authentication_unavailable' }, 503); }
    if (!identity) return reply({ error: 'unauthorized' }, 401);
    let role;
    try { role = projectRole(env, match[1], identity); }
    catch { return reply({ error: 'authorization_unavailable' }, 503); }
    if (!role || (request.method === 'PUT' && role === 'viewer')) return reply({ error: 'forbidden' }, 403);
    try {
      if (request.method === 'GET') {
        const result = await read(env, match[1]);
        if (result.status !== 200) return reply({ error: 'storage_unavailable' }, 502);
        if (!validateState(result.state, match[1]) || !result.etag) return reply({ error: 'invalid_storage_state' }, 502);
        return reply(result.state, 200, { etag: result.etag });
      }
      const etag = request.headers.get('If-Match');
      if (!etag || etag === '*' || !/^"[^"\r\n]+"$/.test(etag)) return reply({ error: 'etag_required' }, 428);
      if (Number(request.headers.get('content-length') || 0) > MAX_STATE_BYTES) return reply({ error: 'too_large' }, 413);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_STATE_BYTES) return reply({ error: 'too_large' }, 413);
      let payload;
      try { payload = JSON.parse(raw); }
      catch { return reply({ error: 'invalid_json' }, 400); }
      if (!validateState(payload, match[1])) return reply({ error: 'invalid_state' }, 400);
      const result = await write(env, match[1], payload, etag);
      if (result.status === 412) return reply({ error: 'version_conflict', message: 'Reload state before retrying.' }, 412);
      if (![200, 201].includes(result.status)) return reply({ error: 'storage_unavailable' }, 502);
      return reply({ saved: true }, 200, result.etag ? { etag: result.etag } : {});
    } catch {
      return reply({ error: 'storage_unavailable' }, 502);
    }
  };
}

export default { fetch: createApp() };
