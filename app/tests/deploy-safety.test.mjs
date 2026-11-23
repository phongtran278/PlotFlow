import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-azure-storage.yml', import.meta.url), 'utf8');

test('Azure deployment is limited to the designated deploy branch and manual dispatch', () => {
  const trigger = workflow.match(/^on:\s*\n([\s\S]*?)(?=^jobs:)/m)?.[1] || '';
  assert.match(trigger, /^  push:\s*\n    branches:\s*\n      - agent\/fix-preview-pan-tabs-memory\s*$/m);
  assert.match(trigger, /^  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(trigger, /^  pull_request:/m);
  assert.doesNotMatch(trigger, /^      - (main|safety\/.*|feature\/.*)$/m);
});

test('Azure state initialization must remain conditional and non-overwriting', () => {
  assert.match(workflow, /STATE_EXISTS=/);
  assert.match(workflow, /if \[ "\$STATE_EXISTS" != "true" \]; then/);
  assert.match(workflow, /--name "\$STATE_BLOB"[\s\S]*?--overwrite false/);
  assert.doesNotMatch(workflow, /az storage blob delete\b/);
});
