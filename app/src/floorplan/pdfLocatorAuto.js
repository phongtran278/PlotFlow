import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const UNIT_CODE_RE = /[A-Z]{1,8}\d{1,5}-\d{1,5}/g;
const PREVIEW_RENDER_MAX_WIDTH = 640;
const SCREEN_PREVIEW_CACHE_LIMIT = 16;
const screenPreviewCache = new Map();
export const FLOORPLAN_ZOOM_MIN = 50;
export const FLOORPLAN_ZOOM_MAX = 2000;
export const FLOORPLAN_FRAME_WIDTH = 506;
export const FLOORPLAN_FRAME_HEIGHT = 390;
export const FLOORPLAN_FRAME_ASPECT = FLOORPLAN_FRAME_WIDTH / FLOORPLAN_FRAME_HEIGHT;

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function scheduleIdleRender() {
  if (typeof requestIdleCallback === "function") {
    return new Promise((resolve) => requestIdleCallback(() => resolve(), { timeout: 500 }));
  }
  return new Promise((resolve) => setTimeout(resolve, 16));
}

function touchPreviewCache(key, value) {
  screenPreviewCache.delete(key);
  screenPreviewCache.set(key, value);
  while (screenPreviewCache.size > SCREEN_PREVIEW_CACHE_LIMIT) {
    const oldest = screenPreviewCache.keys().next().value;
    screenPreviewCache.delete(oldest);
  }
}

function screenPreviewKey(pageRender, view, outputWidth, aspect) {
  const crop = calculateCropRect(pageRender, view, aspect);
  return [
    pageRender.pageNumber,
    Math.round(pageRender.anchorX),
    Math.round(pageRender.anchorY),
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.w),
    Math.round(crop.h),
    outputWidth,
  ].join(":");
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

  if (typeof source === "string") {
    const url = resolvePdfSourceUrl(source);
    const task = pdfjsLib.getDocument({ url, withCredentials: false });
    return task.promise;
  }

  if (source?.arrayBuffer) {
    const data = await source.arrayBuffer();
    const task = pdfjsLib.getDocument({ data });
    return task.promise;
  }

  throw new Error("Nguồn PDF không hợp lệ.");
}

export async function buildFloorplanIndex(pdfDoc, onProgress) {
  const index = {};
  let textItems = 0;

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!item?.str) continue;
      textItems += 1;
      // Normalize Vietnamese letters (notably Đ → D) before matching so codes
      // such as ĐLCV2-14 index to the same key as data imported from Sheet/Excel.
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

    onProgress?.({ pageNumber, totalPages: pdfDoc.numPages, textItems, codes: Object.keys(index).length });
    if (pageNumber < pdfDoc.numPages) await yieldToBrowser();
  }

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

export async function renderPdfPageBase(pdfDoc, pageNumber, scale = 1.25) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");
  canvas.width = 1;
  canvas.height = 1;

  return {
    pageNumber,
    dataUrl,
    width: Math.ceil(viewport.width),
    height: Math.ceil(viewport.height),
    viewport,
    scale,
  };
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

export async function renderPdfRegion(pdfDoc, pageRender, view, options = {}) {
  if (!pdfDoc || !pageRender) throw new Error("Thiếu PDF source để render vector HQ.");

  const aspect = options.aspect || FLOORPLAN_FRAME_ASPECT;
  const requestedOutputWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const isScreenPreview = options.includeHighlight === false
    && !options.maxRenderScale
    && requestedOutputWidth <= 1084;
  const outputWidth = isScreenPreview
    ? Math.min(requestedOutputWidth, PREVIEW_RENDER_MAX_WIDTH)
    : requestedOutputWidth;
  const outputHeight = Math.round(outputWidth / aspect);
  const cacheKey = isScreenPreview ? screenPreviewKey(pageRender, view, outputWidth, aspect) : null;

  if (cacheKey && screenPreviewCache.has(cacheKey)) {
    const cached = screenPreviewCache.get(cacheKey);
    touchPreviewCache(cacheKey, cached);
    return cached;
  }

  const crop = calculateCropRect(pageRender, view, aspect);

  // Screen crops are visual work, not blocking data work. Run them when the
  // browser has an idle window so panning, zooming and unit selection stay responsive.
  if (isScreenPreview) await scheduleIdleRender();

  const page = await pdfDoc.getPage(pageRender.pageNumber);
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
  await page.render({
    canvas,
    viewport,
    transform: [1, 0, 0, 1, translateX, translateY],
    background: options.background || "#ffffff",
  }).promise;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (options.includeHighlight !== false && view.highlight !== false) {
    const sx = outputWidth / crop.w;
    const sy = outputHeight / crop.h;
    const tx = (pageRender.anchorX - crop.x) * sx;
    const ty = (pageRender.anchorY - crop.y) * sy;
    drawLocatorDot(ctx, tx, ty, outputWidth);
  }

  const result = {
    dataUrl: canvas.toDataURL("image/png"),
    width: outputWidth,
    height: outputHeight,
    renderScale,
    requestedScale,
    crop,
  };
  canvas.width = 1;
  canvas.height = 1;

  if (cacheKey) touchPreviewCache(cacheKey, result);
  return result;
}

export async function createFloorplanCrop(pageRender, view, options = {}) {
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

  const dataUrl = canvas.toDataURL("image/png");
  canvas.width = 1;
  canvas.height = 1;
  return dataUrl;
}
