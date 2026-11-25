import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const supported = /\.(png|jpe?g|webp|gif|avif|tiff?)$/i;
const limit = 25 * 1024 * 1024;
const groups = ['houses','amenities'];
const variantGroups = ['houses_optimized','library/houses','library/amenities'];
const posix = p => p.split(path.sep).join('/');
const formatByExt = {png:'png',jpg:'jpeg',jpeg:'jpeg',webp:'webp',gif:'gif',avif:'heif',tif:'tiff',tiff:'tiff'};

function collect(root, group, required=false) {
  const dir = path.join(root,group);
  if (!fs.existsSync(dir)) {
    if(required) throw Error('Missing media group: '+group);
    return [];
  }
  // Reject symlinks throughout the selected subtree, including group ancestors.
  let cursor=root;
  for(const segment of group.split('/')){
    cursor=path.join(cursor,segment);
    if(!fs.lstatSync(cursor).isDirectory()) throw Error('Invalid media directory: '+group);
  }
  const files=[];
  function walk(current){
    for(const e of fs.readdirSync(current,{withFileTypes:true})){
      const f=path.join(current,e.name);
      if(e.isSymbolicLink()) throw Error('Symlink in media tree: '+posix(path.relative(root,f)));
      if(e.isDirectory()) walk(f);
      else if(e.isFile()&&supported.test(e.name)) files.push(posix(path.relative(root,f)));
    }
  }
  walk(dir);
  return files.sort();
}

async function describe(root, relative, runtime=false) {
  const filename=path.join(root,...relative.split('/'));
  const st=fs.lstatSync(filename);
  if(!st.isFile()||!st.size) throw Error('Missing or empty media: '+relative);
  if(runtime&&st.size>limit) throw Error('Runtime media exceeds 25 MiB: '+relative);
  const hash=createHash('sha256');
  await pipeline(fs.createReadStream(filename),hash);
  const info=await sharp(filename,{limitInputPixels:100_000_000,sequentialRead:true}).metadata();
  const extension=path.extname(relative).slice(1).toLowerCase();
  if(info.format!==formatByExt[extension]||!info.width||!info.height) throw Error('Invalid media format or dimensions: '+relative);
  return {sha256:hash.digest('hex'),bytes:st.size,width:info.width,height:info.height,format:info.format,extension,alpha:Boolean(info.hasAlpha)};
}

export async function createMediaPlan({projectId,sourceRoot,distAssetsRoot}) {
  if(typeof projectId!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)||projectId.length>80) throw Error('Invalid project ID');
  for(const root of [sourceRoot,distAssetsRoot]) if(!fs.lstatSync(root).isDirectory()) throw Error('Media root is not a directory');
  const originals=groups.flatMap(g=>collect(sourceRoot,g,true)).sort();
  if(!originals.length) throw Error('No source media found');
  const runtimeFiles=[...groups,...variantGroups].flatMap(g=>collect(distAssetsRoot,g,groups.includes(g))).sort();
  const runtimeSet=new Set(runtimeFiles);
  const objects=new Map();
  const mappings=[];
  const originalSet=new Set(originals);
  function object(kind,meta){
    const blobKey='projects/'+projectId+'/media/'+kind+'/'+meta.sha256+'.'+meta.extension;
    if(!objects.has(blobKey)) objects.set(blobKey,{kind,blobKey,...meta});
    return blobKey;
  }
  for(const relative of originals){
    if(!runtimeSet.has(relative)) throw Error('Missing runtime media: '+relative);
    const source=await describe(sourceRoot,relative);
    const runtime=await describe(distAssetsRoot,relative,true);
    if(source.alpha&&!runtime.alpha) throw Error('Transparency lost: '+relative);
    mappings.push({logicalPath:relative,runtimePath:'/assets/'+relative.split('/').map(encodeURIComponent).join('/'),originalBlob:object('originals',source),runtimeBlob:object('variants',runtime),provenance:'source-path'});
  }
  for(const relative of runtimeFiles){
    if(originalSet.has(relative)) continue;
    const runtime=await describe(distAssetsRoot,relative,true);
    // Existing aliases/variants can be inventoried but not attributed to an original by filename guess.
    mappings.push({logicalPath:relative,runtimePath:'/assets/'+relative.split('/').map(encodeURIComponent).join('/'),originalBlob:null,runtimeBlob:object('variants',runtime),provenance:'unverified-runtime-only'});
  }
  return {schemaVersion:1,projectId,mode:'local-plan-only',publicationAllowed:false,remoteState:'not-checked',sourceCount:originals.length,runtimeCount:runtimeFiles.length,unverifiedProvenance:mappings.filter(x=>!x.originalBlob).length,objects:[...objects.values()].sort((a,b)=>a.blobKey.localeCompare(b.blobKey)),mappings};
}

async function main(){
  const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  sharp.cache(false);sharp.concurrency(1);
  const projectId=process.argv[2];
  if(process.argv.length!==3) throw Error('Usage: node tools/plan-project-media.mjs <project-id> (stdout only)');
  const plan=await createMediaPlan({projectId,sourceRoot:path.join(app,'..','assets'),distAssetsRoot:path.join(app,'dist','assets')});
  process.stdout.write(JSON.stringify(plan,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await main();
