#!/usr/bin/env node
// Non-destructive browser smoke + memory baseline. Never point at a live Azure URL.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "http://127.0.0.1:4187";
const routes = ["/", "/pricing", "/projects", "/projects/vinhomes-saigon-park",
  "/projects/vinhomes-saigon-park/overview", "/projects/vinhomes-saigon-park/detail"];
const outputDir = resolve(app, "browser-check-output");
const sampleCount = 3;
const results = { createdAt: new Date().toISOString(), mode: "local-mock-data", routes: [], memory: [],
  notes: ["Local preview only. No production credentials or remote state are used.",
    "Browser heap measurements are diagnostic trends, not proof of a leak or a safe memory limit."] };
const viteCli = resolve(app, "node_modules/vite/bin/vite.js");
let server;
let browser;
let stderr = "";

function checkSafety() {
  for (const key of ["VITE_PROJECT_STATE_URL", "VITE_STATE_API_BASE_URL", "AZURE_STORAGE_CONNECTION_STRING"]) {
    if (process.env[key]) throw new Error(`Refusing browser test because ${key} is set. Run without cloud credentials.`);
  }
  if (process.env.PLOTFLOW_BROWSER_BASE_URL) throw new Error("External browser base URLs are prohibited.");
}
async function awaitPreview() {
  for (let i = 0; i < 70; i++) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited: ${stderr.slice(-500)}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return;
    } catch { /* waiting for local server */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Vite preview timeout: ${stderr.slice(-500)}`);
}
async function snapshot(page, session, label) {
  // CDP provides the same counters on Chromium; they are intentionally not hard thresholds.
  const metrics = await session.send("Performance.getMetrics");
  const values = Object.fromEntries(metrics.metrics.map(m => [m.name, m.value]));
  const dom = await page.evaluate(() => ({
    nodes: document.getElementsByTagName("*").length,
    images: document.images.length,
    canvases: document.querySelectorAll("canvas").length,
    tiles: document.querySelectorAll(".pf-overview-raster-tile").length,
  }));
  results.memory.push({
    label, route: new URL(page.url()).pathname,
    heapUsedMb: Number(((values.JSHeapUsedSize || 0) / 1048576).toFixed(1)),
    heapTotalMb: Number(((values.JSHeapTotalSize || 0) / 1048576).toFixed(1)), ...dom,
  });
}
async function checkRoute(page, route) {
  const exceptions = [];
  const capture = error => exceptions.push(String(error.message || error).slice(0, 300));
  page.on("pageerror", capture);
  try {
    const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()} for ${route}`);
    await page.locator("#root").waitFor({ state: "attached", timeout: 15000 });
    await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").trim().length > 20,
      null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const text = (await page.locator("#root").innerText()).trim();
    if (exceptions.length) throw new Error(`Uncaught browser errors: ${exceptions.join(" | ")}`);
    const record = { route, ok: true, title: await page.title(), renderedTextLength: text.length };
    results.routes.push(record);
    return record;
  } catch (error) {
    results.routes.push({ route, ok: false, error: String(error.message || error).slice(0, 650) });
    throw error;
  } finally {
    page.off("pageerror", capture);
  }
}
checkSafety();
try {
  const { chromium } = await import(process.env.PLOTFLOW_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLOTFLOW_PLAYWRIGHT_MODULE).href : "playwright");
  server = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", "4187", "--strictPort"],
    { cwd: app, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
      VITE_PROJECT_STATE_URL: "", VITE_STATE_API_BASE_URL: "" } });
  server.stderr.on("data", data => { stderr += String(data).slice(-500); });
  await awaitPreview();
  browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  // Never allow a browser request to a remote service, including a stale baked URL.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === base && ["GET","HEAD"].includes(route.request().method()) ? route.continue() : route.abort();
  });
  await context.routeWebSocket("**/*", ws => ws.close());
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  for (const route of routes) await checkRoute(page, route);
  await snapshot(page, session, "after-route-smoke");
  await checkRoute(page, "/projects/vinhomes-saigon-park/overview");
  const rasterStage=page.locator('[data-overview-render-mode="raster"]').first();
  await rasterStage.waitFor({state:"visible",timeout:20000});
  await page.waitForFunction(()=>{const s=window.__plotflowOverviewRuntime;return s?.activeTiles>0&&s.pendingTiles===0;},null,{timeout:20000});
  results.raster=[];
  for(const camera of [{scale:1,tx:0,ty:0},{scale:4,tx:-250,ty:-100},{scale:4,tx:-450,ty:-250},{scale:1,tx:0,ty:0}]){
    await page.evaluate(c=>window.dispatchEvent(new CustomEvent("pf-overview-camera",{detail:{...c,dragging:false}})),camera);
    await page.waitForTimeout(350);
    await page.waitForFunction(()=>{const s=window.__plotflowOverviewRuntime;return s?.activeTiles>0&&s.pendingTiles===0;},null,{timeout:20000});
    const s=await page.evaluate(()=>({...window.__plotflowOverviewRuntime}));
    results.raster.push({camera,level:s.currentLevel,activeTiles:s.activeTiles,tileCeiling:s.tileCeiling,failedTiles:s.failedTiles,multiLevelOverlap:s.multiLevelOverlap});
    if(s.failedTiles||s.multiLevelOverlap||s.activeTiles>s.tileCeiling)throw Error("Raster runtime failed settled bounds or tile load checks");
    await snapshot(page,session,"raster-camera-"+results.raster.length);
  }
  // A diagnostic loop over non-mutating views; does not click Save, connect Sheets or export.
  for (let cycle = 1; cycle <= sampleCount; cycle++) {
    for (const route of ["/projects/vinhomes-saigon-park/overview", "/projects/vinhomes-saigon-park/detail"]) {
      await checkRoute(page, route);
    }
    await snapshot(page, session, `navigation-cycle-${cycle}`);
  }
  await context.close();
  console.log(`Browser smoke passed: ${results.routes.length} route visits; ${results.memory.length} memory samples`);
} catch (error) {
  results.error = String(error.stack || error).slice(0, 2000);
  console.error(results.error);
  process.exitCode = 1;
} finally {
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "browser-smoke-memory.json"), JSON.stringify(results, null, 2));
  await browser?.close().catch(() => {});
  if (server) { server.kill("SIGTERM"); }
}
