import test from "node:test";
import assert from "node:assert/strict";
import {cropToPagePoints,pageToStage,stageToPage,addAutoShape} from "../src/product/overviewAutoShapeGeometry.js";
const page={width:2000,height:1400},crop={x:500,y:300,w:24,h:18};
const pts=[{x:.2,y:.2},{x:.8,y:.2},{x:.9,y:.5},{x:.7,y:.8},{x:.2,y:.8}];
test("five corners preserve page geometry through resize and letterboxing",()=>{
 const p=cropToPagePoints(pts,crop,page);
 assert.equal(p.length,5);
 assert.equal(p[0].x,(500+.2*24)/2000);
 for(const b of [{x:100,y:0,width:800,height:560,stageWidth:1000,stageHeight:560},{x:0,y:50,width:600,height:420,stageWidth:600,stageHeight:520}]) {
  for(const q of p){const v=stageToPage(pageToStage(q,b),b);assert.ok(Math.abs(v.x-q.x)<1e-12&&Math.abs(v.y-q.y)<1e-12);}
 }
});
test("four corners and invalid geometry",()=>{
 assert.equal(cropToPagePoints(pts.slice(0,4),crop,page).length,4);
 assert.throws(()=>cropToPagePoints(pts,{...crop,w:0},page));
 assert.throws(()=>cropToPagePoints([{x:NaN,y:0},...pts],crop,page));
 assert.throws(()=>pageToStage(pts[0],{x:0,y:0,width:0,height:1,stageWidth:1,stageHeight:1}));
});
test("auto shape never replaces manual shape or existing refined auto shape",()=>{
 const manual={id:"manual",points:pts};const auto={id:"a",unitCode:"TL-01",autoSource:"native-masterplan",points:pts};
 const first=addAutoShape([manual],auto);assert.equal(first.shapes.length,2);assert.equal(first.shapes[0],manual);
 const second=addAutoShape(first.shapes,{...auto,id:"b",points:[]});assert.equal(second.shapes,first.shapes);assert.equal(second.id,"a");
});
