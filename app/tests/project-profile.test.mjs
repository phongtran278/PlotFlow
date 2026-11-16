import assert from 'node:assert/strict';
import test from 'node:test';
import { PROJECTS } from '../src/product/projectCatalog.js';
import { createProjectProfile, PROJECT_PROFILE_SCHEMA_VERSION } from '../src/project/ProjectProfile.js';

test('profiles preserve safe defaults without replacing unrelated properties', () => {
  const profile = createProjectProfile({
    topology: { kind: 'high-rise' },
    overview: { configured: true },
  });
  assert.equal(profile.schemaVersion, PROJECT_PROFILE_SCHEMA_VERSION);
  assert.equal(profile.topology.kind, 'high-rise');
  assert.deepEqual(profile.topology.hierarchy, []);
  assert.equal(profile.overview.configured, true);
  assert.deepEqual(profile.overview.groups, []);
  assert.equal(profile.legacyStorage, false);
});

test('project catalog keeps unique route IDs and workspace profiles', () => {
  assert.ok(PROJECTS.length > 0);
  const ids = PROJECTS.map((project) => project.id);
  assert.equal(new Set(ids).size, ids.length, 'project IDs must be unique');
  assert.ok(ids.includes('vinhomes-saigon-park'));
  for (const project of PROJECTS) {
    assert.match(project.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(project.name?.trim(), `Missing name: ${project.id}`);
    assert.equal(project.profile.schemaVersion, PROJECT_PROFILE_SCHEMA_VERSION);
    assert.ok(Array.isArray(project.profile.topology.hierarchy));
    assert.ok(project.landing && typeof project.landing === 'object');
  }
});
