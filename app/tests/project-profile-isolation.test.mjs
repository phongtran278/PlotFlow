import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectProfile, projectOverviewGroups } from '../src/project/ProjectProfile.js';
import { PROJECTS, getProjectById } from '../src/product/projectCatalog.js';
import { canMountLegacyWorkspace } from '../src/project/ProjectWorkspacePolicy.js';

test('nested defaults are independent across profiles and from input objects',()=>{
  const input={sales:{fieldMap:{code:['Mã căn']}},overview:{groups:['A']}};
  const a=createProjectProfile(input), b=createProjectProfile(input);
  a.sales.fieldMap.code.push('other');a.overview.groups.push('B');a.assets.roles.push('houses');a.locator.codeRules.test={x:1};
  assert.deepEqual(b.sales.fieldMap.code,['Mã căn']);assert.deepEqual(input.overview.groups,['A']);
  assert.deepEqual(b.overview.groups,['A']);assert.deepEqual(createProjectProfile().assets.roles,[]);
  assert.deepEqual(createProjectProfile().locator.codeRules,{});
});
test('catalog identities and codes are unique, and only VSP owns legacy assets',()=>{
  assert.equal(new Set(PROJECTS.map(p=>p.id)).size,PROJECTS.length);
  assert.equal(new Set(PROJECTS.map(p=>p.code)).size,PROJECTS.length);
  for(const p of PROJECTS){
    assert.match(p.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(p.profile.schemaVersion,1);
    if(p.id==='vinhomes-saigon-park'){
      assert.equal(p.profile.assets.catalogId,p.id);
      assert.equal(p.profile.assets.preparedManifest,'/masterplan/generated/manifest.json');
      assert.equal(p.profile.overview.rasterSource,'prepared-masterplan-page-1');
      assert.equal(canMountLegacyWorkspace(p,'project'),true);
    }else{
      assert.equal(p.profile.assets.catalogId,null);
      assert.equal(p.profile.assets.masterplanPdf,null);
      assert.equal(p.profile.overview.rasterSource,null);
      assert.equal(canMountLegacyWorkspace(p,'project'),false);
      assert.deepEqual(p.profile.assets.roles,[]);
    }
  }
});
test('landing defaults do not share nested arrays or objects between projects',()=>{
  const a=getProjectById('vinhomes-green-paradise'), b=getProjectById('vinhomes-grand-park');
  assert.notEqual(a.landing.valuePillars,b.landing.valuePillars);
  assert.notEqual(a.landing.valuePillars[0],b.landing.valuePillars[0]);
  assert.notEqual(a.landing.location.destinations,b.landing.location.destinations);
  assert.notEqual(a.landing.trust.proof,b.landing.trust.proof);
});
test('handover groups remain VSP-compatible and other projects do not inherit them',()=>{
  assert.deepEqual(projectOverviewGroups(getProjectById('vinhomes-saigon-park').profile),['Hoàn thiện','Giãn xây','Xây thô']);
  assert.deepEqual(projectOverviewGroups(getProjectById('vinhomes-green-paradise').profile),[]);
  const profile=createProjectProfile({overview:{groups:[' A ','A','',null,'B']}});
  assert.deepEqual(projectOverviewGroups(profile),['A','B']);
  const groups=projectOverviewGroups(profile);groups.push('C');assert.equal(projectOverviewGroups(profile).includes('C'),false);
});
