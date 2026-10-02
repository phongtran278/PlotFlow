import { calculateCropRect, FLOORPLAN_FRAME_ASPECT } from "./floorplanGeometry.js";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
const TILE_SIZE = 512;
const MIN_LEVEL_WIDTH = 1800;
const stablePreviewUrls = new Map();

let manifestPromise = null;
let activeViewportUrl = null;
let renderEpoch = 0;
let legacyRuntimePromise = null;
let tileBitmapsActive = 0;
let tileBitmapsPeak = 0;
let rasterRenderCount = 0;

function publishRuntimeStats(extra = {}) {
  if (typeof window === "undefined") return;
  window.__plotflowRasterRuntime = {
    mode: legacyRuntimePromise ? "custom-pdf" : "bundled-raster-only",
    pdfRuntimeLoaded: Boolean(legacyRuntimePromise),
    bundledPdfOpened: false,
    tileBitmapsActive,
    tileBitmapsPeak,
    rasterRenderCount,
    activeViewportUrls: activeViewportUrl ? 1 : 0,
    stablePreviewUrls: stablePreviewUrls.size,
    ...extra,
  };
}

async function getLegacyRuntime() {
  if (!legacyRuntimePromise) {
    legacyRuntimePromise = import("./pdfLocatorRuntime.js");
    publishRuntimeStats({ pdfRuntimeLoaded: true, mode: "custom-pdf" });
  }
  return legacyRuntimePromise;
}

function revoke(url) {
  if (!url || !String(url).startsWith("blob:")) return;
  try { URL.revokeObjectURL(url); } catch {}
}

function releaseViewportResult() {
  renderEpoch += 1;
  revoke(activeViewportUrl);
  activeViewportUrl = null;
  publishRuntimeStats();
}

function stablePreviewLimit() {
  const profile = getMemoryProfile();
  return Math.max(1, Number(profile.previewCacheTarget) || (profile.lowMemory ? 2 : 4));
}

function rememberStablePreview(key, url) {
  const previous = stablePreviewUrls.get(key);
  if (previous && previous !== url) revoke(previous);
  stablePreviewUrls.delete(key);
  stablePreviewUrls.set(key, url);
  while (stablePreviewUrls.size > stablePreviewLimit()) {
    const oldestKey = stablePreviewUrls.keys().next().value;
    const oldestUrl = stablePreviewUrls.get(oldestKey);
    stablePreviewUrls.delete(oldestKey);
    revoke(oldestUrl);
  }
  publishRuntimeStats();
}

async function cloneBlobUrl(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không clone được floorplan preview (${response.status}).`);
  return URL.createObjectURL(await response.blob());
}

function previewKey(pageRender, view) {
  return [
    pageRender?.unitCode || pageRender?.pageNumber || "page",
    Math.round(Number(view?.zoom || 100)),
    Math.round(Number(view?.offsetX || 0)),
    Math.round(Number(view?.offsetY || 0)),
  ].join(":");
}

async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(PREPARED_MANIFEST_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return manifestPromise;
}

function recoverTiles(pageInfo) {
  if (pageInfo?.tiles?.base && pageInfo?.tiles?.levels?.length) return pageInfo.tiles;
  const sourceWidth = Number(pageInfo?.sourceRasterWidth || 0);
  const sourceHeight = Number(pageInfo?.sourceRasterHeight || 0);
  if (!sourceWidth || !sourceHeight) return null;

  const widths = [];
  let width = sourceWidth;
  while (width > MIN_LEVEL_WIDTH) {
    widths.push(Math.round(width));
    width /= 2;
  }
  widths.push(Math.max(MIN_LEVEL_WIDTH, Math.round(width)));

  const levels = [...new Set(widths)].sort((a, b) => a - b).map((levelWidth) => {
    const scale = levelWidth / sourceWidth;
    const levelHeight = Math.max(1, Math.round(sourceHeight * scale));
    return {
      width: levelWidth,
      height: levelHeight,
      cols: Math.ceil(levelWidth / TILE_SIZE),
      rows: Math.ceil(levelHeight / TILE_SIZE),
      tileSize: TILE_SIZE,
    };
  });

  return {
    base: "/masterplan/generated/page-tiles/page-1",
    tileSize: TILE_SIZE,
    sourceWidth,
    sourceHeight,
    levels,
    recovered: true,
  };
}

function boundedOutputWidth(options = {}) {
  const profile = getMemoryProfile();
  const requested = Math.max(480, Math.round(options.outputWidth || 1640));
  return profile.lowMemory ? Math.min(requested, 1280) : Math.min(requested, 1640);
}

function chooseLevel(pageInfo, tiles, crop, outputWidth) {
  const levels = [...(tiles?.levels || [])].sort((a, b) => Number(a.width) - Number(b.width));
  if (!levels.length) return null;
  const equivalentPageWidth = outputWidth * (Number(pageInfo.width || 1) / Math.max(1, crop.w));
  const adequate = levels.find((level) => Number(level.width) >= equivalentPageWidth * 0.82);
  return adequate || levels[levels.length - 1];
}

async function loadBitmap(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được page tile (${response.status}).`);
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    tileBitmapsActive += 1;
    tileBitmapsPeak = Math.max(tileBitmapsPeak, tileBitmapsActive);
    publishRuntimeStats();
    return bitmap;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const item = new Image();
      item.decoding = "async";
      item.onload = () => resolve(item);
      item.onerror = () => reject(new Error("Không decode được page tile."));
      item.src = objectUrl;
    });
    image.__plotflowObjectUrl = objectUrl;
    image.__plotflowTrackedBitmap = true;
    tileBitmapsActive += 1;
    tileBitmapsPeak = Math.max(tileBitmapsPeak, tileBitmapsActive);
    publishRuntimeStats();
    return image;
  } catch (error) {
    revoke(objectUrl);
    throw error;
  }
}

function closeBitmap(bitmap) {
  if (!bitmap) return;
  try { bitmap.close?.(); } catch {}
  if (bitmap.__plotflowObjectUrl) revoke(bitmap.__plotflowObjectUrl);
  try { bitmap.src = ""; } catch {}
  tileBitmapsActive = Math.max(0, tileBitmapsActive - 1);
  publishRuntimeStats();
}

async function canvasToResult(canvas, crop, epoch, extra = {}) {
  const profile = getMemoryProfile();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", profile.lowMemory ? 0.78 : 0.84));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob || epoch !== renderEpoch) return null;
  revoke(activeViewportUrl);
  activeViewportUrl = URL.createObjectURL(blob);
  publishRuntimeStats();
  return {
    dataUrl: activeViewportUrl,
    width: extra.width,
    height: extra.height,
    crop,
    renderScale: 1,
    requestedScale: 1,
    preparedRaster: true,
    viewportTiles: true,
    exclusiveDetail: true,
    pdfFreeRuntime: true,
    ...extra,
  };
}

async function renderGlobalTiles(pageRender, view, options = {}) {
  const manifest = await loadManifest();
  const pageInfo = manifest?.pages?.[String(pageRender?.pageNumber || 1)];
  if (!pageInfo) return null;
  const tiles = recoverTiles(pageInfo);
  if (!tiles?.base || !tiles?.levels?.length) return null;

  const aspect = options.aspect || FLOORPLAN_FRAME_ASPECT;
  const crop = calculateCropRect(pageRender, view, aspect);
  const outputWidth = boundedOutputWidth(options);
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const level = chooseLevel(pageInfo, tiles, crop, outputWidth);
  if (!level) return null;

  rasterRenderCount += 1;
  publishRuntimeStats({ activeLevel: Number(level.width), outputWidth, outputHeight });

  const epoch = ++renderEpoch;
  const tileSize = Number(level.tileSize || tiles.tileSize || TILE_SIZE);
  const scaleX = Number(level.width) / Math.max(1, Number(pageInfo.width || pageRender.width || 1));
  const scaleY = Number(level.height) / Math.max(1, Number(pageInfo.height || pageRender.height || 1));
  const sx = crop.x * scaleX;
  const sy = crop.y * scaleY;
  const sw = crop.w * scaleX;
  const sh = crop.h * scaleY;
  const firstCol = Math.max(0, Math.floor(sx / tileSize));
  const firstRow = Math.max(0, Math.floor(sy / tileSize));
  const lastCol = Math.min(Number(level.cols) - 1, Math.floor((sx + sw - 0.001) / tileSize));
  const lastRow = Math.min(Number(level.rows) - 1, Math.floor((sy + sh - 0.001) / tileSize));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = firstCol; col <= lastCol; col += 1) {
      if (epoch !== renderEpoch) {
        canvas.width = 1;
        canvas.height = 1;
        return null;
      }

      const tileLeft = col * tileSize;
      const tileTop = row * tileSize;
      const tileRight = Math.min(Number(level.width), tileLeft + tileSize);
      const tileBottom = Math.min(Number(level.height), tileTop + tileSize);
      const ix0 = Math.max(sx, tileLeft);
      const iy0 = Math.max(sy, tileTop);
      const ix1 = Math.min(sx + sw, tileRight);
      const iy1 = Math.min(sy + sh, tileBottom);
      if (ix1 <= ix0 || iy1 <= iy0) continue;

      const bitmap = await loadBitmap(`${tiles.base}/${level.width}/${col}_${row}.webp`);
      try {
        if (epoch !== renderEpoch) continue;
        const srcX = ix0 - tileLeft;
        const srcY = iy0 - tileTop;
        const srcW = ix1 - ix0;
        const srcH = iy1 - iy0;
        const dstX = (ix0 - sx) / sw * outputWidth;
        const dstY = (iy0 - sy) / sh * outputHeight;
        const dstW = srcW / sw * outputWidth;
        const dstH = srcH / sh * outputHeight;
        ctx.drawImage(bitmap, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      } finally {
        closeBitmap(bitmap);
      }
    }
  }

  return canvasToResult(canvas, crop, epoch, {
    width: outputWidth,
    height: outputHeight,
    preparedTier: `page-tiles-${level.width}`,
  });
}

export async function renderPdfRegion(pdfDoc, pageRender, view = {}, options = {}) {
  const isPrepared = Boolean(pageRender?.__plotflowPrepared);
  if (!isPrepared) {
    const legacyRuntime = await getLegacyRuntime();
    return legacyRuntime.renderPdfRegion(pdfDoc, pageRender, view, options);
  }

  const result = await renderGlobalTiles(pageRender, view, options);
  if (!result?.dataUrl) return result;

  const isSavedScreenPreview = options.includeHighlight === false
    && !options.maxRenderScale
    && Number(options.outputWidth || 0) <= 1084;

  if (!isSavedScreenPreview || !String(result.dataUrl).startsWith("blob:")) return result;

  const key = previewKey(pageRender, view);
  const stableUrl = await cloneBlobUrl(result.dataUrl);
  rememberStablePreview(key, stableUrl);
  return { ...result, dataUrl: stableUrl, stablePreview: true };
}

export function releasePreparedDetailRaster() {
  releaseViewportResult();
}

export async function releasePreparedFallbackPdf() {
  releaseViewportResult();
  if (!legacyRuntimePromise) return;
  const legacyRuntime = await legacyRuntimePromise;
  await legacyRuntime.releasePreparedFallbackPdf();
}

publishRuntimeStats();
