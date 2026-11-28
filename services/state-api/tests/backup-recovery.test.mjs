import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectBackup,createRecoveryCopy} from '../tools/inspect-state-backup.mjs';
import {createApp} from '../src/index.js';
import {readState,writeState} from '../src/azure.js';

const projectId='qa-restore-project';
const original={version:1,projectId,storage:{layout:'{"label":"Sân vườn"}',unit:'00015',price:'12345678900'}};
const bytes=Buffer.from(JSON.stringify(original,null,2));
const sha256=createHash('sha256').update(bytes).digest('hex');

test('offline backup inspection verifies hash and schema, without exposing storage in summary',()=>{
  const result=inspectBackup(bytes,{projectId,expectedSha256:sha256});
  assert.deepEqual(result.state,original);
  assert.equal(result.summary.checksumCompared,true);
  assert.equal(result.summary.withinCurrentApiWriteLimit,true);
  assert.equal(result.summary.restoreAuthorized,false);
  assert.equal(result.summary.remoteVerified,false);
  assert.equal(result.summary.storageEntryCount,3);
  assert.doesNotMatch(JSON.stringify(result.summary),/Sân vườn|00015|12345678900/);
  assert.equal(inspectBackup(bytes,{projectId}).summary.checksumCompared,false);
});
test('corruption, wrong project, malformed state and invalid UTF-8 are rejected',()=>{
  assert.throws(()=>inspectBackup(Buffer.concat([bytes,Buffer.from(' ')]),{projectId,expectedSha256:sha256}),/checksum mismatch/);
  assert.throws(()=>inspectBackup(bytes,{projectId:'other-project'}),/schema or project mismatch/);
  assert.throws(()=>inspectBackup(Buffer.from(JSON.stringify({...original,storage:{a:5}})),{projectId}),/schema or project mismatch/);
  assert.throws(()=>inspectBackup(Buffer.from([255]),{projectId}),/UTF-8 JSON/);
});
test('large valid legacy backup is reported as exceeding API payload limit, not silently truncated',()=>{
  const large=Buffer.from(JSON.stringify({...original,storage:{large:'x'.repeat(300000)}}));
  assert.equal(inspectBackup(large,{projectId}).summary.withinCurrentApiWriteLimit,false);
});
test('local restore rehearsal is byte exact and refuses to overwrite an existing file',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'plotflow-backup-'));
  try{
    const source=path.join(dir,'state-source.json'),target=path.join(dir,'recovery.json');
    await writeFile(source,bytes);
    const info=await createRecoveryCopy(await readFile(source),target,{projectId,expectedSha256:sha256});
    assert.equal(info.sha256,sha256);
    assert.deepEqual(await readFile(target),bytes);
    await assert.rejects(createRecoveryCopy(bytes,target,{projectId}),{code:'EEXIST'});
    assert.deepEqual(await readFile(source),bytes);
    assert.deepEqual(await readFile(target),bytes);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('synthetic restore through State API and Azure adapter rejects stale ETag and keeps other project unchanged',async()=>{
  const other='qa-other-project';
  const sas = new URLSearchParams({sp:'rw',sr:'b',spr:'https',se:new Date(Date.now()+7*24*60*60*1000).toISOString(),sig:'synthetic'}).toString();
  const env={AZURE_STATE_CONTAINER_NAME:'plotflow-state-private',PROJECT_ACL_JSON:JSON.stringify({[projectId]:{'qa@example.org':'admin'},[other]:{'qa@example.org':'admin'}}),AZURE_BLOB_URLS_JSON:JSON.stringify({[projectId]:'https://mock.blob.core.windows.net/plotflow-state-private/restore.json?'+sas,[other]:'https://mock.blob.core.windows.net/plotflow-state-private/other.json?'+sas})};
  const entries=new Map([['/plotflow-state-private/restore.json',{state:{...original,storage:{layout:'changed'}},etag:'"v2"'}],['/plotflow-state-private/other.json',{state:{version:1,projectId:other,storage:{layout:'untouched'}},etag:'"other"'}]]);
  let writes=0;
  let attempts=0;
  const mockFetch=async(url,opts)=>{
    const u=new URL(url);assert.equal(u.hostname,'mock.blob.core.windows.net');
    const entry=entries.get(u.pathname);assert.ok(entry);
    if(opts.method==='GET')return new Response(JSON.stringify(entry.state),{status:200,headers:{etag:entry.etag}});
    assert.equal(opts.method,'PUT');
    attempts++;
    if(opts.headers['If-Match']!==entry.etag)return new Response(null,{status:412});
    writes++;entry.state=JSON.parse(opts.body);entry.etag='"v3"';
    return new Response(null,{status:201,headers:{etag:entry.etag}});
  };
  const app=createApp({authenticate:async()=>({email:'qa@example.org'}),read:(e,p)=>readState(e,p,mockFetch),write:(e,p,s,tag)=>writeState(e,p,s,tag,mockFetch)});
  const url='https://qa.example.org/v1/projects/'+projectId+'/state';
  const snapshot=inspectBackup(bytes,{projectId,expectedSha256:sha256}).state;
  const put=(etag,state=snapshot)=>new Request(url,{method:'PUT',headers:{'If-Match':etag},body:JSON.stringify(state)});
  const stale=await app(put('"v1"'),env);
  assert.equal(stale.status,412);
  assert.equal((await stale.json()).error,'version_conflict');
  assert.equal(attempts,1,'stale ETag must reach the mock Azure adapter');
  assert.equal(writes,0);
  assert.deepEqual(entries.get('/plotflow-state-private/restore.json').state.storage,{layout:'changed'});
  assert.equal((await app(put('"v2"',{...snapshot,projectId:other}),env)).status,400);
  assert.equal(writes,0);
  const current=await app(new Request(url),env);
  const response=await app(put(current.headers.get('etag')),env);
  assert.equal(response.status,200);
  assert.equal(writes,1);
  assert.deepEqual(await (await app(new Request(url),env)).json(),original);
  assert.deepEqual(entries.get('/plotflow-state-private/other.json').state.storage,{layout:'untouched'});
  assert.equal((await app(put('"v2"'),{...env,PLOTFLOW_PREVIEW_DISABLE_STATE_ACCESS:'1'})).status,503);
  assert.equal(writes,1);
});
