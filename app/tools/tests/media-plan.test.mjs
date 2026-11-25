import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createMediaPlan} from '../plan-project-media.mjs';

async function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'plotflow-plan-'));
  try{
    const sourceRoot=path.join(root,'source'),distAssetsRoot=path.join(root,'dist');
    for(const dir of [sourceRoot,distAssetsRoot]) for(const group of ['houses','amenities']) fs.mkdirSync(path.join(dir,group),{recursive:true});
    const image=await sharp({create:{width:20,height:20,channels:4,background:{r:40,g:60,b:80,alpha:0.5}}}).png().toBuffer();
    const relative='houses/CH 01.png';
    for(const dir of [sourceRoot,distAssetsRoot]) fs.writeFileSync(path.join(dir,relative),image);
    await fn({sourceRoot,distAssetsRoot,relative,image});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('plan is deterministic, project-scoped, content-addressed, and preserves source',async()=>fixture(async f=>{
  const a=await createMediaPlan({...f,projectId:'project-a'});
  const again=await createMediaPlan({...f,projectId:'project-a'});
  const b=await createMediaPlan({...f,projectId:'project-b'});
  assert.deepEqual(a,again);
  assert.equal(a.publicationAllowed,false);
  assert.equal(a.sourceCount,1);
  assert.equal(a.runtimeCount,1);
  assert.equal(a.mappings[0].runtimePath,'/assets/houses/CH%2001.png');
  assert.equal(a.objects.length,2);
  assert.ok(a.objects.every(x=>x.alpha&&x.blobKey.startsWith('projects/project-a/media/')));
  assert.ok(b.objects.every(x=>x.blobKey.startsWith('projects/project-b/media/')));
  assert.deepEqual(fs.readFileSync(path.join(f.sourceRoot,f.relative)),f.image);
}));
test('missing runtime image blocks plan',async()=>fixture(async f=>{
  fs.unlinkSync(path.join(f.distAssetsRoot,f.relative));
  await assert.rejects(createMediaPlan({...f,projectId:'project-a'}),/Missing runtime media/);
}));
test('invalid project ID and lost transparency block plan',async()=>fixture(async f=>{
  await assert.rejects(createMediaPlan({...f,projectId:'../production'}),/Invalid project ID/);
  const flattened=await sharp(f.image).flatten().png().toBuffer();
  fs.writeFileSync(path.join(f.distAssetsRoot,f.relative),flattened);
  await assert.rejects(createMediaPlan({...f,projectId:'project-a'}),/Transparency lost/);
}));
test('runtime alias is inventoried without guessed original association',async()=>fixture(async f=>{
  const dir=path.join(f.distAssetsRoot,'library/houses');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'alias.png'),f.image);
  const plan=await createMediaPlan({...f,projectId:'project-a'});
  assert.equal(plan.runtimeCount,2);
  assert.equal(plan.unverifiedProvenance,1);
  assert.equal(plan.mappings.find(x=>x.logicalPath.endsWith('alias.png')).originalBlob,null);
  assert.equal(plan.objects.length,2);
}));
