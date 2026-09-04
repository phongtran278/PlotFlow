import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const UNIT_CODE_RE = /[A-Z]{1,8}\d{1,5}-\d{1,5}/g;
const PREVIEW_RENDER_MAX_WIDTH = 640;
const RASTER_DB_NAME = "plotflow-raster-cache-v1";
const RASTER_DB_VERSION = 1;
const RASTER_STORE = "assets";
const CACHE_SCHEMA = "raster-first-v1";

const screenPreviewCache = new Map();
const objectUrlCache = new Map();
let activePdfDoc = null;
let activePdfPromise = null;
let activeReleaseTimer = null;
let activeInteractiveRenderTask = null;
let lastPdfSource = null;
let lastPdfSourceKey = "";

export const FLOORPLAN_ZOOM_MIN = 50;
export const FLOORPLAN_ZOOM_MAX = 2000;
export const FLOORPLAN_FRAME_WIDTH = 506;
export const FLOORPLAN_FRAME_HEIGHT = 390;
export const FLOORPLAN_FRAME_ASPECT = FLOORPLAN_FRAME_WIDTH / FLOORPLAN_FRAME_HEIGHT;

function memoryProfile() {
  return getMemoryProfile();
}

function previewCacheLimit() {
  return Math.max(1, Number(memoryProfile().previewCacheTarget) || 2);
}

function objectUrlLimit() {
  return Math.max(1, Number(memoryProfile().objectUrlTarget) || 2);
}

function pdfIdleReleaseMs() {
  return Math.max(250, Number(memoryProfile().pdfIdleReleaseMs) || 4000);
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function scheduleIdleRender() {
  if (typeof requestIdleCallback === "function") {
    return new Promise((resolve) => requestIdleCallback(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 40));
}

function sourceKey(source) {
  if (typeof source === "string") return `url:${resolvePdfSourceUrl(source)}`;
  if (source?.name) return `file:${source.name}:${source.size || 0}:${source.lastModified || 0}`;
  return "unknown";
}

function openRasterDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(RASTER_DB_NAME, RASTER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RASTER_STORE)) db.createObjectStore(RASTER_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function dbGet(key) {
  const db = await openRasterDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(RASTER_STORE, "readonly");
    const request = tx.objectStore(RASTER_STORE).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { try { db.close(); } catch {} };
  });
}

async function dbPut(key, value) {
  const db = await openRasterDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(RASTER_STORE, "readwrite");
    tx.objectStore(RASTER_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { try { db.close(); } catch {}; resolve(false); };
  });
}

function indexCacheKey() {
  return `${CACHE_SCHEMA}:index:${lastPdfSourceKey}`;
}

function rasterCacheKey(pageRender, view, outputWidth, aspect, includeHighlight) {
  const crop = calculateCropRect(pageRender, view, aspect);
  return [
    CACHE_SCHEMA,
    "crop",
    lastPdfSourceKey,
    pageRender.pageNumber,
    Math.round(pageRender.anchorX),
    Math.round(pageRender.anchorY),
    Math.round(crop.x * 10) / 10,
    Math.round(crop.y * 10) / 10,
    Math.round(crop.w * 10) / 10,
    Math.round(crop.h * 10) / 10,
    outputWidth,
    includeHighlight === false ? "clean" : "marked",
  ].join(":");
}

function releaseObjectUrls() {
  for (const url of objectUrlCache.values()) {
    try { URL.revokeObjectURL(url); } catch {}
  }
  objectUrlCache.clear();
}

function rememberObjectUrl(key, blob) {
  const existing = objectUrlCache.get(key);
  if (existing) {
    objectUrlCache.delete(key);
    objectUrlCache.set(key, existing);
    return existing;
  }
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(key, url);
  while (objectUrlCache.size > objectUrlLimit()) {
    const oldestKey = objectUrlCache.keys().next().value;
    const oldestUrl = objectUrlCache.get(oldestKey);
    objectUrlCache.delete(oldestKey);
    try { URL.revokeObjectURL(oldestUrl); } catch {}
  }
  return url;
}

function touchPreviewCache(key, value) {
  screenPreviewCache.delete(key);
  screenPreviewCache.set(key, value);
  while (screenPreviewCache.size > previewCacheLimit()) {
    const oldest = screenPreviewCache.keys().next().value;
    screenPreviewCache.delete(oldest);
  }
}

function screenPreviewKey(pageRender, view, outputWidth, aspect) {
  return rasterCacheKey(pageRender, view, outputWidth, aspect, false);
}

async function canvasToRasterBlob(canvas, quality = 0.9) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (blob) return blob;
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function cancelInteractivePdfRender() {
  const task = activeInteractiveRenderTask;
  activeInteractiveRenderTask = null;
  if (!task) return;
  try { task.cancel?.(); } catch {}
}

async function disposeActivePdf() {
  cancelInteractivePdfRender();
  if (activeReleaseTimer) {
    clearTimeout(activeReleaseTimer);
    activeReleaseTimer = null;
  }
  const previous = activePdfDoc;
  activePdfDoc = null;
  activePdfPromise = null;
  if (!previous) return;
  try { previous.cleanup?.(); } catch {}
  try {
    await previous.destroy?.();
  } catch (error) {
    console.debug("PDF cleanup skipped", error);
  }
}

function schedulePdfRelease(delay = pdfIdleReleaseMs()) {
  if (activeReleaseTimer) clearTimeout(activeReleaseTimer);
  activeReleaseTimer = setTimeout(() => {
    disposeActivePdf().catch(() => {});
  }, delay);
}

async function createPdfDocument(source) {
  if (typeof source === "string") {
    const url = resolvePdfSourceUrl(source);
    return pdfjsLib.getDocument({
      url,
      withCredentials: false,
      disableAutoFetch: true,
      disableStream: false,
      useWorkerFetch: true,
    }).promise;
  }

  if (source?.arrayBuffer) {
    const data = await source.arrayBuffer();
    return pdfjsLib.getDocument({ data }).promise;
  }

  throw new Error("Nguồn PDF không hợp lệ.");
}

async function ensureActivePdf() {
  if (activePdfDoc) {
    schedulePdfRelease();
    return activePdfDoc;
  }
  if (activePdfPromise) return activePdfPromise;
  if (!lastPdfSource) throw new Error("PDF source đã được giải phóng và không thể mở lại.");

  activePdfPromise = createPdfDocument(lastPdfSource)
    .then((doc) => {
      activePdfDoc = doc;
      activePdfPromise = null;
      schedulePdfRelease();
      return doc;
    })
    .catch((error) => {
      activePdfPromise = null;
      throw error;
    });
  return activePdfPromise;
}

export function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

export function resolvePdfSourceUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Bạn chưa nhập link PDF.");

  let url;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : undefined;
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    throw new Error("Link PDF không hợp lệ.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PlotFlow chỉ hỗ trợ link http/https hoặc PDF trong project.");
  }

  const driveMatch = url.href.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    || url.href.match(/[?&]id=([^&]+)/);

  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  return url.href;
}

export async function openVectorPdf(source) {
  screenPreviewCache.clear();
  releaseObjectUrls();
  await disposeActivePdf();
  lastPdfSource = source;
  lastPdfSourceKey = sourceKey(source);

  const cachedBundle = await dbGet(indexCacheKey());
  if (cachedBundle?.index && cachedBundle?.numPages) {
    return {
      numPages: cachedBundle.numPages,
      __plotflowRasterHandle: true,
      __cachedIndex: cachedBundle.index,
    };
  }

  const pdfDoc = await ensureActivePdf();
  schedulePdfRelease();
  return pdfDoc;
}

export async function buildFloorplanIndex(pdfDoc, onProgress) {
  if (pdfDoc?.__plotflowRasterHandle && pdfDoc.__cachedIndex) {
    const codes = Object.keys(pdfDoc.__cachedIndex).length;
    onProgress?.({ pageNumber: pdfDoc.numPages, totalPages: pdfDoc.numPages, textItems: 0, codes });
    return pdfDoc.__cachedIndex;
  }

  const doc = activePdfDoc || pdfDoc || await ensureActivePdf();
  const index = {};
  let textItems = 0;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!item?.str) continue;
      textItems += 1;
      const raw = normalizeUnitCode(item.str);
      const matches = raw.match(UNIT_CODE_RE) || [];

      for (const code of matches) {
        const key = normalizeUnitCode(code);
        const entry = {
          unitCode: key,
          pageNumber,
          x: Number(item.transform?.[4] || 0),
          y: Number(item.transform?.[5] || 0),
          width: Number(item.width || 0),
          height: Number(item.height || Math.abs(item.transform?.[3] || 0) || 0),
          sourceText: item.str,
        };
        if (!index[key]) index[key] = [];
        index[key].push(entry);
      }
    }

    page.cleanup?.();
    onProgress?.({ pageNumber, totalPages: doc.numPages, textItems, codes: Object.keys(index).length });
    if (pageNumber < doc.numPages) await yieldToBrowser();
  }

  await dbPut(indexCacheKey(), { index, numPages: doc.numPages, createdAt: Date.now() });
  schedulePdfRelease(250);
  return index;
}

export function resolveUnitsAgainstIndex(units, index) {
  const result = {};
  units.forEach((unit) => {
    const key = normalizeUnitCode(unit.unitCode);
    const matches = index[key] || [];
    result[key] = {
      unitCode: key,
      status: matches.length === 0 ? "not_found" : matches.length === 1 ? "ready" : "review",
      matches,
      selectedMatchIndex: 0,
    };
  });
  return result;
}

export async function renderPdfPageBase(_pdfDoc, pageNumber, scale = 1) {
  const doc = await ensureActivePdf();
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const result = {
    pageNumber,
    dataUrl: null,
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height),
    viewport,
    scale,
  };
  page.cleanup?.();
  schedulePdfRelease();
  return result;
}

export function attachMatchToPageRender(pageBase, match) {
  const [rawX, rawY] = pageBase.viewport.convertToViewportPoint(match.x, match.y);
  const anchorW = Math.max(14, match.width * pageBase.scale);
  const anchorH = Math.max(14, match.height * pageBase.scale);
  return {
    ...pageBase,
    anchorX: rawX + anchorW / 2,
    anchorY: rawY - anchorH / 2,
    anchorW,
    anchorH,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawLocatorDot(ctx, x, y, canvasWidth) {
  const radius = Math.max(4, Math.min(9, canvasWidth * 0.006));
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#e1263f";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, radius * 0.28);
  ctx.strokeStyle = "rgba(255,255,255,.96)";
  ctx.stroke();
  ctx.restore();
}

export function calculateCropRect(pageRender, view, aspect = FLOORPLAN_FRAME_ASPECT) {
  const zoom = Math.max(FLOORPLAN_ZOOM_MIN, Math.min(FLOORPLAN_ZOOM_MAX, Number(view.zoom) || 100));
  const pageWidthAtScale1 = pageRender.width / pageRender.scale;
  const baseWidthAtScale1 = Math.min(pageWidthAtScale1 * 0.38, 980 / 1.7);
  const cropWAtScale1 = baseWidthAtScale1 / (zoom / 100);

  let cropW = cropWAtScale1 * pageRender.scale;
  let cropH = cropW / aspect;

  if (cropH > pageRender.height) {
    cropH = pageRender.height;
    cropW = cropH * aspect;
  }
  if (cropW > pageRender.width) {
    cropW = pageRender.width;
    cropH = cropW / aspect;
  }

  const centerX = pageRender.anchorX + (Number(view.offsetX) || 0);
  const centerY = pageRender.anchorY + (Number(view.offsetY) || 0);
  const x = Math.max(0, Math.min(pageRender.width - cropW, centerX - cropW / 2));
  const y = Math.max(0, Math.min(pageRender.height - cropH, centerY - cropH / 2));
  return { x, y, w: cropW, h: cropH };
}

export async function renderPdfRegion(_pdfDoc, pageRender, view, options = {}) {
  if (!pageRender) throw new Error("Thiếu dữ liệu crop để render floorplan.");

  const aspect = options.aspect || FLOORPLAN_FRAME_ASPECT;
  const requestedOutputWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const isScreenPreview = options.includeHighlight === false
    && !options.maxRenderScale
    && requestedOutputWidth <= 1084;
  const outputWidth = isScreenPreview
    ? Math.min(requestedOutputWidth, PREVIEW_RENDER_MAX_WIDTH)
    : requestedOutputWidth;
  const outputHeight = Math.round(outputWidth / aspect);
  const cacheKey = rasterCacheKey(pageRender, view, outputWidth, aspect, options.includeHighlight);
  const memoryKey = isScreenPreview ? screenPreviewKey(pageRender, view, outputWidth, aspect) : null;

  if (memoryKey && screenPreviewCache.has(memoryKey)) {
    const cached = screenPreviewCache.get(memoryKey);
    touchPreviewCache(memoryKey, cached);
    return cached;
  }

  const persistent = await dbGet(cacheKey);
  if (persistent?.blob instanceof Blob) {
    const result = {
      dataUrl: rememberObjectUrl(cacheKey, persistent.blob),
      width: persistent.width || outputWidth,
      height: persistent.height || outputHeight,
      renderScale: persistent.renderScale || 1,
      requestedScale: persistent.requestedScale || 1,
      crop: persistent.crop || calculateCropRect(pageRender, view, aspect),
      rasterCached: true,
    };
    if (memoryKey) touchPreviewCache(memoryKey, result);
    return result;
  }

  const crop = calculateCropRect(pageRender, view, aspect);
  if (isScreenPreview && options.deferToIdle === true) await scheduleIdleRender();

  const doc = await ensureActivePdf();
  const page = await doc.getPage(pageRender.pageNumber);
  const cropWidthAtScale1 = crop.w / pageRender.scale;
  const requestedScale = outputWidth / cropWidthAtScale1;
  const renderScale = Math.max(0.25, Math.min(Number(options.maxRenderScale || 128), requestedScale));
  const viewport = page.getViewport({ scale: renderScale });
  const sourceToOutput = renderScale / pageRender.scale;
  const translateX = -crop.x * sourceToOutput;
  const translateY = -crop.y * sourceToOutput;

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  if (options.interactive === true) cancelInteractivePdfRender();
  const renderTask = page.render({
    canvas,
    viewport,
    transform: [1, 0, 0, 1, translateX, translateY],
    background: options.background || "#ffffff",
  });
  if (options.interactive === true) activeInteractiveRenderTask = renderTask;

  try {
    await renderTask.promise;
  } catch (error) {
    const cancelled = error?.name === "RenderingCancelledException" || /cancel/i.test(String(error?.message || ""));
    if (!cancelled) throw error;
    canvas.width = 1;
    canvas.height = 1;
    try { page.cleanup?.(); } catch {}
    schedulePdfRelease(250);
    return null;
  } finally {
    if (activeInteractiveRenderTask === renderTask) activeInteractiveRenderTask = null;
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  if (options.includeHighlight !== false && view.highlight !== false) {
    const sx = outputWidth / crop.w;
    const sy = outputHeight / crop.h;
    const tx = (pageRender.anchorX - crop.x) * sx;
    const ty = (pageRender.anchorY - crop.y) * sy;
    drawLocatorDot(ctx, tx, ty, outputWidth);
  }

  const blob = await canvasToRasterBlob(canvas, isScreenPreview ? 0.82 : 0.92);
  const result = {
    dataUrl: rememberObjectUrl(cacheKey, blob),
    width: outputWidth,
    height: outputHeight,
    renderScale,
    requestedScale,
    crop,
    rasterCached: false,
  };

  canvas.width = 1;
  canvas.height = 1;
  page.cleanup?.();
  if (options.interactive !== true) {
    await dbPut(cacheKey, { blob, width: outputWidth, height: outputHeight, renderScale, requestedScale, crop, createdAt: Date.now() });
  }
  if (memoryKey) touchPreviewCache(memoryKey, result);
  schedulePdfRelease(300);
  return result;
}

export async function createFloorplanCrop(pageRender, view, options = {}) {
  if (!pageRender?.dataUrl) {
    const result = await renderPdfRegion(null, pageRender, view, options);
    return result.dataUrl;
  }

  const aspect = options.aspect || FLOORPLAN_FRAME_ASPECT;
  const outputWidth = options.outputWidth || 1084;
  const outputHeight = Math.round(outputWidth / aspect);
  const crop = calculateCropRect(pageRender, view, aspect);
  const img = await loadImage(pageRender.dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, outputWidth, outputHeight);

  if (view.highlight !== false) {
    const sx = outputWidth / crop.w;
    const sy = outputHeight / crop.h;
    const tx = (pageRender.anchorX - crop.x) * sx;
    const ty = (pageRender.anchorY - crop.y) * sy;
    drawLocatorDot(ctx, tx, ty, outputWidth);
  }

  const blob = await canvasToRasterBlob(canvas, 0.9);
  const key = `legacy:${lastPdfSourceKey}:${pageRender.pageNumber}:${Date.now()}`;
  const url = rememberObjectUrl(key, blob);
  canvas.width = 1;
  canvas.height = 1;
  return url;
}