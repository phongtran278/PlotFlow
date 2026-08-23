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
      const toolbar = stage.querySelector(".pf-overview-editor-toolbar");
      const fit = toolbar?.querySelector("[data-action='fit']");
      fit?.click();
      await wait(180);

      const previous = toolbar?.style.display || "";
      if (toolbar) toolbar.style.display = "none";
      stage.classList.add("is-exporting-overview");

      try {
        const fullDataUrl = await toPng(stage, { pixelRatio: 2.5, cacheBust: true, backgroundColor: "#ffffff" });
        const dataUrl = await cropToPdfBounds(stage, fullDataUrl);
        if (action === "png") {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = "PlotFlow-Overview.png";
          link.click();
          return;
        }
        const popup = window.open("", "_blank");
        if (!popup) return;
        popup.opener = null;
        popup.document.write(`<!doctype html><html><head><title>PlotFlow Overview</title><style>@page{size:landscape;margin:0}html,body{margin:0;width:100%;height:100%;background:#fff}body{display:grid;place-items:center}img{display:block;max-width:100vw;max-height:100vh;width:100%;height:100%;object-fit:contain}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>window.print(),180)"></body></html>`);
        popup.document.close();
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
