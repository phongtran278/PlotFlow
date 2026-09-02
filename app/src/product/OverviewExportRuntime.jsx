import { useEffect } from "react";
import { toPng } from "html-to-image";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_EXPORT_WIDTH = 7000;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function imageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Export canvas could not be encoded.")), type, quality);
  });
}

function download(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    download(url, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1800);
  }
}

function currentStage() {
  return document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
}

function currentToolbar() {
  return document.querySelector(".pf-overview-zoom-toolbar");
}

function groupPdfSource(group = "") {
  const normalized = String(group).toLowerCase();
  if (normalized.includes("giãn") || normalized.includes("gian")) return "/overview-masterplan/gian-xay.pdf";
  if (normalized.includes("thô") || normalized.includes("tho")) return "/overview-masterplan/xay-tho.pdf";
  return "/overview-masterplan/hoan-thien.pdf";
}

function currentPdfSource(stage) {
  const group = stage?.dataset?.overviewGroup || "";
  return stage?.dataset?.overviewPdfUrl
    || groupPdfSource(group)
    || stage?.querySelector?.(".pf-masterplan-pdf")?.getAttribute?.("src")
    || "";
}

function exportBounds(stage) {
  const x = Number(stage.dataset.pfPdfX);
  const y = Number(stage.dataset.pfPdfY);
  const width = Number(stage.dataset.pfPdfWidth);
  const height = Number(stage.dataset.pfPdfHeight);
  if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) return { x, y, width, height };
  return { x: 0, y: 0, width: stage.clientWidth, height: stage.clientHeight };
}

async function cropTransparent(stage, dataUrl, bounds) {
  const image = await imageFromDataUrl(dataUrl);
  const scaleX = image.naturalWidth / Math.max(1, stage.clientWidth);
  const scaleY = image.naturalHeight / Math.max(1, stage.clientHeight);
  const sx = Math.max(0, Math.round(bounds.x * scaleX));
  const sy = Math.max(0, Math.round(bounds.y * scaleY));
  const sw = Math.min(image.naturalWidth - sx, Math.max(1, Math.round(bounds.width * scaleX)));
  const sh = Math.min(image.naturalHeight - sy, Math.max(1, Math.round(bounds.height * scaleY)));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, sw, sh);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

async function renderSourcePdf(source, targetWidth) {
  const loadingTask = pdfjsLib.getDocument({ url: source, isEvalSupported: false, disableAutoFetch: true });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / Math.max(1, base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: "#fff", intent: "print" }).promise;
    page.cleanup?.();
    return canvas;
  } finally {
    await pdf.destroy?.();
  }
}

function isBackgroundNode(node) {
  const element = node instanceof Element ? node : null;
  if (!element) return false;
  return Boolean(element.closest(
    ".pf-overview-pdf-canvas,.pf-masterplan-pdf,.pf-overview-raster-viewport,.pf-overview-raster-tile-layer,.pf-overview-pdf-trim-frame,.pf-overview-guide-line"
  ));
}

async function captureComposite(stage, requestedWidth) {
  const bounds = exportBounds(stage);
  const targetWidth = Math.min(MAX_EXPORT_WIDTH, Math.max(1000, Math.round(Number(requestedWidth) || 4000)));
  const pixelRatio = targetWidth / Math.max(1, bounds.width);
  const sourcePdf = currentPdfSource(stage);
  if (!sourcePdf) throw new Error("Không tìm thấy PDF nguồn của view hiện tại.");

  const baseCanvas = await renderSourcePdf(sourcePdf, targetWidth);
  const overlayDataUrl = await toPng(stage, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: "transparent",
    filter: (node) => !isBackgroundNode(node),
    style: {
      background: "transparent",
      border: "0",
      boxShadow: "none",
    },
  });
  const overlayCanvas = await cropTransparent(stage, overlayDataUrl, bounds);

  const composite = document.createElement("canvas");
  composite.width = baseCanvas.width;
  composite.height = baseCanvas.height;
  const ctx = composite.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, composite.width, composite.height);
  ctx.drawImage(baseCanvas, 0, 0, composite.width, composite.height);
  ctx.drawImage(overlayCanvas, 0, 0, composite.width, composite.height);
  return composite;
}

function ascii(value) {
  return new TextEncoder().encode(value);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function imagePdf(jpegBytes, pixelWidth, pixelHeight) {
  const pageWidth = 841.89;
  const pageHeight = pageWidth * (pixelHeight / Math.max(1, pixelWidth));
  const content = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = ascii(content);
  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concatBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
      jpegBytes,
      ascii("\nendstream"),
    ]),
    concatBytes([
      ascii(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      ascii("endstream"),
    ]),
  ];

  const parts = [ascii("%PDF-1.4\n%PlotFlow composite export\n")];
  const offsets = [0];
  let byteOffset = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrapped = concatBytes([ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n")]);
    parts.push(wrapped);
    byteOffset += wrapped.length;
  });

  const xrefOffset = byteOffset;
  const xrefRows = offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  parts.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefRows}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob([concatBytes(parts)], { type: "application/pdf" });
}

function installResolutionControl() {
  const toolbar = currentToolbar();
  const pngButton = toolbar?.querySelector?.("[data-action='png']");
  if (!toolbar || !pngButton) return false;
  if (toolbar.querySelector("[data-png-resolution]")) return true;

  const label = document.createElement("label");
  label.className = "pf-png-resolution-control";
  label.hidden = true;
  label.innerHTML = `<input data-png-width type="hidden" value="4000">`;
  pngButton.after(label);
  return true;
}

export default function OverviewExportRuntime() {
  useEffect(() => {
    let observer = null;

    function syncResolutionControl() {
      installResolutionControl();
    }

    async function onClick(event) {
      const button = event.target.closest?.(".pf-overview-editor-toolbar [data-action='pdf'],.pf-overview-editor-toolbar [data-action='png']");
      if (!button) return;
      const stage = currentStage();
      if (!stage) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const action = button.dataset.action;
      const toolbar = currentToolbar();
      const fit = toolbar?.querySelector("[data-action='fit']");
      const targetWidth = Math.max(1000, Math.min(MAX_EXPORT_WIDTH, Number(toolbar?.querySelector("[data-png-width]")?.value || 4000)));
      const group = String(stage.dataset.overviewGroup || "Overview").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

      button.disabled = true;
      stage.classList.add("is-exporting-overview");
      try {
        fit?.click();
        await wait(240);
        const composite = await captureComposite(stage, targetWidth);

        if (action === "png") {
          const blob = await canvasBlob(composite, "image/png");
          downloadBlob(blob, `PlotFlow-${group || "Overview"}-${composite.width}x${composite.height}.png`);
          return;
        }

        const jpegBlob = await canvasBlob(composite, "image/jpeg", 0.96);
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const pdfBlob = imagePdf(jpegBytes, composite.width, composite.height);
        downloadBlob(pdfBlob, `PlotFlow-${group || "Overview"}-composite.pdf`);
      } catch (error) {
        console.error(`Overview ${action.toUpperCase()} export failed`, error);
        window.alert(`${action.toUpperCase()} export chưa thể hoàn tất: ${error.message}`);
      } finally {
        stage.classList.remove("is-exporting-overview");
        button.disabled = false;
      }
    }

    syncResolutionControl();
    observer = new MutationObserver(syncResolutionControl);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", onClick, true);
      document.querySelector("[data-png-width]")?.closest(".pf-png-resolution-control")?.remove();
    };
  }, []);

  return null;
}
