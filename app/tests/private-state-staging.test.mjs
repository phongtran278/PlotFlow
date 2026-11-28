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
    fetch:async(url,opts)=>{calls.push({url,opts});assert.ok(responses.length,'unexpected network call');return responses.shift()}};
  const input={VITE_PLOTFLOW_PRIVATE_STAGING:'1',VITE_STATE_API_BASE_URL:api,...env};
  const code=source.replace(/^import[^\n]*ProjectCloudScope\.js[^\n]*\n/m, '').replaceAll('import.meta.env', JSON.stringify(input)).replaceAll('export async function','async function').replaceAll('export function','function');
  vm.runInNewContext(code,context);
  return {window,data,calls,events,bootstrap:context.bootstrapCloudProjectState,flush:context.flushCloudProjectState};
}
const state={version:1,projectId:'vinhomes-saigon-park',storage:{[key]:'{}',untracked:'preserve'}};
const get=()=>new Response(JSON.stringify(state),{headers:{'x-plotflow-state-etag':'"old"'}});
test('preview cannot contact staging state API',async()=>{const h=harness({origin:'https://preview-plotflow-ui-staging.phongtran7076.workers.dev'});await h.bootstrap();assert.equal(await h.flush(),false);assert.equal(h.calls.length,0)});
test('legacy credential disables stable staging transport',async()=>{const h=harness({env:{VITE_PROJECT_STATE_URL:'https://example.invalid/state.json'}});await h.bootstrap();assert.equal(await h.flush(),false);assert.equal(h.calls.length,0)});
test('differing local cache is preserved and writes blocked',async()=>{const h=harness({local:{[key]:'{"local":true}'},responses:[get()]});await h.bootstrap();assert.equal(h.data.get(key),'{"local":true}');assert.equal(await h.flush(),false);assert.equal(h.window.__plotflowCloudStateStatus.status,'manual_migration_required');assert.equal(h.calls.length,1)});
test('credentialed writes preserve unrelated keys and stop after stale ETag',async()=>{const h=harness({responses:[get(),new Response('{}',{headers:{'x-plotflow-state-etag':'"new"'}}),new Response('{}',{status:412})]});await h.bootstrap();h.window.localStorage.setItem(key,'{"edited":true}');assert.equal(await h.flush(),true);assert.equal(h.calls[1].opts.credentials,'include');assert.equal(h.calls[1].opts.headers['If-Match'],'"old"');assert.equal(JSON.parse(h.calls[1].opts.body).storage.untracked,'preserve');assert.equal(await h.flush(),false);assert.equal(h.calls[2].opts.headers['If-Match'],'"new"');assert.equal(h.window.__plotflowCloudStateStatus.status,'version_conflict');assert.equal(await h.flush(),false);assert.equal(h.calls.length,3)});
test('same-origin tab storage change blocks future writes',async()=>{const h=harness({responses:[get()]});await h.bootstrap();h.events.storage({storageArea:h.window.localStorage,key});assert.equal(await h.flush(),false);assert.equal(h.calls.length,1)});

test('foreign projects cannot acquire legacy VSP keys',()=>{assert.equal(isProjectCloudKey('other-project',key),false);assert.equal(isProjectCloudKey('vinhomes-saigon-park',key),true)});
