import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(app,'dist');
const master=path.join(dist,'masterplan');
const manifest=JSON.parse(fs.readFileSync(path.join(master,'generated','manifest.json'),'utf8'));
const report={mode:'read-only-built-masterplan',pageLevels:[],lotTileDeclarations:0,lotTileMissing:0,lotRasterMissing:0,lotRasterReferences:0,tlHyphenIndex:null,issues:[],pdf:null};
const max=25*1024*1024;
const runtime={width:42000,height:29709,tileSize:512,levels:[1800,2625,5250,10500,21000,42000]};
sharp.cache(false);sharp.concurrency(1);
function asset(url){
  if(typeof url!=='string'||!url.startsWith('/masterplan/')||/[?#\\]/.test(url))throw Error('Invalid masterplan asset path');
  const decoded=decodeURIComponent(url);
  if(decoded.split('/').some(s=>s==='..'||s==='.')||decoded.includes('\\'))throw Error('Unsafe masterplan asset path');
  const result=path.resolve(dist,'.'+decoded);
  if(!result.startsWith(master+path.sep))throw Error('Asset escapes masterplan');
  return result;
}
function exists(p){try{return fs.statSync(p).isFile()&&fs.statSync(p).size>0;}catch{return false;}}
async function digest(p){const h=createHash('sha256');for await(const b of fs.createReadStream(p))h.update(b);return h.digest('hex');}
const source=path.resolve(app,'..','masterplan','masterplan.pdf');
const pdf=path.join(master,'masterplan.pdf');
if(!exists(source)||!exists(pdf))throw Error('Missing masterplan PDF source or built copy');
const fd=fs.openSync(pdf,'r');const header=Buffer.alloc(5);try{fs.readSync(fd,header,0,5,0);}finally{fs.closeSync(fd);}
if(header.toString()!=='%PDF-')throw Error('Built masterplan is not a PDF');
const sourceHash=await digest(source),builtHash=await digest(pdf);
report.pdf={bytes:fs.statSync(pdf).size,sha256:builtHash,sourceMatches:sourceHash===builtHash,headerValid:true};
if(!report.pdf.sourceMatches)throw Error('Built PDF differs from original');
const tlIndexPath=path.join(master,'generated','tl-hyphen-index.json');
if(!exists(tlIndexPath))throw Error('Missing bundled TL hyphen index');
const tlIndex=JSON.parse(fs.readFileSync(tlIndexPath,'utf8'));
const tlCodes=new Set();
const indexPage=manifest.pages?.[String(tlIndex.pageNumber)];
if(tlIndex.version!==1||tlIndex.codePatternVersion!==2||!Array.isArray(tlIndex.entries)
  ||tlIndex.count!==tlIndex.entries.length||tlIndex.entries.length!==57)throw Error('Invalid bundled TL hyphen index schema/count');
if(!indexPage||Math.abs(Number(indexPage.width)-Number(tlIndex.pageSize?.width))>0.05
  ||Math.abs(Number(indexPage.height)-Number(tlIndex.pageSize?.height))>0.05)throw Error('TL hyphen index page coordinates do not match bundled masterplan');
const numericTlCodes=Object.keys(manifest.index||{}).filter((code)=>/^TL\\d{1,5}-\\d{1,5}$/.test(code)).sort();
let numericTlHash=2166136261;
for(const char of numericTlCodes.join('\\n')){numericTlHash^=char.charCodeAt(0);numericTlHash=Math.imul(numericTlHash,16777619)>>>0;}
const numericTlHashHex=(numericTlHash>>>0).toString(16);
if(numericTlCodes.length!==Number(tlIndex.baseNumericTlIndex?.count)
  ||numericTlHashHex!==tlIndex.baseNumericTlIndex?.sortedKeyHash)throw Error('Existing numeric TL index differs from the supplied source PDF');
for(const entry of tlIndex.entries){
  const code=String(entry.unitCode||'');
  const b=entry.bbox||{};
  if(!/^TL-\d{1,5}$/.test(code)||tlCodes.has(code)
    ||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite)
    ||b.x0<0||b.y0<0||b.x1<=b.x0||b.y1<=b.y0
    ||b.x1>Number(indexPage.width)||b.y1>Number(indexPage.height))throw Error('Invalid TL hyphen locator entry: '+code);
  tlCodes.add(code);
}
report.tlHyphenIndex={count:tlCodes.size,baseNumericTlCount:numericTlCodes.length,baseNumericTlHash:numericTlHashHex,sourcePdf:tlIndex.sourcePdf,sourceSha256:tlIndex.sourceSha256,pageCoordinateMatch:true};
const page=manifest.pages?.['1'];
if(!page?.tiles)throw Error('Missing page-1 pyramid declaration');
const pyramid=page.tiles;
if(pyramid.base!=='/masterplan/generated/page-tiles/page-1'||pyramid.tileSize!==runtime.tileSize||pyramid.sourceWidth!==runtime.width||pyramid.sourceHeight!==runtime.height)throw Error('Page pyramid and Overview runtime constants differ');
if(JSON.stringify(pyramid.levels.map(l=>l.width))!==JSON.stringify(runtime.levels))throw Error('Page level widths differ from Overview runtime');
for(const level of pyramid.levels){
  const {width,height,cols,rows,tileSize}=level;
  if(height!==Math.round(runtime.height*width/runtime.width)||tileSize!==runtime.tileSize||cols!==Math.ceil(width/tileSize)||rows!==Math.ceil(height/tileSize))throw Error('Invalid page tile grid: '+width);
  const stat={width,height,expected:cols*rows,checked:0,bytes:0,missing:0,invalid:0};
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const p=asset(pyramid.base+'/'+width+'/'+x+'_'+y+'.webp');
    if(!exists(p)){stat.missing++;continue;}
    try{
      const size=fs.statSync(p).size;
      const meta=await sharp(p,{limitInputPixels:1024*1024}).metadata();
      if(size>max||meta.format!=='webp'||meta.width!==Math.min(tileSize,width-x*tileSize)||meta.height!==Math.min(tileSize,height-y*tileSize))throw Error('Invalid tile dimensions or format');
      stat.checked++;stat.bytes+=size;
    }catch{stat.invalid++;}
  }
  report.pageLevels.push(stat);
  console.log('[page-tiles]',JSON.stringify(stat));
}
for(const lot of Object.values(manifest.lots||{})){
  for(const key of ['preview','medium','detail']){
    if(!lot[key])continue;
    report.lotRasterReferences++;
    try{if(!exists(asset(lot[key])))report.lotRasterMissing++;}catch{report.lotRasterMissing++;}
  }
  if(!lot.tiles)continue;
  report.lotTileDeclarations++;
  for(const l of lot.tiles.levels||[]){
    if(!Number.isInteger(l.rows)||!Number.isInteger(l.cols)||l.rows<1||l.cols<1||l.rows*l.cols>10000)throw Error('Invalid lot tile grid');
    for(let y=0;y<l.rows;y++)for(let x=0;x<l.cols;x++){
      try{if(!exists(asset(lot.tiles.base+'/'+l.width+'/'+x+'_'+y+'.webp')))report.lotTileMissing++;}catch{report.lotTileMissing++;}
    }
  }
}
if(report.lotRasterMissing||report.lotTileMissing)report.issues.push('Declared lot assets missing; runtime fallback must be reviewed before release.');
if(!report.lotTileDeclarations)report.issues.push('No declared lot tile pyramids; Detail/Fine Tune fallback remains unverified.');
fs.writeFileSync(path.join(app,'masterplan-audit-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('[masterplan-audit]',JSON.stringify({pageLevels:report.pageLevels.length,pageTiles:report.pageLevels.reduce((n,x)=>n+x.checked,0),pageMissing:report.pageLevels.reduce((n,x)=>n+x.missing,0),pageInvalid:report.pageLevels.reduce((n,x)=>n+x.invalid,0),lotTileDeclarations:report.lotTileDeclarations,lotTileMissing:report.lotTileMissing,lotRasterReferences:report.lotRasterReferences,lotRasterMissing:report.lotRasterMissing,tlHyphenCodes:report.tlHyphenIndex.count,pdfSourceMatches:report.pdf.sourceMatches,issues:report.issues}));
if(report.pageLevels.some(l=>l.missing||l.invalid))throw Error('Page pyramid incomplete or invalid');
