import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLfsPointer,classify} from './inventory-lfs-media.mjs';
const oid='a'.repeat(64);
test('canonical pointer exposes original size and SHA without object download',()=>{
 const p=Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:'+oid+'\nsize 123456789\n');
 assert.deepEqual(parseLfsPointer(p),{sha256:oid,bytes:123456789});
});
test('nonpointer and invalid pointer are not accepted',()=>{
 assert.equal(parseLfsPointer(Buffer.from('%PDF-1.7')),null);
 assert.equal(parseLfsPointer(Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:wrong\nsize 10\n')),null);
});
test('reject unsafe sizes',()=>{
 assert.throws(()=>parseLfsPointer(Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:'+oid+'\nsize 9999999999999999999999999\n')),/Invalid LFS size/);
});
test('classify resource paths without assigning speculative runtime aliases',()=>{
 assert.equal(classify('app/public/masterplan/generated/page-tiles/page-1/42000/0_0.webp'),'page-tiles');
 assert.equal(classify('masterplan/masterplan.pdf'),'masterplan');
 assert.equal(classify('assets/houses/a.png'),'source-assets');
 assert.equal(classify('references/ref.png'),'legacy-or-reference');
});
