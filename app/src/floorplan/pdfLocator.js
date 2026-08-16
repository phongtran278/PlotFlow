import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const UNIT_CODE_RE = /[A-Z]{1,6}\d{1,5}-\d{1,5}/g;
export const FLOORPLAN_ZOOM_MIN = 50;
export const FLOORPLAN_ZOOM_MAX = 2000;
// Round 1 canonical floorplan frame. Keep every PDF crop, lot overlay and 2D pin
// in this exact aspect so editor coordinates map 1:1 back onto the poster.
export const FLOORPLAN_FRAME_WIDTH = 506;
export const FLOORPLAN_FRAME_HEIGHT = 390;
export const FLOORPLAN_FRAME_ASPECT = FLOORPLAN_FRAME_WIDTH / FLOORPLAN_FRAME_HEIGHT;

export function normalizeUnitCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

export function resolvePdfSourceUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Bạn chưa nhập link PDF.");

  // Project-bundled PDFs use an app-relative URL such as
  // /masterplan/masterplan.pdf. Resolve it against the current Vite origin
  // so PDF.js receives a valid http(s) URL instead of rejecting it.
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

  // Common Google Drive share-link formats.
  const driveMatch = url.href.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    || url.href.match(/[?&]id=([^&]+)/);

  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  return url.href;
}

export async function openVectorPdf(source) {
  if (typeof source === "string") {
    const url = resolvePdfSourceUrl(source);
    const task = pdfjsLib.getDocument({
      url,
      withCredentials: false,
    });
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
      const raw = String(item.str).toUpperCase().replace(/\s+/g, "");
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

export async function renderPdfPageBase(pdfDoc, pageNumber, scale = 1.7) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const ctx = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    pageNumber,
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
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

export function calculateCropRect(pageRender, view, aspect = FLOORPLAN_FRAME_ASPECT) {
  const zoom = Math.max(FLOORPLAN_ZOOM_MIN, Math.min(FLOORPLAN_ZOOM_MAX, Number(view.zoom) || 100));

  // Keep 100% framing independent from the low-res preview scale.
  // V6/V6.1 used scale 1.7 and a 980px cap; 980 / 1.7 preserves that baseline in PDF viewport units.
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
  const outputWidth = Math.max(480, Math.round(options.outputWidth || 1626));
  const outputHeight = Math.round(outputWidth / aspect);
  const crop = calculateCropRect(pageRender, view, aspect);
  const page = await pdfDoc.getPage(pageRender.pageNumber);

  // Convert crop dimensions from the cached preview viewport back to PDF viewport units,
  // then ask PDF.js to render the selected region directly from vector source.
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
    const radius = Math.max(28, Number(view.highlightSize) || 48);
    const opacity = Math.max(0.05, Math.min(0.8, Number(view.highlightOpacity ?? 0.35)));

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "#ff334f";
    ctx.shadowColor = "rgba(255, 35, 70, .75)";
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.ellipse(tx, ty, radius * 1.15, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(tx, ty, radius * 0.82, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: outputWidth,
    height: outputHeight,
    renderScale,
    requestedScale,
    crop,
  };
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
    const radius = Math.max(28, Number(view.highlightSize) || 48);
    const opacity = Math.max(0.05, Math.min(0.8, Number(view.highlightOpacity ?? 0.35)));

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "#ff334f";
    ctx.shadowColor = "rgba(255, 35, 70, .75)";
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.ellipse(tx, ty, radius * 1.15, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(tx, ty, radius * 0.82, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}
