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

function download(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
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

async function downloadPdf(source, filename) {
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error(`PDF request failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") {
    const preview = new TextDecoder().decode(bytes.slice(0, 80));
    if (preview.includes("git-lfs.github.com/spec")) {
      throw new Error("The deployed PDF is still a Git LFS pointer, not PDF bytes.");
    }
    throw new Error("The deployed file is not a valid PDF.");
  }
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  try {
    download(blobUrl, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  }
}

function installResolutionControl() {
  const toolbar = currentToolbar();
  const pngButton = toolbar?.querySelector?.("[data-action='png']");
  if (!toolbar || !pngButton) return false;
  if (toolbar.querySelector("[data-png-resolution]")) return true;

  const label = document.createElement("label");
  label.className = "pf-png-resolution-control";
  label.title = "PNG export resolution";
  label.innerHTML = `<span>PNG res</span><select data-png-resolution aria-label="PNG export resolution"><option value="2">2×</option><option value="3">3×</option><option value="4" selected>4×</option></select>`;
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

      if (action === "pdf") {
        const sourcePdf = currentPdfSource(stage);
        if (!sourcePdf) return;
        const group = String(stage.dataset.overviewGroup || "Overview").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        button.disabled = true;
        try {
          await downloadPdf(sourcePdf, `PlotFlow-${group || "Overview"}-vector.pdf`);
        } catch (error) {
          console.error("Overview PDF export failed", error);
          window.alert(`PDF export chưa thể hoàn tất: ${error.message}`);
        } finally {
          button.disabled = false;
        }
        return;
      }

      const toolbar = currentToolbar();
      const fit = toolbar?.querySelector("[data-action='fit']");
      fit?.click();
      await wait(180);

      const requestedRatio = Number(toolbar?.querySelector("[data-png-resolution]")?.value || 4);
      const pixelRatio = Math.max(2, Math.min(4, requestedRatio));
      stage.classList.add("is-exporting-overview");

      try {
        const fullDataUrl = await toPng(stage, {
          pixelRatio,
          cacheBust: true,
          backgroundColor: "#ffffff",
        });
        const dataUrl = await cropToPdfBounds(stage, fullDataUrl);
        const boundsWidth = Number(stage.dataset.pfPdfWidth) || stage.clientWidth;
        const boundsHeight = Number(stage.dataset.pfPdfHeight) || stage.clientHeight;
        const width = Math.round(boundsWidth * pixelRatio);
        const height = Math.round(boundsHeight * pixelRatio);
        download(dataUrl, `PlotFlow-Overview-${width}x${height}.png`);
      } finally {
        stage.classList.remove("is-exporting-overview");
      }
    }

    syncResolutionControl();
    observer = new MutationObserver(syncResolutionControl);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", onClick, true);
      document.querySelector("[data-png-resolution]")?.closest(".pf-png-resolution-control")?.remove();
    };
  }, []);

  return null;
}
