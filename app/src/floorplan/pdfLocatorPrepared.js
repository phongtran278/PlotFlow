import * as base from "./pdfLocatorAuto.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
const DEFAULT_VIEW = { zoom: 100, offsetX: 0, offsetY: 0 };

let preparedManifest = null;
let preparedSource = null;
let fallbackPdfDoc = null;

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

export async function renderPdfRegion(pdfDoc, pageRender, view = DEFAULT_VIEW, options = {}) {
  if (pageRender?.__plotflowPrepared && preparedManifest && isDefaultView(view)) {
    const lot = preparedManifest.lots?.[pageRender.unitCode];
    if (lot) {
      const requestedWidth = Math.max(480, Math.round(options.outputWidth || 1626));
      const detail = Boolean(options.maxRenderScale) || requestedWidth > 900;
      const url = detail ? (lot.detail || lot.preview) : (lot.preview || lot.detail);
      if (url) {
        return {
          dataUrl: url,
          width: detail ? Number(lot.detailWidth || 2168) : Number(lot.previewWidth || 640),
          height: detail ? Number(lot.detailHeight || 1670) : Number(lot.previewHeight || 493),
          crop: base.calculateCropRect(pageRender, view, options.aspect || base.FLOORPLAN_FRAME_ASPECT),
          renderScale: 1,
          requestedScale: 1,
          preparedRaster: true,
        };
      }
    }
  }

  if (pageRender?.__plotflowPrepared) {
    const doc = await ensureFallbackPdf();
    return base.renderPdfRegion(doc, pageRender, view, options);
  }
  return base.renderPdfRegion(pdfDoc, pageRender, view, options);
}

export async function releasePreparedFallbackPdf() {
  const doc = fallbackPdfDoc;
  fallbackPdfDoc = null;
  if (!doc) return;
  try { doc.cleanup?.(); } catch {}
  try { await doc.destroy?.(); } catch {}
}
