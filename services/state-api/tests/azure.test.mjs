import test from 'node:test';
import assert from 'node:assert/strict';
import { getBlobUrl } from '../src/azure.js';

const env = (url) => ({
  AZURE_STATE_CONTAINER_NAME: 'plotflow-state-private',
  AZURE_BLOB_URLS_JSON: JSON.stringify({ 'project-a': url }),
});
const day = 24 * 60 * 60 * 1000;
const expiry = (days) => new Date(Date.now() + days * day).toISOString();
const valid = 'https://account.blob.core.windows.net/plotflow-state-private/project-a/state.json?' +
  new URLSearchParams({sp:'rw',sr:'b',spr:'https',se:expiry(7),sig:'redacted'});
function withExpiry(days) {
  const url = new URL(valid);
  if (days === null) url.searchParams.delete('se');
  else url.searchParams.set('se', expiry(days));
  return url.toString();
}

test('accepts a blob-scoped HTTPS SAS in the configured private container', () => {
  assert.equal(getBlobUrl(env(valid), 'project-a'), valid);
});

test('rejects public static website container even when SAS looks valid', () => {
  const publicUrl = valid.replace('/plotflow-state-private/', '/%24web/');
  assert.throws(() => getBlobUrl(env(publicUrl), 'project-a'), /Invalid private Azure state blob URL/);
});

test('rejects container-level or non-HTTPS SAS permissions', () => {
  assert.throws(() => getBlobUrl(env(valid.replace('sr=b', 'sr=c')), 'project-a'), /Invalid private Azure state blob URL/);
  assert.throws(() => getBlobUrl(env(valid.replace('spr=https', 'spr=https,http')), 'project-a'), /Invalid private Azure state blob URL/);
});

test('rejects read-only and broader permissions', () => {
  assert.throws(() => getBlobUrl(env(valid.replace('sp=rw', 'sp=r')), 'project-a'), /Invalid private Azure state blob URL/);
  assert.throws(() => getBlobUrl(env(valid.replace('sp=rw', 'sp=rwdlac')), 'project-a'), /Invalid private Azure state blob URL/);
});

test('rejects missing, expired, or long-lived SAS credentials', () => {
  assert.throws(() => getBlobUrl(env(withExpiry(null)), 'project-a'), /Invalid private Azure state blob URL/);
  assert.throws(() => getBlobUrl(env(withExpiry(-1)), 'project-a'), /Invalid private Azure state blob URL/);
  assert.throws(() => getBlobUrl(env(withExpiry(31)), 'project-a'), /Invalid private Azure state blob URL/);
});

test('rejects missing blob mapping and untrusted hosts', () => {
  assert.throws(() => getBlobUrl(env(valid), 'project-b'), /No Azure blob configured/);
  assert.throws(() => getBlobUrl(env(valid.replace('account.blob.core.windows.net', 'account.blob.core.windows.net.evil.test')), 'project-a'), /Invalid private Azure state blob URL/);
});
