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

test('initializing memory detection preserves the crop paired with a saved highlight', async () => {
  const key = 'plotflow-floorplan-overrides-v6';
  const original = JSON.stringify({ 'AS80-03': {
    selectedMatchIndex: 1,
    view: { zoom: 2000, offsetX: 5, offsetY: -7 },
  } });
  const stored = new Map([[key, original]]);
  globalThis.window = {
    localStorage: {
      getItem: (name) => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, value),
    },
  };
  try {
    await import('../src/runtime/memoryProfile.js?fresh-browser');
    assert.equal(stored.get(key), original);
  } finally {
    delete globalThis.window;
  }
});
