const decoder = new TextDecoder();

function decodeBase64Url(input) {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) throw new Error('Bad JWT encoding');
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function verifyAccessJwt(request, env, fetcher = fetch) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const team = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/\/$/, '');
  const audience = String(env.ACCESS_AUD || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team) || !audience) {
    throw new Error('Access issuer and audience are not configured');
  }
  const sections = token.split('.');
  if (sections.length !== 3) return null;
  try {
    const header = JSON.parse(decoder.decode(decodeBase64Url(sections[0])));
    const claims = JSON.parse(decoder.decode(decodeBase64Url(sections[1])));
    if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string') return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== team || claims.aud !== audience || typeof claims.exp !== 'number'
        || now >= claims.exp || (claims.nbf !== undefined && now < claims.nbf)
        || !claims.sub || typeof claims.email !== 'string') return null;
    const keyResponse = await fetcher(team + '/cdn-cgi/access/certs');
    if (!keyResponse.ok) throw new Error('Unable to retrieve Access verification keys');
    const keys = await keyResponse.json();
    const jwk = keys.keys?.find((item) => item.kid === header.kid && item.kty === 'RSA' && (!item.alg || item.alg === 'RS256') && item.use !== 'enc');
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signedData = new TextEncoder().encode(sections[0] + '.' + sections[1]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodeBase64Url(sections[2]), signedData);
    if (!valid) return null;
    return { id: claims.sub, email: claims.email.trim().toLowerCase() };
  } catch {
    return null;
  }
}

export function projectRole(env, projectId, identity) {
  if (!identity?.email) return null;
  let permissions;
  try {
    permissions = JSON.parse(env.PROJECT_ACL_JSON || '{}');
  } catch {
    throw new Error('Invalid PROJECT_ACL_JSON configuration');
  }
  // Per-project, per-account explicit allowlist; no implicit public or wildcard roles.
  const role = permissions?.[projectId]?.[identity.email];
  return ['viewer', 'editor', 'admin'].includes(role) ? role : null;
}
