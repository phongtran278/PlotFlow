import {
  calculateCropRect,
  FLOORPLAN_FRAME_ASPECT,
  FLOORPLAN_FRAME_HEIGHT,
  FLOORPLAN_FRAME_WIDTH,
  FLOORPLAN_ZOOM_MAX,
  FLOORPLAN_ZOOM_MIN,
  resolvePdfSourceUrl,
} from "./floorplanGeometry.js";
import { normalizeUnitCode, resolveUnitsAgainstIndex } from "./unitCodeCompat.js";
import {
  renderPdfRegion,
  releasePreparedDetailRaster,
  releasePreparedFallbackPdf,
} from "./pdfLocatorRuntimeStrict.js";

const PREPARED_MANIFEST_URL = "/masterplan/generated/manifest.json";
let preparedManifest = null;
let customLocatorPromise = null;

function publishSourceMode(mode, extra = {}) {
  if (typeof window === "undefined") return;
  window.__plotflowLocatorSource = {
    mode,
    bundledPdfOpened: false,
    pdfJsModuleLoaded: Boolean(customLocatorPromise),
    ...extra,
  };
}

async function customLocator() {
  if (!customLocatorPromise) {
    customLocatorPromise = import("./pdfLocatorAuto.js");
    publishSourceMode("custom-pdf", { pdfJsModuleLoaded: true });
  }
  return customLocatorPromise;
}

async function loadBundledManifest() {
  const response = await fetch(PREPARED_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được prepared masterplan manifest (${response.status}).`);
  const manifest = await response.json();
  if (!manifest?.index || !manifest?.pages) {
    throw new Error("Prepared masterplan manifest thiếu index/pages. PlotFlow sẽ không fallback sang PDF ở runtime.");
  }
  return manifest;
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

export async function openVectorPdf(source) {
  releasePreparedDetailRaster();
  preparedManifest = null;

  const isBundled = typeof source === "string" && source.includes("/masterplan/masterplan.pdf");
  if (isBundled) {
    preparedManifest = await loadBundledManifest();
    publishSourceMode("bundled-raster-only", {
      prepared: true,
      pages: preparedManifest.numPages || Object.keys(preparedManifest.pages).length,
    });
    return {
      numPages: preparedManifest.numPages || Object.keys(preparedManifest.pages).length,
      __plotflowPreparedMasterplan: true,
      __plotflowRasterOnly: true,
    };
  }

  const custom = await customLocator();
  return custom.openVectorPdf(source);
}

export async function buildFloorplanIndex(pdfDoc, onProgress) {
  if (pdfDoc?.__plotflowPreparedMasterplan && preparedManifest) {
    const total = pdfDoc.numPages || 1;
    onProgress?.({ pageNumber: total, totalPages: total, textItems: 0, codes: Object.keys(preparedManifest.index).length });
    return preparedManifest.index;
  }
  const custom = await customLocator();
  return custom.buildFloorplanIndex(pdfDoc, onProgress);
}

export async function renderPdfPageBase(pdfDoc, pageNumber, scale = 1) {
  if (pdfDoc?.__plotflowPreparedMasterplan && preparedManifest) {
    const pageInfo = preparedManifest.pages[String(pageNumber)] || preparedManifest.pages[pageNumber];
    if (!pageInfo) throw new Error(`Prepared masterplan thiếu page ${pageNumber}.`);
    const viewport = preparedViewport(pageInfo, scale);
    return {
      pageNumber,
      dataUrl: null,
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
      viewport,
      scale,
      __plotflowPrepared: true,
      coordinateOnlyPage: true,
    };
  }
  const custom = await customLocator();
  return custom.renderPdfPageBase(pdfDoc, pageNumber, scale);
}

export function attachMatchToPageRender(pageBase, match) {
  if (pageBase?.__plotflowPrepared) {
    const [rawX, rawY] = pageBase.viewport.convertToViewportPoint(match.x, match.y);
    const anchorW = Math.max(14, Number(match.width || 0) * pageBase.scale);
    const anchorH = Math.max(14, Number(match.height || 0) * pageBase.scale);
    return {
      ...pageBase,
      anchorX: rawX + anchorW / 2,
      anchorY: rawY - anchorH / 2,
      anchorW,
      anchorH,
      __plotflowPrepared: true,
      unitCode: match.unitCode,
    };
  }

  // Custom PDFs only reach this path after pdfLocatorAuto has already been loaded.
  // Its viewport follows the same PDF.js conversion contract.
  const [rawX, rawY] = pageBase.viewport.convertToViewportPoint(match.x, match.y);
  const anchorW = Math.max(14, Number(match.width || 0) * pageBase.scale);
  const anchorH = Math.max(14, Number(match.height || 0) * pageBase.scale);
  return {
    ...pageBase,
    anchorX: rawX + anchorW / 2,
    anchorY: rawY - anchorH / 2,
    anchorW,
    anchorH,
  };
}

export {
  calculateCropRect,
  FLOORPLAN_FRAME_ASPECT,
  FLOORPLAN_FRAME_HEIGHT,
  FLOORPLAN_FRAME_WIDTH,
  FLOORPLAN_ZOOM_MAX,
  FLOORPLAN_ZOOM_MIN,
  normalizeUnitCode,
  renderPdfRegion,
  releasePreparedDetailRaster,
  releasePreparedFallbackPdf,
  resolvePdfSourceUrl,
  resolveUnitsAgainstIndex,
};

publishSourceMode("idle-raster-first");
