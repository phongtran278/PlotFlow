import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {findBestMasterplanTileSource,renderTileRegionToBuffer} from '../masterplan-tile-source.mjs';

test('tile source selects complete pyramid and renders a cross-tile crop without gaps',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'plotflow-tiles-'));
  try{
    const good=path.join(root,'complete'),bad=path.join(root,'missing');
    fs.mkdirSync(good);fs.mkdirSync(bad);
    await sharp({create:{width:64,height:64,channels:3,background:'#ff0000'}}).png().toFile(path.join(good,'red.png'));
    await sharp({create:{width:64,height:64,channels:3,background:'#0000ff'}}).png().toFile(path.join(good,'blue.png'));
    fs.writeFileSync(path.join(good,'manifest.json'),JSON.stringify({canvas:{width:128,height:64},coverageValid:true,tiles:[{file:'red.png',x0:0,y0:0,x1:64,y1:64},{file:'blue.png',x0:64,y0:0,x1:128,y1:64}]}));
    fs.writeFileSync(path.join(bad,'manifest.json'),JSON.stringify({canvas:{width:256,height:128},coverageValid:true,tiles:[{file:'missing.png',x0:0,y0:0,x1:256,y1:128}]}));
    const source=findBestMasterplanTileSource([root]);
    assert.equal(source.width,128);
    const crop=await renderTileRegionToBuffer(sharp,source,{left:32,top:8,width:64,height:32},64);
    const {data,info}=await sharp(crop).removeAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,64);assert.equal(info.height,32);
    const pixel=(x,y)=>Array.from(data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3));
    assert.deepEqual(pixel(15,15),[255,0,0]);assert.deepEqual(pixel(48,15),[0,0,255]);
    assert.deepEqual(pixel(31,15),[255,0,0]);assert.deepEqual(pixel(32,15),[0,0,255]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
