import * as base from "./pdfLocatorAuto.js";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
const DEFAULT_VIEW = { zoom: 100, offsetX: 0, offsetY: 0 };
const FINE_TUNE_REQUEST_WIDTH = 1640;

let preparedManifest = null;
let preparedSource = null;
let fallbackPdfDoc = null;
const transientPreparedUrls = new Set();
let activePreparedDetailUrl = null;
let activePreparedDetailSource = "";
let preparedRenderEpoch = 0;

function isDefaultView(view = {}) {
  return Math.abs(Number(view.zoom ?? 100) - 100) < 0.001
    && Math.abs(Number(view.offsetX ?? 0)) < 0.001
    && Math.abs(Number(view.offsetY ?? 0)) < 0.001;
}

async function loadPreparedManifest() {
  try {
    const response = await fetch(PREPARED_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const manifest = await response.json();
    if (!manifest?.index || !manifest?.pages || !manifest?.lots) return null;
    return manifest;
  } catch {
    return null;
  }
}

function revokeUrl(url) {
  if (!url) return;
  try { URL.revokeObjectURL(url); } catch {}
}

function releaseActivePreparedDetail() {
  revokeUrl(activePreparedDetailUrl);
  activePreparedDetailUrl = null;
  activePreparedDetailSource = "";
}

export function releasePreparedDetailRaster() {
  preparedRenderEpoch += 1;
  base.cancelInteractivePdfRender?.();
  releaseActivePreparedDetail();
}

function activatePreparedBlob(blob, sourceKey) {
  if (!blob) return null;
  releaseActivePreparedDetail();
  const url = URL.createObjectURL(blob);
  activePreparedDetailUrl = url;
  activePreparedDetailSource = sourceKey;
  return url;
}

async function exclusivePreparedDetailUrl(sourceUrl) {
  if (!sourceUrl) return null;
  if (activePreparedDetailUrl && activePreparedDetailSource === sourceUrl) return activePreparedDetailUrl;
  releaseActivePreparedDetail();
  const response = await fetch(sourceUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Không tải được prepared lot raster (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  activePreparedDetailUrl = url;
  activePreparedDetailSource = sourceUrl;
  return url;
}

async function ensureFallbackPdf() {
  if (fallbackPdfDoc) return fallbackPdfDoc;
  if (!preparedSource) throw new Error("Không còn PDF source để mở chế độ vector.");
  fallbackPdfDoc = await base.openVectorPdf(preparedSource);
  return fallbackPdfDoc;
}

export async function openVectorPdf(source) {
  releasePreparedDetailRaster();
  fallbackPdfDoc = null;
  preparedManifest = null;
  preparedSource = source;

  if (typeof source === "string" && source.includes("/masterplan/masterplan.pdf")) {
    const manifest = await loadPreparedManifest();
    if (manifest) {
      preparedManifest = manifest;
      return {
        numPages: manifest.numPages || Object.keys(manifest.pages).length,
        __plotflowPreparedMasterplan: true,
      };
    }
  }

  return base.openVectorPdf(source);
}

export async function buildFloorplanIndex(pdfDoc, onProgress) {
  if (pdfDoc?.__plotflowPreparedMasterplan && preparedManifest) {
    const total = pdfDoc.numPages || 1;
    onProgress?.({ pageNumber: total, totalPages: total, textItems: 0, codes: Object.keys(preparedManifest.index).length });
    return preparedManifest.index;
  }
  return base.buildFloorplanIndex(pdfDoc, onProgress);
}

function preparedViewport(pageInfo, scale = 1) {
  const width = Number(pageInfo.width || 1) * scale;
  const height = Number(pageInfo.height || 1) * scale;
  return {
    width,
    height,
    scale,
    convertToViewportPoint(x, y) {
      return [Number(x || 0) * scale, (Number(pageInfo.height || 1) - Number(y || 0)) * scale];
    },
  };
}

export async function renderPdfPageBase(pdfDoc, pageNumber, scale = 1) {
  if (pdfDoc?.__plotflowPreparedMasterplan && preparedManifest) {
    const pageInfo = preparedManifest.pages[String(pageNumber)] || preparedManifest.pages[pageNumber];
    if (!pageInfo) throw new Error(`Prepared masterplan thiếu page ${pageNumber}.`);
    const viewport = preparedViewport(pageInfo, scale);
    return {
      pageNumber,
      dataUrl: pageInfo.preview || null,
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
      viewport,
      scale,
      __plotflowPrepared: true,
    };
  }
  return base.renderPdfPageBase(pdfDoc, pageNumber, scale);
}

export function attachMatchToPageRender(pageBase, match) {
  const result = base.attachMatchToPageRender(pageBase, match);
  if (pageBase?.__plotflowPrepared) {
    result.__plotflowPrepared = true;
    result.unitCode = match.unitCode;
  }
  return result;
}

function preparedRasterFor(lot, options = {}) {
  const profile = getMemoryProfile();
  const requestedWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const wantsDetail = Boolean(options.maxRenderScale) || requestedWidth > 1084;

  if (!wantsDetail) {
    return {
      url: lot.preview || lot.medium || lot.detail,
      width: Number(lot.previewWidth || 640),
      height: Number(lot.previewHeight || 493),
      tier: "preview",
      detail: false,
    };
  }

  if (profile.lowMemory && lot.medium) {
    return {
      url: lot.medium,
      width: Number(lot.mediumWidth || 1600),
      height: Number(lot.mediumHeight || 1233),
      tier: "medium",
      detail: true,
    };
  }

  return {
    url: lot.detail || lot.medium || lot.preview,
    width: Number(lot.detailWidth || lot.mediumWidth || 2168),
    height: Number(lot.detailHeight || lot.mediumHeight || 1670),
    tier: "detail",
    detail: true,
  };
}

function loadPreparedImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được prepared raster."));
    image.src = src;
  });
}

function cropInsidePreparedLot(target, prepared) {
  if (!target || !prepared) return false;
  const epsilon = 0.75;
  return target.x >= prepared.x - epsilon
    && target.y >= prepared.y - epsilon
    && target.x + target.w <= prepared.x + prepared.w + epsilon
    && target.y + target.h <= prepared.y + prepared.h + epsilon;
}

function boundedOutputWidth(options = {}) {
  const profile = getMemoryProfile();
  const requested = Math.max(480, Math.round(options.outputWidth || 1626));
  return profile.lowMemory ? Math.min(requested, 1280) : Math.min(requested, 1640);
}

async function canvasToPreparedResult(canvas, targetCrop, sourceKey, epoch, extra = {}) {
  const profile = getMemoryProfile();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", profile.lowMemory ? 0.82 : 0.88));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob || epoch !== preparedRenderEpoch) return null;
  const url = activatePreparedBlob(blob, sourceKey);
  return {
    dataUrl: url,
    width: extra.width,
    height: extra.height,
    crop: targetCrop,
    renderScale: 1,
    requestedScale: 1,
    preparedRaster: true,
    exclusiveDetail: true,
    ...extra,
  };
}

function chooseTileLevel(lot, targetCrop, outputWidth) {
  const levels = [...(lot?.tiles?.levels || [])].sort((a, b) => Number(a.width) - Number(b.width));
  if (!levels.length || !lot?.crop) return null;
  const equivalentLotWidth = outputWidth * (lot.crop.w / Math.max(1, targetCrop.w));
  const adequate = levels.find((level) => Number(level.width) >= equivalentLotWidth * 0.82);
  return adequate || levels[levels.length - 1];
}

async function loadTileBitmap(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Không tải được tile (${response.status}).`);
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadPreparedImage(objectUrl);
    image.__plotflowObjectUrl = objectUrl;
    return image;
  } catch (error) {
    revokeUrl(objectUrl);
    throw error;
  }
}

function closeTileBitmap(bitmap) {
  if (!bitmap) return;
  try { bitmap.close?.(); } catch {}
  if (bitmap.__plotflowObjectUrl) revokeUrl(bitmap.__plotflowObjectUrl);
  try { bitmap.src = ""; } catch {}
}

async function renderFromPreparedTiles(lot, pageRender, view, options = {}) {
  if (!lot?.tiles?.base || !lot?.tiles?.levels?.length || !lot?.crop) return null;
  const aspect = options.aspect || base.FLOORPLAN_FRAME_ASPECT;
  const targetCrop = base.calculateCropRect(pageRender, view, aspect);
  if (!cropInsidePreparedLot(targetCrop, lot.crop)) return null;
  if (isDefaultView(view)) return null;

  const epoch = ++preparedRenderEpoch;
  const outputWidth = boundedOutputWidth(options);
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const level = chooseTileLevel(lot, targetCrop, outputWidth);
  if (!level) return null;

  const tileSize = Number(level.tileSize || lot.tiles.tileSize || 256);
  const scaleX = Number(level.width) / Math.max(1, lot.crop.w);
  const scaleY = Number(level.height) / Math.max(1, lot.crop.h);
  const sx = (targetCrop.x - lot.crop.x) * scaleX;
  const sy = (targetCrop.y - lot.crop.y) * scaleY;
  const sw = targetCrop.w * scaleX;
  const sh = targetCrop.h * scaleY;
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
      if (epoch !== preparedRenderEpoch) {
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

      const tileUrl = `${lot.tiles.base}/${level.width}/${col}_${row}.webp`;
      const bitmap = await loadTileBitmap(tileUrl);
      try {
        if (epoch !== preparedRenderEpoch) continue;
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
        closeTileBitmap(bitmap);
      }
    }
  }

  return canvasToPreparedResult(
    canvas,
    targetCrop,
    `tiles:${pageRender.unitCode}:${level.width}:${Date.now()}`,
    epoch,
    { width: outputWidth, height: outputHeight, preparedTier: `tiles-${level.width}`, viewportTiles: true }
  );
}

async function renderFromPreparedLot(lot, pageRender, view, options = {}) {
  if (!lot?.crop) return null;
  const aspect = options.aspect || base.FLOORPLAN_FRAME_ASPECT;
  const targetCrop = base.calculateCropRect(pageRender, view, aspect);
  if (!cropInsidePreparedLot(targetCrop, lot.crop)) return null;

  const raster = preparedRasterFor(lot, options);
  if (!raster.url) return null;
  const sourceUrl = raster.detail ? await exclusivePreparedDetailUrl(raster.url) : raster.url;

  if (isDefaultView(view)) {
    return {
      dataUrl: sourceUrl,
      width: raster.width,
      height: raster.height,
      crop: targetCrop,
      renderScale: 1,
      requestedScale: 1,
      preparedRaster: true,
      preparedTier: raster.tier,
      exclusiveDetail: raster.detail,
    };
  }

  const epoch = ++preparedRenderEpoch;
  const image = await loadPreparedImage(sourceUrl);
  if (epoch !== preparedRenderEpoch) {
    image.src = "";
    return null;
  }
  const sourceWidth = image.naturalWidth || raster.width;
  const sourceHeight = image.naturalHeight || raster.height;
  const relativeX = (targetCrop.x - lot.crop.x) / lot.crop.w;
  const relativeY = (targetCrop.y - lot.crop.y) / lot.crop.h;
  const relativeW = targetCrop.w / lot.crop.w;
  const relativeH = targetCrop.h / lot.crop.h;
  const sx = Math.max(0, relativeX * sourceWidth);
  const sy = Math.max(0, relativeY * sourceHeight);
  const sw = Math.min(sourceWidth - sx, relativeW * sourceWidth);
  const sh = Math.min(sourceHeight - sy, relativeH * sourceHeight);
  const outputWidth = boundedOutputWidth(options);
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  image.src = "";

  return canvasToPreparedResult(
    canvas,
    targetCrop,
    `prepared:${pageRender.unitCode}:${Date.now()}`,
    epoch,
    { width: outputWidth, height: outputHeight, preparedTier: `${raster.tier}-cropped` }
  );
}

async function renderFromPagePreview(pageRender, view, options = {}) {
  if (!pageRender?.dataUrl) return null;
  const aspect = options.aspect || base.FLOORPLAN_FRAME_ASPECT;
  const targetCrop = base.calculateCropRect(pageRender, view, aspect);
  const epoch = ++preparedRenderEpoch;
  const image = await loadPreparedImage(pageRender.dataUrl);
  if (epoch !== preparedRenderEpoch) {
    image.src = "";
    return null;
  }
  const sourceWidth = image.naturalWidth || 1;
  const sourceHeight = image.naturalHeight || 1;
  const pageScaleX = sourceWidth / Math.max(1, pageRender.width);
  const pageScaleY = sourceHeight / Math.max(1, pageRender.height);
  const sx = targetCrop.x * pageScaleX;
  const sy = targetCrop.y * pageScaleY;
  const sw = targetCrop.w * pageScaleX;
  const sh = targetCrop.h * pageScaleY;
  const outputWidth = boundedOutputWidth(options);
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  image.src = "";
  return canvasToPreparedResult(
    canvas,
    targetCrop,
    `page-preview:${pageRender.pageNumber}:${Date.now()}`,
    epoch,
    { width: outputWidth, height: outputHeight, preparedTier: "page-preview-cropped" }
  );
}

export async function renderPdfRegion(pdfDoc, pageRender, view = DEFAULT_VIEW, options = {}) {
  const requestedWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const isFineTuneViewport = Boolean(
    pageRender?.__plotflowPrepared
    && options.maxRenderScale
    && requestedWidth === FINE_TUNE_REQUEST_WIDTH
  );

  if (pageRender?.__plotflowPrepared && preparedManifest) {
    const lot = preparedManifest.lots?.[pageRender.unitCode];

    if (isFineTuneViewport) {
      // Large-plan runtime: never reopen PDF.js for interactive Fine Tune. The camera
      // follows the lightweight page preview immediately; after settle we refine only
      // the visible crop using 256px tiles (or the prepared lot raster as fallback).
      if (lot) {
        const tiled = await renderFromPreparedTiles(lot, pageRender, view, options);
        if (tiled) return tiled;
        const prepared = await renderFromPreparedLot(lot, pageRender, view, options);
        if (prepared) return prepared;
      }
      const preview = await renderFromPagePreview(pageRender, view, options);
      if (preview) return preview;
      return null;
    }

    if (lot) {
      const prepared = await renderFromPreparedLot(lot, pageRender, view, options);
      if (prepared) return prepared;
    }
  }

  if (pageRender?.__plotflowPrepared) {
    releaseActivePreparedDetail();
    const doc = await ensureFallbackPdf();
    return base.renderPdfRegion(doc, pageRender, view, options);
  }
  return base.renderPdfRegion(pdfDoc, pageRender, view, options);
}

export async function releasePreparedFallbackPdf() {
  releasePreparedDetailRaster();
  for (const url of transientPreparedUrls) revokeUrl(url);
  transientPreparedUrls.clear();

  const doc = fallbackPdfDoc;
  fallbackPdfDoc = null;
  if (!doc) return;
  try { doc.cleanup?.(); } catch {}
  try { await doc.destroy?.(); } catch {}
}
