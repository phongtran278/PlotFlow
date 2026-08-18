import * as base from "./pdfLocatorAuto.js";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
const DEFAULT_VIEW = { zoom: 100, offsetX: 0, offsetY: 0 };

let preparedManifest = null;
let preparedSource = null;
let fallbackPdfDoc = null;
const transientPreparedUrls = new Set();

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

async function ensureFallbackPdf() {
  if (fallbackPdfDoc) return fallbackPdfDoc;
  if (!preparedSource) throw new Error("Không còn PDF source để mở chế độ vector.");
  fallbackPdfDoc = await base.openVectorPdf(preparedSource);
  return fallbackPdfDoc;
}

export async function openVectorPdf(source) {
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
  const wantsDetail = Boolean(options.maxRenderScale) || requestedWidth > 900;

  if (!wantsDetail) {
    return {
      url: lot.preview || lot.medium || lot.detail,
      width: Number(lot.previewWidth || 640),
      height: Number(lot.previewHeight || 493),
      tier: "preview",
    };
  }

  if (profile.lowMemory && lot.medium) {
    return {
      url: lot.medium,
      width: Number(lot.mediumWidth || 1600),
      height: Number(lot.mediumHeight || 1233),
      tier: "medium",
    };
  }

  return {
    url: lot.detail || lot.medium || lot.preview,
    width: Number(lot.detailWidth || lot.mediumWidth || 2168),
    height: Number(lot.detailHeight || lot.mediumHeight || 1670),
    tier: "detail",
  };
}

function loadPreparedImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được prepared lot raster."));
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

async function renderFromPreparedLot(lot, pageRender, view, options = {}) {
  if (!lot?.crop) return null;
  const aspect = options.aspect || base.FLOORPLAN_FRAME_ASPECT;
  const targetCrop = base.calculateCropRect(pageRender, view, aspect);
  if (!cropInsidePreparedLot(targetCrop, lot.crop)) return null;

  const raster = preparedRasterFor(lot, options);
  if (!raster.url) return null;
  if (isDefaultView(view)) {
    return {
      dataUrl: raster.url,
      width: raster.width,
      height: raster.height,
      crop: targetCrop,
      renderScale: 1,
      requestedScale: 1,
      preparedRaster: true,
      preparedTier: raster.tier,
    };
  }

  const image = await loadPreparedImage(raster.url);
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

  const profile = getMemoryProfile();
  const requestedWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const outputWidth = profile.lowMemory ? Math.min(requestedWidth, 1600) : requestedWidth;
  const outputHeight = Math.max(2, Math.round(outputWidth / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", profile.lowMemory ? 0.84 : 0.9));
  canvas.width = 1;
  canvas.height = 1;
  image.src = "";
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  transientPreparedUrls.add(url);
  return {
    dataUrl: url,
    width: outputWidth,
    height: outputHeight,
    crop: targetCrop,
    renderScale: 1,
    requestedScale: 1,
    preparedRaster: true,
    preparedTier: `${raster.tier}-cropped`,
  };
}

export async function renderPdfRegion(pdfDoc, pageRender, view = DEFAULT_VIEW, options = {}) {
  if (pageRender?.__plotflowPrepared && preparedManifest) {
    const lot = preparedManifest.lots?.[pageRender.unitCode];
    if (lot) {
      const prepared = await renderFromPreparedLot(lot, pageRender, view, options);
      if (prepared) return prepared;
    }
  }

  if (pageRender?.__plotflowPrepared) {
    const doc = await ensureFallbackPdf();
    return base.renderPdfRegion(doc, pageRender, view, options);
  }
  return base.renderPdfRegion(pdfDoc, pageRender, view, options);
}

export async function releasePreparedFallbackPdf() {
  for (const url of transientPreparedUrls) {
    try { URL.revokeObjectURL(url); } catch {}
  }
  transientPreparedUrls.clear();

  const doc = fallbackPdfDoc;
  fallbackPdfDoc = null;
  if (!doc) return;
  try { doc.cleanup?.(); } catch {}
  try { await doc.destroy?.(); } catch {}
}
