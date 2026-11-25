import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

test('media optimizer preserves original, URL, alpha, and tiles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plotflow-media-'));
  try {
    const tools = path.join(root, 'tools');
    fs.mkdirSync(tools);
    fs.symlinkSync(fileURLToPath(new URL('../../node_modules', import.meta.url)), path.join(root, 'node_modules'), 'dir');
    const source = fileURLToPath(new URL('../optimize-built-media.mjs', import.meta.url));
    fs.copyFileSync(source, path.join(tools, 'optimize-built-media.mjs'));
    const originals = path.join(root, 'originals');
    const dist = path.join(root, 'dist');
    fs.mkdirSync(originals);
    const house = path.join(dist, 'assets/houses');
    const alias = path.join(dist, 'assets/library/houses');
    const tiles = path.join(dist, 'masterplan/tiles');
    for (const dir of [house, alias, tiles]) fs.mkdirSync(dir, {recursive: true});
    const width=640, height=960;
    const raw=Buffer.alloc(width*height*4);
    let seed=123456;
    for(let i=0;i<raw.length;i+=4) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      raw[i]=seed>>>24;raw[i+1]=seed>>>16;raw[i+2]=seed>>>8;raw[i+3]=(i%16===0)?0:255;
    }
    const input=await sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer();
    const original=path.join(originals,'house.png');
    fs.writeFileSync(original,input);
    const files=[path.join(house,'house.png'),path.join(alias,'house.png')];
    for (const f of files) fs.writeFileSync(f,input);
    const tile=path.join(tiles,'tile.png');
    fs.writeFileSync(tile,input);
    const command=spawnSync(process.execPath,[path.join(tools,'optimize-built-media.mjs')],{
      env:{...process.env,PLOTFLOW_MEDIA_MAX_WIDTH:'400',PLOTFLOW_MEDIA_TARGET_MIB:'0.1'},
      encoding:'utf8'
    });
    assert.equal(command.status,0,command.stdout+'\n'+command.stderr);
    for(const f of files){
      const info=await sharp(f).metadata();
      assert.equal(info.format,'png');
      assert.equal(info.hasAlpha,true);
      assert.ok(Math.max(info.width,info.height)<=400);
      assert.ok(fs.statSync(f).size<input.length);
    }
    assert.deepEqual(fs.readFileSync(original),input);
    assert.deepEqual(fs.readFileSync(tile),input);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
