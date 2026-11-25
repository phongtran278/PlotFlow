import test from 'node:test';
import assert from 'node:assert/strict';
import {canMountLegacyWorkspace,projectRouteId} from '../src/project/ProjectWorkspacePolicy.js';
const vsp={id:'vinhomes-saigon-park',masterplan:true,profile:{legacyStorage:true,overview:{configured:true}}};
test('only configured Saigon Park project routes mount legacy workspace',()=>{
 assert.equal(canMountLegacyWorkspace(vsp,'project'),true);
 assert.equal(canMountLegacyWorkspace(vsp,'home'),false);
 assert.equal(canMountLegacyWorkspace({...vsp,id:'qa-other-project'},'project'),false);
 assert.equal(canMountLegacyWorkspace(null,'project'),false);
});
test('missing project configuration fails closed',()=>{
 assert.equal(canMountLegacyWorkspace({...vsp,masterplan:false},'project'),false);
 assert.equal(canMountLegacyWorkspace({...vsp,profile:{legacyStorage:true}},'project'),false);
 assert.equal(canMountLegacyWorkspace({...vsp,profile:{legacyStorage:false,overview:{configured:true}}},'project'),false);
});
test('malformed encoded route cannot crash or select legacy workspace',()=>{
 assert.equal(projectRouteId('%E0%A4%A'),'');
 assert.equal(projectRouteId('vinhomes%2Dsaigon%2Dpark'),'vinhomes-saigon-park');
 assert.equal(projectRouteId(undefined),'');
});
