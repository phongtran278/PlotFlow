import { useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./OverviewPdfRuntime.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PDF_URL = "/masterplan/masterplan.pdf";
const MAX_DPR = 2;

export default function OverviewPdfRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let canvas = null;
    let ctx = null;
    let bufferCanvas = null;
    let bufferCtx = null;
    let pdf = null;
    let page = null;
    let resizeObserver = null;
    let renderTask = null;
    let renderTimer = 0;
    let renderGeneration = 0;
    let renderedCamera = { scale: 1, tx: 0, ty: 0 };
    let pendingCamera = { scale: 1, tx: 0, ty: 0 };

    function ensureCanvasSize(rect, dpr) {
      if (!canvas || !bufferCanvas) return;
      const pixelW = Math.max(2, Math.round(rect.width * dpr));
      const pixelH = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      if (bufferCanvas.width !== pixelW || bufferCanvas.height !== pixelH) {
        bufferCanvas.width = pixelW;
        bufferCanvas.height = pixelH;
      }
    }

    function snapshotTransform(camera) {
      if (!canvas) return;
      const base = renderedCamera;
      const ratio = camera.scale / Math.max(0.0001, base.scale);
      const dx = camera.tx - ratio * base.tx;
      const dy = camera.ty - ratio * base.ty;
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${ratio})`;
    }

    async function renderCamera(camera) {
      if (!stage || !canvas || !ctx || !bufferCanvas || !bufferCtx || !page || disposed) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const generation = ++renderGeneration;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      ensureCanvasSize(rect, dpr);

      const pixelW = bufferCanvas.width;
      const pixelH = bufferCanvas.height;
      const baseViewport = page.getViewport({ scale: 1 });
      const fit = Math.min(rect.width / baseViewport.width, rect.height / baseViewport.height);
      const baseX = (rect.width - baseViewport.width * fit) / 2;
      const baseY = (rect.height - baseViewport.height * fit) / 2;
      const viewport = page.getViewport({ scale: fit * camera.scale * dpr });
      const translateX = (camera.tx + camera.scale * baseX) * dpr;
      const translateY = (camera.ty + camera.scale * baseY) * dpr;

      try { renderTask?.cancel?.(); } catch { /* noop */ }

      bufferCtx.save();
      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufferCtx.clearRect(0, 0, pixelW, pixelH);
      bufferCtx.fillStyle = "#fff";
      bufferCtx.fillRect(0, 0, pixelW, pixelH);
      bufferCtx.restore();

      renderTask = page.render({
        canvasContext: bufferCtx,
        viewport,
        transform: [1, 0, 0, 1, translateX, translateY],
        background: "#ffffff",
        intent: "display",
      });

      try {
        await renderTask.promise;
        if (disposed || generation !== renderGeneration) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bufferCanvas, 0, 0);
        ctx.restore();

        renderedCamera = { ...camera };
        canvas.style.transform = "none";
        stage.classList.add("pf-pdf-crisp-ready");
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") console.warn("Overview PDF render failed", error);
      }
    }

    function scheduleRender(camera, delay = 90) {
      pendingCamera = { ...camera };
      window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => renderCamera(pendingCamera), delay);
    }

    function onCamera(event) {
      const camera = event.detail || {};
      if (!Number.isFinite(camera.scale)) return;
      pendingCamera = { scale: camera.scale, tx: camera.tx || 0, ty: camera.ty || 0 };
      snapshotTransform(pendingCamera);

      // While the camera is moving, keep the last crisp frame and only transform it.
      // Render the expensive PDF frame once the motion settles.
      if (camera.dragging) {
        window.clearTimeout(renderTimer);
        return;
      }
      scheduleRender(pendingCamera, 45);
    }

    async function attach(nextStage) {
      stage = nextStage;
      if (!stage || stage.dataset.pfPdfViewportReady === "1") return;
      stage.dataset.pfPdfViewportReady = "1";

      const iframe = stage.querySelector(".pf-masterplan-pdf");
      if (iframe) iframe.classList.add("pf-pdf-fallback");

      canvas = document.createElement("canvas");
      canvas.className = "pf-overview-pdf-canvas";
      stage.prepend(canvas);
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

      bufferCanvas = document.createElement("canvas");
      bufferCtx = bufferCanvas.getContext("2d", { alpha: false });

      try {
        pdf = await pdfjsLib.getDocument({ url: PDF_URL, isEvalSupported: false }).promise;
        if (disposed) return;
        page = await pdf.getPage(1);
        if (disposed) return;
        await renderCamera(pendingCamera);
      } catch (error) {
        console.warn("Overview PDF.js unavailable; keeping browser PDF fallback", error);
        canvas?.remove();
        canvas = null;
        bufferCanvas = null;
        if (iframe) iframe.classList.remove("pf-pdf-fallback");
        return;
      }

      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(() => scheduleRender(pendingCamera, 80));
      resizeObserver.observe(stage);
    }

    function sync() {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage.dataset.pfPdfViewportReady !== "1") attach(nextStage);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      renderGeneration += 1;
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      window.clearTimeout(renderTimer);
      try { renderTask?.cancel?.(); } catch { /* noop */ }
      try { pdf?.destroy?.(); } catch { /* noop */ }
      canvas?.remove();
      bufferCanvas = null;
      bufferCtx = null;
      if (stage) delete stage.dataset.pfPdfViewportReady;
    };
  }, []);

  return null;
}
