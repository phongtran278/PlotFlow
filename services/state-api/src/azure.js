export function getBlobUrl(env, projectId) {
  // Never allow the public Azure Static Website container ($web) to back state.
  // Each project maps to one exact private blob URL held only in Worker secrets.
  const mapping = JSON.parse(env.AZURE_BLOB_URLS_JSON || '{}');
  const value = mapping[projectId];
  if (typeof value !== 'string') throw new Error('No Azure blob configured for project');

  const url = new URL(value);
  const expectedContainer = String(env.AZURE_STATE_CONTAINER_NAME || 'plotflow-state-private').trim();
  const segments = url.pathname.split('/').filter(Boolean);
  const container = segments[0] ? decodeURIComponent(segments[0]) : '';
  const permissions = url.searchParams.get('sp') || '';
  const expiry = Date.parse(url.searchParams.get('se') || '');
  const remainingMs = expiry - Date.now();

  if (url.protocol !== 'https:' || url.username || url.password
      || !/^[a-z0-9-]+\.blob\.core\.windows\.net$/i.test(url.hostname)
      || container !== expectedContainer || container === '$web'
      || segments.length < 2
      || !url.searchParams.has('sig')
      || url.searchParams.get('sr') !== 'b'
      || permissions !== 'rw'
      || url.searchParams.get('spr') !== 'https'
      || !Number.isFinite(expiry) || remainingMs <= 0 || remainingMs > 30 * 24 * 60 * 60 * 1000) {
    throw new Error('Invalid private Azure state blob URL');
  }
  return url.toString();
}

export async function readState(env, projectId, fetcher = fetch) {
  const response = await fetcher(getBlobUrl(env, projectId), {
    method: 'GET', headers: { 'x-ms-version': '2023-11-03' }, cache: 'no-store',
  });
  if (!response.ok) return { status: response.status };
  return {
    status: 200,
    etag: response.headers.get('etag'),
    state: await response.json(),
  };
}

export async function writeState(env, projectId, body, etag, fetcher = fetch) {
  const response = await fetcher(getBlobUrl(env, projectId), {
    method: 'PUT',
    headers: {
      'x-ms-version': '2023-11-03',
      'x-ms-blob-type': 'BlockBlob',
      'content-type': 'application/json; charset=utf-8',
      'If-Match': etag,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, etag: response.headers.get('etag') };
}
