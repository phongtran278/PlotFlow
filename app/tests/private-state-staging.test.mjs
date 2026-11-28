import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { canUseLegacyProjectStorage, isProjectCloudKey, validateCloudSnapshot, mergeProjectCloudStorage } from '../src/project/ProjectCloudScope.js';

const source = readFileSync(new URL('../src/project/CloudProjectState.js', import.meta.url), 'utf8');
const ui = 'https://plotflow-ui-staging.phongtran7076.workers.dev';
const api = 'https://plotflow-state-api-staging.phongtran7076.workers.dev';
const key = 'plotflow-design-assignments-r1';
function harness({origin=ui, env={}, local={}, responses=[]}={}) {
  const calls=[], events={}, data=new Map(Object.entries(local));
  class Storage {
    get length(){return data.size}
    key(i){return [...data.keys()][i]}
    getItem(k){return data.get(k)??null}
    setItem(k,v){data.set(k,String(v))}
    removeItem(k){data.delete(k)}
    clear(){data.clear()}
  }
  const window={location:new URL(origin),localStorage:new Storage(),dispatchEvent(){},addEventListener(n,f){events[n]=f},clearTimeout(){},setTimeout(){return 1}};
  const context={window,Storage,canUseLegacyProjectStorage,isProjectCloudKey,validateCloudSnapshot,mergeProjectCloudStorage,document:{addEventListener(){}},console:{info(){},warn(){}},CustomEvent:class{},URLSearchParams,AbortSignal,
    fetch:async(url,opts)=>{calls.push({url,opts});assert.ok(responses.length,'unexpected network call');const next=responses.shift();if(next instanceof Error)throw next;return next}};
  const input={VITE_PLOTFLOW_PRIVATE_STAGING:'1',VITE_STATE_API_BASE_URL:api,...env};
  const code=source.replace(/^import[^\n]*ProjectCloudScope\.js[^\n]*\n/m, '').replaceAll('import.meta.env', JSON.stringify(input)).replaceAll('export async function','async function').replaceAll('export function','function');
  vm.runInNewContext(code,context);
  return {window,data,calls,events,bootstrap:context.bootstrapCloudProjectState,flush:context.flushCloudProjectState,review:context.getCloudConflictReview};
}
const state={version:1,projectId:'vinhomes-saigon-park',storage:{[key]:'{}',untracked:'preserve'}};
const get=()=>new Response(JSON.stringify(state),{headers:{'x-plotflow-state-etag':'"old"'}});
test('preview cannot contact staging state API',async()=>{const h=harness({origin:'https://preview-plotflow-ui-staging.phongtran7076.workers.dev'});await h.bootstrap();assert.equal(await h.flush(),false);assert.equal(h.calls.length,0)});
test('legacy credential disables stable staging transport',async()=>{const h=harness({env:{VITE_PROJECT_STATE_URL:'https://example.invalid/state.json'}});await h.bootstrap();assert.equal(await h.flush(),false);assert.equal(h.calls.length,0)});
test('differing local cache is preserved and writes blocked',async()=>{const h=harness({local:{[key]:'{"local":true}'},responses:[get()]});await h.bootstrap();assert.equal(h.data.get(key),'{"local":true}');assert.equal(await h.flush(),false);assert.equal(h.window.__plotflowCloudStateStatus.status,'manual_migration_required');assert.equal(h.calls.length,1)});
test('credentialed writes preserve unrelated keys and stop after stale ETag',async()=>{const h=harness({responses:[get(),new Response('{}',{headers:{'x-plotflow-state-etag':'"new"'}}),new Response('{}',{status:412})]});await h.bootstrap();h.window.localStorage.setItem(key,'{"edited":true}');assert.equal(await h.flush(),true);assert.equal(h.calls[1].opts.credentials,'include');assert.equal(h.calls[1].opts.headers['If-Match'],'"old"');assert.equal(JSON.parse(h.calls[1].opts.body).storage.untracked,'preserve');assert.equal(await h.flush(),false);assert.equal(h.calls[2].opts.headers['If-Match'],'"new"');assert.equal(h.window.__plotflowCloudStateStatus.status,'version_conflict');assert.equal(await h.flush(),false);assert.equal(h.calls.length,3)});
test('same-origin tab storage change blocks future writes',async()=>{const h=harness({responses:[get()]});await h.bootstrap();h.events.storage({storageArea:h.window.localStorage,key});assert.equal(await h.flush(),false);assert.equal(h.calls.length,1)});

test('foreign projects cannot acquire legacy VSP keys',()=>{assert.equal(isProjectCloudKey('other-project',key),false);assert.equal(isProjectCloudKey('vinhomes-saigon-park',key),true)});

test('load failure diagnostic is bounded and never enables writes or clears local data',async()=>{
  const cases=[
    [new Response('secret body',{status:401}),'authentication_required'],
    [new Response('secret body',{status:403}),'access_denied'],
    [new Response('secret body',{status:404}),'endpoint_not_found'],
    [new Response('secret body',{status:502}),'storage_unavailable'],
    [new Response('secret body',{status:503}),'service_unavailable'],
    [new Response('secret body',{status:500}),'http_error'],
    [new TypeError('secret URL'),'network_or_access'],
    [Object.assign(new Error('secret URL'),{name:'TimeoutError'}),'timeout'],
    [new Response('not JSON'),'invalid_snapshot'],
    [new Response(JSON.stringify(state)),'missing_read_version'],
  ];
  for(const [response,diagnostic] of cases){
    const h=harness({local:{[key]:'{"local":true}'},responses:[response]});
    await h.bootstrap();
    assert.equal(h.window.__plotflowCloudStateStatus.status,'load_error');
    assert.equal(h.window.__plotflowCloudStateStatus.diagnostic,diagnostic);
    assert.equal(h.data.get(key),'{"local":true}');
    assert.equal(await h.flush(),false);
    assert.equal(h.calls.length,1);
    assert.equal(h.calls[0].opts.method,'GET');
  }
});
test('staging transport mismatch reports configuration without any network request',async()=>{
  const h=harness({env:{VITE_STATE_API_BASE_URL:'https://wrong.invalid'}});
  await h.bootstrap();
  assert.equal(h.window.__plotflowCloudStateStatus.diagnostic,'transport_config');
  assert.equal(await h.flush(),false);
  assert.equal(h.calls.length,0);
});

test('conflict review preserves both scoped snapshots without writes or unrelated data',async()=>{
  const localOnly='plotflow:vinhomes-saigon-park:local-only';
  const remoteOnly='plotflow:vinhomes-saigon-park:remote-only';
  const same='plotflow:vinhomes-saigon-park:same';
  const foreign='plotflow:other-project:private';
  const h=harness({local:{[key]:'{"local":true}',[localOnly]:'local',[same]:'same',[foreign]:'foreign'},
    responses:[new Response(JSON.stringify({...state,storage:{...state.storage,[remoteOnly]:'remote',[same]:'same',[foreign]:'foreign'}}),{headers:{'x-plotflow-state-etag':'"old"'}})]});
  await h.bootstrap();
  const before=[...h.data];
  const review=h.review();
  assert.equal(review.projectId,state.projectId);
  assert.equal(review.local.storage[key],'{"local":true}');
  assert.equal(review.remote.storage[key],'{}');
  assert.equal(review.local.storage[foreign],undefined);
  assert.equal(review.remote.storage[foreign],undefined);
  assert.equal(review.remote.storage.untracked,undefined);
  assert.equal(review.etag,undefined);
  const map=Object.fromEntries(review.comparison.map(item=>[item.key,item.status]));
  assert.deepEqual(map,{[key]:'different',[localOnly]:'local_only',[remoteOnly]:'remote_only',[same]:'same'});
  assert.deepEqual([...h.data],before);
  h.window.localStorage.setItem(key,'{"newerLocal":true}');
  assert.equal(h.review().local.storage[key],'{"newerLocal":true}');
  assert.equal(await h.flush(),false);
  assert.equal(h.calls.length,1);
});
test('conflict review is unavailable without verified staging snapshot or a mismatch',async()=>{
  const failed=harness({responses:[new Response('{}',{status:503})]});
  await failed.bootstrap();assert.equal(failed.review(),null);
  const synced=harness({responses:[get()]});
  await synced.bootstrap();assert.equal(synced.review(),null);
  const preview=harness({origin:'https://preview-plotflow-ui-staging.phongtran7076.workers.dev'});
  await preview.bootstrap();assert.equal(preview.review(),null);
});
test('conflict review handles an empty remote scoped snapshot without enabling writes',async()=>{
  const h=harness({local:{[key]:'local'},responses:[new Response(JSON.stringify({...state,storage:{}}),{headers:{'x-plotflow-state-etag':'"old"'}})]});
  await h.bootstrap();assert.equal(h.review().comparison[0].status,'local_only');
  assert.equal(await h.flush(),false);assert.equal(h.calls.length,1);
});
