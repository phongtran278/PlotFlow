import assert from 'node:assert/strict';
import test from 'node:test';
import { getMemoryProfile } from '../src/runtime/memoryProfile.js';

test('headless and server-side memory detection uses conservative bounds', () => {
  const profile = getMemoryProfile();
  assert.equal(profile.lowMemory, true);
  assert.equal(profile.preloadNextUnit, false);
  assert.ok(profile.previewCacheTarget <= 2);
  assert.ok(profile.pageCacheTarget <= 2);
  assert.ok(profile.objectUrlTarget <= 2);
});
