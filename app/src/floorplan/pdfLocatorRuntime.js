import * as prepared from "./pdfLocatorPrepared.js";
import { calculateCropRect, FLOORPLAN_FRAME_ASPECT } from "./pdfLocatorAuto.js";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
const FINE_TUNE_REQUEST_WIDTH = 1640;
const stablePreviewUrls = new Map();

let pageTileManifestPromise = null;
let activePageTileUrl = null;
let pageTileEpoch = 0;

function stablePreviewLimit() {
  const profile = getMemoryProfile();
  return Math.max(1, Number(profile.previewCacheTarget) || (profile.lowMemory ? 2 : 4));
}

function revoke(url) {
  if (!url || !String(url).startsWith("blob:")) return;
  try { URL.revokeObjectURL(url); } catch {}
}

function releasePageTileResult() {
  pageTileEpoch += 1;
  revoke(activePageTileUrl);
  activePageTileUrl = null;
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không clone được floorplan preview (${response.status}).`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function previewKey(pageRender, view) {
  return [
    pageRender?.unitCode || pageRender?.pageNumber || "page",
    Math.round(Number(view?.zoom || 100)),
    Math.round(Number(view?.offsetX || 0)),
    Math.round(Number(view?.offsetY || 0)),
  ].join(":");
}

async function loadPreparedManifest() {
  if (!pageTileManifestPromise) {
    pageTileManifestPromise = fetch(PREPARED_MANIFEST_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return pageTileManifestPromise;
}

function boundedOutputWidth(options = {}) {
  const profile = getMemoryProfile();
  const requested = Math.max(480, Math.round(options.outputWidth || FINE_TUNE_REQUEST_WIDTH));
  return profile.lowMemory ? Math.min(requested, 1280) : Math.min(requested, 1640);
}

function choosePageTileLevel(pageInfo, crop, outputWidth) {
  const levels = [...(pageInfo?.tiles?.levels || [])].sort((a, b) => Number(a.width) - Number(b.width));
  if (!levels.length) return null;
  const equivalentPageWidth = outputWidth * (Number(pageInfo.width || 1) / Math.max(1, crop.w));
  const adequate = levels.find((level) => Number(level.width) >= equivalentPageWidth * 0.82);
  return adequate || levels[levels.length - 1];
}

async function loadBitmap(url) {
  const response = await fetch(url, { cache: "force-cache" });
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

async function canvasToPageTileResult(canvas, crop, epoch, extra = {}) {
  const profile = getMemoryProfile();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", profile.lowMemory ? 0.82 : 0.88));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob || epoch !== pageTileEpoch) return null;
  revoke(activePageTileUrl);
  activePageTileUrl = URL.createObjectURL(blob);
  return {
    dataUrl: activePageTileUrl,
    width: extra.width,
    height: extra.height,
    crop,
    renderScale: 1,
    requestedScale: 1,
    preparedRaster: true,
    viewportTiles: true,
    exclusiveDetail: true,
    ...extra,
  };
}

async function renderFromGlobalPageTiles(pageRender, view, options = {}) {
  const manifest = await loadPreparedManifest();
  const pageInfo = manifest?.pages?.[String(pageRender?.pageNumber || 1)];
  const tiles = pageInfo?.tiles;
  if (!tiles?.base || !tiles?.levels?.length) return null;

  const aspect = options.aspect || FLOORPLAN_FRAME_ASPECT;
  const crop = calculateCropRect(pageRender, view, aspect);
  const outputWidth = boundedOutputWidth(options);
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const level = choosePageTileLevel(pageInfo, crop, outputWidth);
  if (!level) return null;

  const epoch = ++pageTileEpoch;
  const tileSize = Number(level.tileSize || tiles.tileSize || 512);
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
      if (epoch !== pageTileEpoch) {
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
        if (epoch !== pageTileEpoch) continue;
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

  return canvasToPageTileResult(canvas, crop, epoch, {
    width: outputWidth,
    height: outputHeight,
    preparedTier: `page-tiles-${level.width}`,
  });
}

export async function renderPdfRegion(pdfDoc, pageRender, view, options = {}) {
  const requestedWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const isPrepared = Boolean(pageRender?.__plotflowPrepared);

  // The global page pyramid is now the single prepared-masterplan pixel source for
  // previews, Fine Tune, Lot Highlight and save renders. This keeps every lot on the
  // same camera/crop math instead of mixing 640/1600/2168 lot rasters with page preview.
  let result = null;
  if (isPrepared) {
    try {
      result = await renderFromGlobalPageTiles(pageRender, view, options);
    } catch (error) {
      console.debug("Global page tile render skipped", error);
    }
  }

  if (!result) result = await prepared.renderPdfRegion(pdfDoc, pageRender, view, options);
  if (!result?.dataUrl) return result;

  // Screen/save previews outlive the exclusive interactive tile result. Clone them into
  // the bounded stable-preview pool so moving to another lot cannot revoke the poster.
  const isSavedScreenPreview = options.includeHighlight === false
    && !options.maxRenderScale
    && requestedWidth <= 1084;

  if (!isSavedScreenPreview || !String(result.dataUrl).startsWith("blob:")) return result;

  const key = previewKey(pageRender, view);
  const stableUrl = await cloneBlobUrl(result.dataUrl);
  rememberStablePreview(key, stableUrl);
  return { ...result, dataUrl: stableUrl, stablePreview: true };
}

export function releasePreparedDetailRaster() {
  releasePageTileResult();
  prepared.releasePreparedDetailRaster();
}

export async function releasePreparedFallbackPdf() {
  releasePageTileResult();
  prepared.releasePreparedDetailRaster();
  await prepared.releasePreparedFallbackPdf();
}
