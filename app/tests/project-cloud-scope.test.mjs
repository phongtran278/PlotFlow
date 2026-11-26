import test from 'node:test';
import assert from 'node:assert/strict';
import {canUseLegacyProjectStorage,isProjectCloudKey,validateCloudSnapshot,mergeProjectCloudStorage} from '../src/project/ProjectCloudScope.js';

const legacy='vinhomes-saigon-park',a='qa-project-a',b='qa-project-b';
const old='plotflow-design-assignments-r1',ka='plotflow:qa-project-a:layout:v1',kb='plotflow:qa-project-b:layout:v1';
test('legacy keys are owned exclusively by Vinhomes Saigon Park',()=>{
 assert.equal(canUseLegacyProjectStorage(legacy),true);
 assert.equal(canUseLegacyProjectStorage(a),false);
 assert.equal(isProjectCloudKey(legacy,old),true);
 assert.equal(isProjectCloudKey(a,old),false);
 assert.equal(isProjectCloudKey(legacy,'plotflow-floorplan-overrides-v6'),true);
 assert.equal(isProjectCloudKey(a,'plotflow-floorplan-overrides-v6'),false);
});
test('project keys are exact-prefix scoped, not shared by similarly named projects',()=>{
 assert.equal(isProjectCloudKey(a,ka),true);assert.equal(isProjectCloudKey(a,kb),false);
 assert.equal(isProjectCloudKey(a,'plotflow:qa-project-a-extra:layout:v1'),false);
 assert.equal(isProjectCloudKey('../qa-project-a',ka),false);
});
test('state schema and project must match before reading remote storage',()=>{
 const valid={version:1,projectId:a,storage:{[ka]:'{}'}};
 assert.equal(validateCloudSnapshot(valid,a),valid);
 for(const bad of [null,{...valid,projectId:b},{...valid,version:2},{...valid,storage:[]},{...valid,storage:{[ka]:42}},{...valid,storage:null}])assert.throws(()=>validateCloudSnapshot(bad,a),/schema or project mismatch/);
});
test('remote unknown keys remain untouched, and foreign local values are excluded',()=>{
 const remote={[ka]:'old',[kb]:'remote-b',[old]:'legacy-owner',future:'future'};
 const local={[ka]:'new',[kb]:'local-b',[old]:'local-legacy',extra:'extra'};
 assert.deepEqual(mergeProjectCloudStorage(a,remote,local),{[ka]:'new',[kb]:'remote-b',[old]:'legacy-owner',future:'future'});
 assert.equal(remote[ka],'old');
});
test('legacy VSP cloud payload keeps existing key names without migration',()=>{
 const key='plotflow:vinhomes-saigon-park:sheet-history:v1';
 assert.deepEqual(mergeProjectCloudStorage(legacy,{[old]:'old',future:'keep'},{[old]:'new',[key]:'[]',[kb]:'foreign'}),{[old]:'new',[key]:'[]',future:'keep'});
});
