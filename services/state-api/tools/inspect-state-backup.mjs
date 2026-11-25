import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile, lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const API_MAX_BYTES = 256 * 1024;
const validProject = id => typeof id === 'string' && id.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function inspectBackup(bytes, { projectId, expectedSha256 } = {}) {
  if (!validProject(projectId)) throw Error('Invalid expected project ID');
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_FILE_BYTES) throw Error('Backup size outside offline inspection limit');
  const digest = hash(bytes);
  if (expectedSha256 !== undefined) {
    if (typeof expectedSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(expectedSha256)) throw Error('Invalid expected SHA-256');
    if (!timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(expectedSha256,'hex'))) throw Error('Backup checksum mismatch');
  }
  let state;
  try { state = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { throw Error('Backup is not valid UTF-8 JSON'); }
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1 || state.projectId !== projectId ||
      !state.storage || typeof state.storage !== 'object' || Array.isArray(state.storage) ||
      !Object.values(state.storage).every(v=>typeof v==='string')) throw Error('Backup state schema or project mismatch');
  const serializedBytes=Buffer.byteLength(JSON.stringify(state),'utf8');
  return {state,summary:{projectId,version:state.version,bytes:bytes.length,sha256:digest,checksumCompared:expectedSha256!==undefined,storageEntryCount:Object.keys(state.storage).length,apiPayloadBytes:serializedBytes,withinCurrentApiWriteLimit:serializedBytes<=API_MAX_BYTES,mode:'offline-inspection',remoteVerified:false,restoreAuthorized:false}};
}

// Create a byte-exact local recovery copy only. Never overwrite any existing path.
export async function createRecoveryCopy(bytes, target, options) {
  const {summary}=inspectBackup(bytes,options);
  const handle=await open(target,'wx',0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  const recovered=await readFile(target);
  const result=inspectBackup(recovered,{projectId:options.projectId,expectedSha256:summary.sha256});
  return {...result.summary,mode:'local-copy-rehearsal'};
}

async function main() {
  const [file,projectId,expectedSha256,...extra]=process.argv.slice(2);
  if(!file||!projectId||extra.length) throw Error('Usage: node tools/inspect-state-backup.mjs <local-file> <project-id> [expected-sha256]');
  const info=await lstat(file);
  if(!info.isFile()||info.size>MAX_FILE_BYTES) throw Error('Backup must be a regular local file within the inspection limit');
  const bytes=await readFile(file);
  const {summary}=inspectBackup(bytes,{projectId,expectedSha256});
  console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {await main();} catch(error) {console.error('Offline verification failed: '+(error.code?'local file unavailable':error.message));process.exitCode=1;}
}
