import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectStorage, projectStorageKey } from '../src/project/ProjectStorage.js';

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(String(key)) ? values.get(String(key)) : null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: (key) => { values.delete(String(key)); },
  };
}

function withStorage(run) {
  const prior = globalThis.window;
  const storage = makeStorage();
  globalThis.window = { localStorage: storage };
  try { run(storage); } finally {
    if (prior === undefined) delete globalThis.window;
    else globalThis.window = prior;
  }
}

test('project storage keys are normalized and isolated by project and version', () => {
  withStorage(() => {
    assert.equal(projectStorageKey('Project A', 'sales', 2), 'plotflow:project-a:sales:v2');
    const a = createProjectStorage('Project A');
    const b = createProjectStorage('Project B');
    a.writeJson('sales', { units: ['A-01'] });
    b.writeJson('sales', { units: ['B-01'] });
    assert.deepEqual(a.readJson('sales'), { units: ['A-01'] });
    assert.deepEqual(b.readJson('sales'), { units: ['B-01'] });
    assert.equal(a.readJson('sales', { version: 2, fallback: 'missing' }), 'missing');
    a.remove('sales');
    assert.equal(a.readJson('sales', { fallback: 'removed' }), 'removed');
    assert.deepEqual(b.readJson('sales'), { units: ['B-01'] });
  });
});

test('legacy migration is opt-in and writes into the project namespace', () => {
  withStorage((storage) => {
    storage.setItem('legacy-layout', JSON.stringify({ zoom: 1.5 }));
    const isolated = createProjectStorage('no-legacy');
    assert.equal(isolated.readJson('layout', { legacyKey: 'legacy-layout', fallback: null }), null);
    const migrated = createProjectStorage('enabled', { allowLegacyFallback: true });
    assert.deepEqual(migrated.readJson('layout', { legacyKey: 'legacy-layout' }), { zoom: 1.5 });
    assert.equal(storage.getItem('plotflow:enabled:layout:v1'), '{"zoom":1.5}');
  });
});

test('malformed saved JSON and unavailable storage do not crash the workspace', () => {
  withStorage((storage) => {
    storage.setItem('plotflow:case:layout:v1', '{invalid');
    const project = createProjectStorage('case');
    assert.deepEqual(project.readJson('layout', { fallback: [] }), []);
  });
  const prior = globalThis.window;
  globalThis.window = { localStorage: {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  } };
  try {
    const project = createProjectStorage('blocked');
    assert.doesNotThrow(() => project.writeJson('layout', { x: 1 }));
    assert.doesNotThrow(() => project.remove('layout'));
    assert.deepEqual(project.readJson('layout', { fallback: { safe: true } }), { safe: true });
  } finally {
    if (prior === undefined) delete globalThis.window;
    else globalThis.window = prior;
  }
});
