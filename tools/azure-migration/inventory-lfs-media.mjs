import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const media = /\.(png|jpe?g|webp|pdf)$/i;
const font = /\.(otf|ttf|woff2?)$/i;
const git = (args, options={}) => execFileSync('git',args,{maxBuffer:64*1024*1024,...options});

export function parseLfsPointer(bytes) {
  const text=bytes.toString('utf8');
  const m=/^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\noid sha256:([0-9a-f]{64})\r?\nsize ([0-9]+)\r?\n?$/.exec(text);
  if(!m) return null;
  const size=Number(m[2]);
  if(!Number.isSafeInteger(size)||size<0) throw Error('Invalid LFS size');
  return {sha256:m[1],bytes:size};
}

export function classify(file) {
  if(file.startsWith('app/public/masterplan/generated/page-tiles/')) return 'page-tiles';
  if(file.startsWith('masterplan/')||file.startsWith('app/public/masterplan/')) return 'masterplan';
  if(file.startsWith('assets/')) return 'source-assets';
  if(file.startsWith('app/public/')) return 'public-assets';
  return 'legacy-or-reference';
}

export function createInventory() {
  const commit=git(['rev-parse','HEAD']).toString().trim();
  const tree=git(['ls-tree','-r','-z','--full-tree',commit]).toString('utf8').split('\0').filter(Boolean).map(line=>{
    const tab=line.indexOf('\t');
    const [mode,type,oid]=line.slice(0,tab).split(' ');
    return {mode,type,oid,path:line.slice(tab+1)};
  }).filter(x=>x.type==='blob'&&(media.test(x.path)||font.test(x.path)));
  const ids=[...new Set(tree.map(x=>x.oid))];
  const batch=git(['cat-file','--batch'],{input:ids.join('\n')+'\n'});
  const blobs=new Map();let offset=0;
  for(const id of ids){
    const end=batch.indexOf(10,offset);
    if(end<0) throw Error('Incomplete Git object header');
    const [oid,type,sizeText]=batch.subarray(offset,end).toString().split(' ');
    const size=Number(sizeText);
    if(oid!==id||type!=='blob'||!Number.isSafeInteger(size)||size<0||end+1+size>=batch.length||batch[end+1+size]!==10)throw Error('Invalid Git object response');
    blobs.set(id,batch.subarray(end+1,end+1+size));offset=end+size+2;
  }
  if(offset!==batch.length)throw Error('Unexpected Git object response');
  const groups={};const objects=new Map();const entries=[];
  for(const item of tree){
    const bytes=blobs.get(item.oid);
    const pointer=parseLfsPointer(bytes);
    if(!pointer&&bytes.subarray(0,80).toString().startsWith('version https://git-lfs.github.com/spec/'))throw Error('Invalid or unsupported LFS pointer: '+item.path);
    const kind=pointer?'lfs':'git-blob';
    const group=classify(item.path);
    const sha=pointer?.sha256??null;
    const size=pointer?.bytes??bytes.length;
    const archiveKey=sha?'projects/vinhomes-saigon-park/migration/lfs/sha256/'+sha:null;
    const previous=sha&&objects.get(sha);
    if(previous&&previous.bytes!==size)throw Error('Conflicting pointer size for '+sha);
    if(sha&&!previous)objects.set(sha,{sha256:sha,bytes:size,archiveKey});
    const stat=groups[group]??={files:0,lfsFiles:0,logicalBytes:0};
    stat.files++;stat.logicalBytes+=size;if(pointer)stat.lfsFiles++;
    entries.push({path:item.path,group,kind,gitObject:item.oid,sha256:sha,bytes:size,archiveKey});
  }
  const unique=[...objects.values()].sort((a,b)=>a.sha256.localeCompare(b.sha256));
  return {schemaVersion:1,commit,projectId:'vinhomes-saigon-park',mode:'git-metadata-only',publicationAllowed:false,azureVerified:false,mediaFiles:entries.length,lfsFiles:entries.filter(e=>e.kind==='lfs').length,uniqueLfsObjects:unique.length,uniqueLfsBytes:unique.reduce((s,o)=>s+o.bytes,0),groups,objects:unique,entries};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const plan=createInventory();
  if(!plan.lfsFiles||!plan.groups['page-tiles']?.lfsFiles)throw Error('Expected LFS inventory missing');
  process.stdout.write(JSON.stringify(plan,null,2)+'\n');
}
