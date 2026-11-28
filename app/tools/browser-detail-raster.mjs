import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:4188';
const report={mode:'isolated-source-module-with-real-built-page-tiles',cases:[]};
const sourceFiles=new Set(['floorplan/pdfLocatorRuntimeStrict.js','floorplan/floorplanGeometry.js','floorplan/pdfLocatorFacade.js','floorplan/unitCodeCompat.js','runtime/memoryProfile.js']);
for(const key of ['VITE_PROJECT_STATE_URL','VITE_STATE_API_BASE_URL','AZURE_STORAGE_CONNECTION_STRING'])if(process.env[key])throw Error('Cloud environment is forbidden');
let server,browser;
try{
 const {chromium}=await import(pathToFileURL(process.env.PLOTFLOW_PLAYWRIGHT_MODULE).href);
 server=spawn(process.execPath,[resolve(app,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4188','--strictPort'],{cwd:app,stdio:'ignore'});
 for(let n=0;n<80;n++){
  if(server.exitCode!==null)throw Error('Preview stopped');
  try{if((await fetch(base,{signal:AbortSignal.timeout(500)})).ok)break;}catch{}
  if(n===79)throw Error('Preview not ready');
  await new Promise(r=>setTimeout(r,250));
 }
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 const requests=[];let failTile=false;
 await context.routeWebSocket('**/*',ws=>ws.close());
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!==base||!['GET','HEAD'].includes(req.method()))return route.abort();
  if(u.pathname==='/__qa__/'){return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Raster QA</title>'});}
  if(u.pathname.startsWith('/__qa__/')){
   const relative=u.pathname.slice('/__qa__/'.length);
   if(!sourceFiles.has(relative))return route.abort();
   return route.fulfill({contentType:'text/javascript',body:await readFile(resolve(app,'src',relative),'utf8')});
  }
  if(u.pathname.startsWith('/masterplan/generated/page-tiles/')){
   requests.push(u.pathname);if(failTile){failTile=false;return route.fulfill({status:404,body:'synthetic missing tile'});}
   return route.continue();
  }
  if(u.pathname==='/masterplan/generated/manifest.json')return route.continue();
  return route.abort();
 });
 const page=await context.newPage();await page.goto(base+'/__qa__/');
 await page.evaluate(async()=>{
  const m=await import('/__qa__/floorplan/pdfLocatorRuntimeStrict.js');
  const manifest=await (await fetch('/masterplan/generated/manifest.json')).json();
  const info=manifest.pages['1'];
  window.qa={m,make:(scale=1,code='qa-a')=>({__plotflowPrepared:true,pageNumber:1,unitCode:code,width:info.width*scale,height:info.height*scale,scale,anchorX:info.width*scale/2,anchorY:info.height*scale/2}),stats:()=>({...window.__plotflowRasterRuntime})};
 });
 const run=async (scale,code,view,options)=>page.evaluate(async({scale,code,view,options})=>{
  const q=window.qa,r=await q.m.renderPdfRegion(null,q.make(scale,code),view,options);
  if(!r?.dataUrl)throw Error('No raster result');
  const blob=await(await fetch(r.dataUrl)).blob(),bitmap=await createImageBitmap(blob);
  const result={width:bitmap.width,height:bitmap.height,tier:r.preparedTier,pdfFree:r.pdfFreeRuntime,stable:Boolean(r.stablePreview),stats:q.stats()};bitmap.close();return result;
 },{scale,code,view,options});
 const preview={outputWidth:1084,includeHighlight:false},fine={outputWidth:1640,maxRenderScale:128,includeHighlight:false};
 const v={zoom:250,offsetX:0,offsetY:0};
 let result=await run(1,'qa-a',v,preview);
 assert.ok(result.pdfFree&&result.stable&&result.width===1084);assert.equal(result.stats.tileBitmapsActive,0);report.cases.push({name:'detail',...result});
 const first=requests.splice(0);
 result=await run(2,'qa-b',v,preview);
 assert.deepEqual(requests.splice(0),first);assert.equal(result.stats.tileBitmapsActive,0);report.cases.push({name:'scaled coordinates',...result});
 const embedded=await page.evaluate(async()=>{
  const q=window.qa;
  const r=await q.m.renderPdfRegion(null,q.make(),{zoom:250},{outputWidth:1084,independent:true,embedForExport:true});
  const img=new Image();img.src=r.dataUrl;await img.decode();
  return {inline:r.dataUrl.startsWith('data:image/png;'),width:img.naturalWidth};
 });
 assert.deepEqual(embedded,{inline:true,width:1084});
 report.cases.push({name:'self-contained export crop',...embedded});
 for(let i=0;i<4;i++){
  result=await run(1,'qa-'+i,{zoom:350+i*50,offsetX:10*i,offsetY:0},fine);
  assert.ok(result.pdfFree&&result.width<=1280);assert.equal(result.stats.tileBitmapsActive,0);assert.ok(result.stats.stablePreviewUrls<=2);report.cases.push({name:'fine-tune-'+i,...result});
 }
 failTile=true;
 const failure=await page.evaluate(async()=>{const q=window.qa;try{await q.m.renderPdfRegion(null,q.make(),{zoom:400},{outputWidth:1640,maxRenderScale:128});return false;}catch{return q.stats().tileBitmapsActive===0;}});
 assert.equal(failure,true);
 result=await run(1,'qa-retry',v,fine);assert.equal(result.stats.tileBitmapsActive,0);report.cases.push({name:'retry after tile failure',...result});
 const cancelled=await page.evaluate(async()=>{const q=window.qa;const pending=q.m.renderPdfRegion(null,q.make(),{zoom:500},{outputWidth:1640,maxRenderScale:128});q.m.releasePreparedDetailRaster();return {result:await pending,stats:q.stats()};});
 assert.equal(cancelled.result,null);assert.equal(cancelled.stats.activeViewportUrls,0);assert.equal(cancelled.stats.tileBitmapsActive,0);
 assert.equal(cancelled.stats.pdfRuntimeLoaded,false);assert.equal(cancelled.stats.bundledPdfOpened,false);
 report.cases.push({name:'cancel and release',stats:cancelled.stats});
 await context.close();console.log('Detail raster QA passed: '+report.cases.length+' cases');
}catch(error){report.error=String(error.stack||error);console.error(report.error);process.exitCode=1;}
finally{await mkdir(resolve(app,'browser-check-output'),{recursive:true});await writeFile(resolve(app,'browser-check-output/detail-raster.json'),JSON.stringify(report,null,2));await browser?.close().catch(()=>{});server?.kill('SIGTERM');}
