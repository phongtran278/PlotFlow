import * as prepared from "./pdfLocatorPrepared.js";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

const stablePreviewUrls = new Map();

function stablePreviewLimit() {
  const profile = getMemoryProfile();
  return Math.max(1, Number(profile.previewCacheTarget) || (profile.lowMemory ? 2 : 4));
}

function revoke(url) {
  if (!url || !String(url).startsWith("blob:")) return;
  try { URL.revokeObjectURL(url); } catch {}
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

export async function renderPdfRegion(pdfDoc, pageRender, view, options = {}) {
  const result = await prepared.renderPdfRegion(pdfDoc, pageRender, view, options);
  if (!result?.dataUrl) return result;

  // Fine Tune/HQ interaction owns an exclusive transient URL and may revoke it on
  // every camera move. Screen/save previews must not share that lifecycle or the
  // poster image disappears immediately after closing Fine Tune.
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
  prepared.releasePreparedDetailRaster();
}

export async function releasePreparedFallbackPdf() {
  prepared.releasePreparedDetailRaster();
  await prepared.releasePreparedFallbackPdf();
}
