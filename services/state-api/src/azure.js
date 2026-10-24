export function getBlobUrl(env, projectId) {
  // Private server-side map. The URLs must be narrow-scoped SAS URLs per staging blob.
  const mapping = JSON.parse(env.AZURE_BLOB_URLS_JSON || '{}');
  const value = mapping[projectId];
  if (typeof value !== 'string') throw new Error('No Azure blob configured for project');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.core.windows.net')
      || !url.searchParams.has('sig')) throw new Error('Invalid Azure blob URL');
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
