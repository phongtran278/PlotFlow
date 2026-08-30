import * as legacyRuntime from "./pdfLocatorRuntime.js";
import { calculateCropRect, FLOORPLAN_FRAME_ASPECT } from "./pdfLocatorAuto.js";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
const TILE_SIZE = 512;
const MIN_LEVEL_WIDTH = 1800;
const stablePreviewUrls = new Map();

let manifestPromise = null;
let activeViewportUrl = null;
let renderEpoch = 0;

function revoke(url) {
  if (!url || !String(url).startsWith("blob:")) return;
  try { URL.revokeObjectURL(url); } catch {}
}

function releaseViewportResult() {
  renderEpoch += 1;
  revoke(activeViewportUrl);
  activeViewportUrl = null;
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
  // Deliberately bypass the HTTP memory cache. Visible tiles are decoded one at a time,
  // drawn immediately, then closed. The browser must not accumulate a 42k pyramid in RAM.
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được page tile (${response.status}).`);
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);

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
}

async function canvasToResult(canvas, crop, epoch, extra = {}) {
  const profile = getMemoryProfile();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", profile.lowMemory ? 0.8 : 0.86));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob || epoch !== renderEpoch) return null;
  revoke(activeViewportUrl);
  activeViewportUrl = URL.createObjectURL(blob);
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderPagePreviewOnly(pageRender, view, options = {}) {
  if (!pageRender?.dataUrl) return null;
  const aspect = options.aspect || FLOORPLAN_FRAME_ASPECT;
  const crop = calculateCropRect(pageRender, view, aspect);
  const epoch = ++renderEpoch;
  const image = await loadImage(pageRender.dataUrl);
  if (epoch !== renderEpoch) {
    image.src = "";
    return null;
  }

  const sourceWidth = image.naturalWidth || 1;
  const sourceHeight = image.naturalHeight || 1;
  const scaleX = sourceWidth / Math.max(1, pageRender.width);
  const scaleY = sourceHeight / Math.max(1, pageRender.height);
  const outputWidth = boundedOutputWidth(options);
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.w * scaleX,
    crop.h * scaleY,
    0,
    0,
    outputWidth,
    outputHeight
  );
  image.src = "";

  return canvasToResult(canvas, crop, epoch, {
    width: outputWidth,
    height: outputHeight,
    preparedTier: "page-preview-pdf-free-fallback",
    viewportTiles: false,
  });
}

export async function renderPdfRegion(pdfDoc, pageRender, view = {}, options = {}) {
  const isPrepared = Boolean(pageRender?.__plotflowPrepared);
  if (!isPrepared) return legacyRuntime.renderPdfRegion(pdfDoc, pageRender, view, options);

  // Strict rule for the bundled masterplan: no PDF.js fallback at runtime.
  // Coordinates already live in manifest.json; pixels come only from raster tiles.
  let result = null;
  try {
    result = await renderGlobalTiles(pageRender, view, options);
  } catch (error) {
    console.debug("PDF-free global tile render skipped", error);
  }
  if (!result) result = await renderPagePreviewOnly(pageRender, view, options);
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
  legacyRuntime.releasePreparedDetailRaster();
}

export async function releasePreparedFallbackPdf() {
  releaseViewportResult();
  // Kept only for custom uploaded/linked PDFs. Bundled prepared pages never open PDF.js.
  await legacyRuntime.releasePreparedFallbackPdf();
}
