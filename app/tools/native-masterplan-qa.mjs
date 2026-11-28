import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// Run from PlotFlow/app. No build, no asset regeneration, no deployment.
const app = process.cwd();
const expected = '1a7f0462b384321487c8eaafc45e66853e797a4a5bb3198f633cb8d4d5ee1dfa';
const load = p => import(pathToFileURL(path.join(app,p)).href);
const require = createRequire(path.join(app,'package.json'));
const sharp = require('sharp');
const { mergeTlHyphenIndex } = await load('src/floorplan/mergeTlHyphenIndex.js');
const { detectLotShapeFromImageData } = await load('src/floorplan/autoLotShape.js');
const sha = b => createHash('sha256').update(b).digest('hex');
const read = async p => JSON.parse(await fs.readFile(p,'utf8'));
const out = path.join(app,'auto-lot-shape-samples');
await fs.mkdir(out,{recursive:true});
const report = { mode:'native-masterplan-qa', output:out, checks:{}, samples:[], issues:[] };
const publicDir = path.join(app,'public/masterplan/generated');
const dist = path.join(app,'dist');
const builtDir = path.join(dist,'masterplan/generated');
const codes = ['AS48A-54','AS80-03','AS69-18','TL12-05','TL-01','TL-81','TL30-01','TL31-02'];
try {
  const pdf = path.resolve(app,'../masterplan/masterplan.pdf');
  const sourceHash = sha(await fs.readFile(pdf));
  assert.equal(sourceHash,expected,'Wrong source PDF');
  assert.equal(sha(await fs.readFile(path.join(app,'public/masterplan/masterplan.pdf'))),expected,'Public PDF differs');
  const publicBytes = await fs.readFile(path.join(publicDir,'manifest.json'));
  const builtBytes = await fs.readFile(path.join(builtDir,'manifest.json'));
  assert.equal(sha(publicBytes),sha(builtBytes),'Public and dist manifest differ');
  const raw = JSON.parse(builtBytes);
  assert.equal(raw.nativeCoordinateSource?.pdfSha256,expected,'Native provenance missing');
  assert.equal(raw.nativeCoordinateSource?.renderer,'pymupdf','Unexpected renderer');
  assert.equal(Object.keys(raw.index).length,10427,'Unexpected index count');
  const p = raw.pages['1'];
  assert.equal(p.tiles.sourceWidth,42000);
  assert.equal(p.tiles.sourceHeight,29709);
  const hires = await read(path.join(app,'tools/masterplan-native-source.json'));
  assert.equal(hires.sourceSha256?.toLowerCase(),expected,'Hires provenance mismatch');
  assert.equal(hires.renderer,'pymupdf');
  const supplement = await read(path.join(builtDir,'tl-hyphen-index.json'));
  const m = mergeTlHyphenIndex(raw,supplement);
  report.checks = { pdfSha256:sourceHash, manifestSha256:sha(builtBytes), indexCount:Object.keys(m.index).length, calibration:'PASS', missingLegacyCodes:supplement.entries.filter(e=>!m.index[e.unitCode]?.length).map(e=>e.unitCode) };
  console.log('PASS: source PDF, hires provenance, public/dist, native calibration, index');
  const level = p.tiles.levels.find(l=>l.width===42000);
  assert.ok(level,'Missing max-resolution level');
  const base = path.resolve(dist,'.'+p.tiles.base);
  assert.ok(base.startsWith(dist+path.sep),'Unsafe tile base');
  let checked=0;
  for (const l of p.tiles.levels) {
    assert.equal(l.cols,Math.ceil(l.width/l.tileSize));
    assert.equal(l.rows,Math.ceil(l.height/l.tileSize));
    for(let row=0;row<l.rows;row++) for(let col=0;col<l.cols;col++) {
      const f=path.join(base,String(l.width),`${col}_${row}.webp`);
      const st=await fs.stat(f);
      assert.ok(st.isFile()&&st.size>0&&st.size<=25*1024*1024,'Invalid tile: '+f);
      const meta = await sharp(f).metadata();
      assert.equal(meta.format, 'webp');
      assert.equal(meta.width,
        Math.min(l.tileSize, l.width-col*l.tileSize));
      assert.equal(meta.height,
        Math.min(l.tileSize, l.height-row*l.tileSize));
      checked++;
    }
  }
  assert.equal(checked,6596);
  report.checks.tileFiles=checked;
  console.log('PASS: '+checked+' tile files present');
  const sx=level.width/p.width, sy=level.height/p.height, t=level.tileSize;
  for (const code of codes) {
    try {
      const matches=m.index[code]||[];
      assert.ok(matches.length,'Missing code in native index');
      const a=matches[0];
      const x=a.bbox?(a.bbox.x0+a.bbox.x1)/2:Number(a.x)+Number(a.width)/2;
      const y=a.bbox?(a.bbox.y0+a.bbox.y1)/2:p.height-Number(a.y)-Number(a.height)/2;
      assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>0&&x<p.width&&y>0&&y<p.height,'Invalid anchor');
      // A small high-resolution neighborhood, not the old full-page crop.
      const x0=Math.max(0,Math.floor((x-12)*sx)), y0=Math.max(0,Math.floor((y-9)*sy));
      const x1=Math.min(level.width,Math.ceil((x+12)*sx)),y1=Math.min(level.height,Math.ceil((y+9)*sy));
      const w=x1-x0,h=y1-y0,layers=[];
      for(let row=Math.floor(y0/t);row<=Math.floor((y1-1)/t);row++) for(let col=Math.floor(x0/t);col<=Math.floor((x1-1)/t);col++) {
        const left=Math.max(x0,col*t),top=Math.max(y0,row*t),right=Math.min(x1,(col+1)*t),bottom=Math.min(y1,(row+1)*t);
        const input=await sharp(path.join(base,String(level.width),`${col}_${row}.webp`)).extract({left:left-col*t,top:top-row*t,width:right-left,height:bottom-top}).png().toBuffer();
        layers.push({input,left:left-x0,top:top-y0});
      }
      const png=await sharp({create:{width:w,height:h,channels:3,background:'#fff'}}).composite(layers).png().toBuffer();
      const image=await sharp(png).resize({width:720}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const W=image.info.width,H=image.info.height;
      const anchor={x:(x*sx-x0)/w,y:(y*sy-y0)/h};
      const result=await detectLotShapeFromImageData({data:new Uint8ClampedArray(image.data),width:W,height:H},anchor);
      const shape=result.shape?.points||[];
      const polygon=shape.length?`<polygon points="${shape.map(q=>`${q.x*(W-1)},${q.y*(H-1)}`).join(' ')}" fill="${result.accepted?'#00aa66':'#ff8800'}" fill-opacity="0.22" stroke="${result.accepted?'#008844':'#ff8800'}" stroke-width="2"/>`:'';
      const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${polygon}<circle cx="${anchor.x*(W-1)}" cy="${anchor.y*(H-1)}" r="4" fill="#ff1744" stroke="white" stroke-width="1.5"/></svg>`);
      const raw={width:W,height:H,channels:4};
      await sharp(image.data,{raw}).png().toFile(path.join(out,`${code}-raw.png`));
      await sharp(image.data,{raw}).composite([{input:svg}]).png().toFile(path.join(out,`${code}-shape.png`));
      const sample={code,accepted:result.accepted,confidence:result.confidence,vertices:result.vertices||0,reason:result.reason,anchorPdf:{x,y},matchCount:matches.length};
      report.samples.push(sample);
      console.log('[SHAPE]',JSON.stringify(sample));
    } catch(e) {
      report.samples.push({code,accepted:false,error:e.message});
      console.log('[SHAPE]',code,'ERROR:',e.message);
    }
  }
  const accepted=report.samples.filter(s=>s.accepted).length;
  console.log(`Auto Lot Shape candidates: ${accepted}/${codes.length} accepted; VISUAL REVIEW REQUIRED`);
  if(accepted!==codes.length) report.issues.push('Some sample shapes were rejected; do not treat as a release pass.');
  if(report.checks.missingLegacyCodes.length) report.issues.push('Some legacy supplement codes are absent from native index. Verify against new PDF; do not reuse legacy coordinates.');
} catch(e) {
  report.issues.push(e.message);
  console.error('FAIL:',e.message);
  process.exitCode=1;
} finally {
  if(report.issues.length) process.exitCode=1;
  await fs.writeFile(path.join(out,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('REPORT:',path.join(out,'qa-report.json'));
  console.log('OUTPUT:',out);
}
