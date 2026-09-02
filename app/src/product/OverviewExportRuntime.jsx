import { useEffect } from "react";
import { toPng } from "html-to-image";

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

function exportPixelRatio(stage) {
  const area = Math.max(1, stage.clientWidth * stage.clientHeight);
  const ratioForBudget = Math.sqrt(18_000_000 / area);
  return Math.max(2.5, Math.min(4, ratioForBudget));
}

async function cropToPdfBounds(stage, dataUrl) {
  const x = Number(stage.dataset.pfPdfX);
  const y = Number(stage.dataset.pfPdfY);
  const width = Number(stage.dataset.pfPdfWidth);
  const height = Number(stage.dataset.pfPdfHeight);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return dataUrl;
  const image = await imageFromDataUrl(dataUrl);
  const stageWidth = Math.max(1, stage.clientWidth);
  const stageHeight = Math.max(1, stage.clientHeight);
  const scaleX = image.naturalWidth / stageWidth;
  const scaleY = image.naturalHeight / stageHeight;
  const sx = Math.max(0, Math.round(x * scaleX));
  const sy = Math.max(0, Math.round(y * scaleY));
  const sw = Math.min(image.naturalWidth - sx, Math.max(1, Math.round(width * scaleX)));
  const sh = Math.min(image.naturalHeight - sy, Math.max(1, Math.round(height * scaleY)));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png", 1);
}

function download(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.click();
}

export default function OverviewExportRuntime() {
  useEffect(() => {
    async function onClick(event) {
      const button = event.target.closest?.(".pf-overview-editor-toolbar [data-action='pdf'],.pf-overview-editor-toolbar [data-action='png']");
      if (!button) return;
      const stage = button.closest(".pf-masterplan-stage");
      if (!stage) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const action = button.dataset.action;

      if (action === "pdf") {
        const sourcePdf = stage.dataset.overviewPdfUrl;
        if (sourcePdf) download(sourcePdf, "PlotFlow-Overview-vector.pdf");
        return;
      }

      const toolbar = stage.querySelector(".pf-overview-editor-toolbar");
      const fit = toolbar?.querySelector("[data-action='fit']");
      fit?.click();
      await wait(180);

      const previous = toolbar?.style.display || "";
      if (toolbar) toolbar.style.display = "none";
      stage.classList.add("is-exporting-overview");

      try {
        const fullDataUrl = await toPng(stage, {
          pixelRatio: exportPixelRatio(stage),
          cacheBust: true,
          backgroundColor: "#ffffff",
        });
        const dataUrl = await cropToPdfBounds(stage, fullDataUrl);
        download(dataUrl, "PlotFlow-Overview.png");
      } finally {
        if (toolbar) toolbar.style.display = previous;
        stage.classList.remove("is-exporting-overview");
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
