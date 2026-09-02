import { useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./OverviewPdfRuntime.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const FALLBACK_PDF_URL = "/overview-masterplan/hoan-thien.pdf";
const MAX_DPR = 1.75;
const MAX_CRISP_RENDER_SCALE = 54;

export default function OverviewPdfRuntime() {
  useEffect(() => {
    let disposed = false;
    let suspended = document.visibilityState === "hidden";
    let stage = null;
    let canvas = null;
    let ctx = null;
    let bufferCanvas = null;
    let bufferCtx = null;
    let pdf = null;
    let page = null;
    let currentPdfUrl = "";
    let resizeObserver = null;
    let renderTask = null;
    let renderTimer = 0;
    let renderGeneration = 0;
    let trimFrame = null;
    let iframe = null;
    let iframeSrc = "";
    let hasRenderedFrame = false;
    let lastStageSize = { width: 0, height: 0 };
    let renderedCamera = { scale: 1, tx: 0, ty: 0 };
    let pendingCamera = { scale: 1, tx: 0, ty: 0 };

    const overviewPdfUrl = () => stage?.dataset?.overviewPdfUrl || FALLBACK_PDF_URL;

    function ensureCanvasSize(rect, dpr) {
      if (!canvas || !bufferCanvas) return;
      const width = Math.max(2, Math.round(rect.width * dpr));
      const height = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      if (bufferCanvas.width !== width || bufferCanvas.height !== height) {
        bufferCanvas.width = width;
        bufferCanvas.height = height;
      }
    }

    function computeBounds(rect, baseViewport, fit) {
      return {
        x: (rect.width - baseViewport.width * fit) / 2,
        y: (rect.height - baseViewport.height * fit) / 2,
        width: baseViewport.width * fit,
        height: baseViewport.height * fit,
      };
    }

    function publishPdfBounds(bounds) {
      if (!stage || !bounds) return;
      stage.dataset.pfPdfX = String(bounds.x);
      stage.dataset.pfPdfY = String(bounds.y);
      stage.dataset.pfPdfWidth = String(bounds.width);
      stage.dataset.pfPdfHeight = String(bounds.height);
      stage.style.setProperty("--pf-pdf-x", `${bounds.x}px`);
      stage.style.setProperty("--pf-pdf-y", `${bounds.y}px`);
      stage.style.setProperty("--pf-pdf-width", `${bounds.width}px`);
      stage.style.setProperty("--pf-pdf-height", `${bounds.height}px`);
      if (!trimFrame?.isConnected) {
        trimFrame = document.createElement("div");
        trimFrame.className = "pf-overview-pdf-trim-frame";
        stage.appendChild(trimFrame);
      }
      Object.assign(trimFrame.style, {
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      });
      applyTrimCamera(pendingCamera);
      window.dispatchEvent(new CustomEvent("pf-overview-pdf-bounds", { detail: bounds }));
    }

    function applyTrimCamera(camera) {
      if (!trimFrame) return;
      trimFrame.style.transformOrigin = "0 0";
      trimFrame.style.transform = `translate3d(${camera.tx || 0}px,${camera.ty || 0}px,0) scale(${camera.scale || 1})`;
    }

    function snapshotTransform(camera) {
      if (!canvas || suspended || !hasRenderedFrame) return;
      const base = renderedCamera;
      const ratio = camera.scale / Math.max(0.0001, base.scale);
      const dx = camera.tx - ratio * base.tx;
      const dy = camera.ty - ratio * base.ty;
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${ratio})`;
      stage?.classList.add("pf-pdf-preview-transform");
    }

    function releaseBrowserFallback() {
      if (!iframe) return;
      iframeSrc = iframeSrc || iframe.getAttribute("src") || "";
      iframe.removeAttribute("src");
      iframe.style.display = "none";
      iframe.dataset.pfReleased = "1";
    }

    function restoreBrowserFallback() {
      if (!iframe || !iframeSrc || hasRenderedFrame) return;
      iframe.style.display = "";
      if (!iframe.getAttribute("src")) iframe.setAttribute("src", iframeSrc);
      delete iframe.dataset.pfReleased;
    }

    async function renderCamera(camera) {
      if (!stage || !canvas || !ctx || !bufferCanvas || !bufferCtx || !page || disposed || suspended) return;
      if (camera.scale > MAX_CRISP_RENDER_SCALE) {
        snapshotTransform(camera);
        return;
      }

      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      lastStageSize = { width: rect.width, height: rect.height };
      const generation = ++renderGeneration;
      const dpr = Math.min(camera.scale > 12 ? 1.15 : MAX_DPR, window.devicePixelRatio || 1);
      ensureCanvasSize(rect, dpr);
      const baseViewport = page.getViewport({ scale: 1 });
      const fit = Math.min(rect.width / baseViewport.width, rect.height / baseViewport.height);
      const baseX = (rect.width - baseViewport.width * fit) / 2;
      const baseY = (rect.height - baseViewport.height * fit) / 2;
      const nextBounds = computeBounds(rect, baseViewport, fit);
      const viewport = page.getViewport({ scale: fit * camera.scale * dpr });
      const translateX = (camera.tx + camera.scale * baseX) * dpr;
      const translateY = (camera.ty + camera.scale * baseY) * dpr;

      try { renderTask?.cancel?.(); } catch { /* noop */ }
      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
      bufferCtx.fillStyle = "#fff";
      bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
      stage.classList.add("pf-pdf-rendering-deep");
      renderTask = page.render({
        canvasContext: bufferCtx,
        viewport,
        transform: [1, 0, 0, 1, translateX, translateY],
        background: "#fff",
        intent: "display",
      });

      try {
        await renderTask.promise;
        if (disposed || suspended || generation !== renderGeneration) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bufferCanvas, 0, 0);
        renderedCamera = { ...camera };
        hasRenderedFrame = true;
        canvas.style.transform = "none";
        publishPdfBounds(nextBounds);
        stage.classList.remove("pf-pdf-preview-transform", "pf-pdf-rendering-deep");
        stage.classList.add("pf-pdf-crisp-ready");
        releaseBrowserFallback();
        window.dispatchEvent(new CustomEvent("pf-overview-pdf-frame-ready", {
          detail: { url: currentPdfUrl, bounds: nextBounds },
        }));
      } catch (error) {
        stage?.classList.remove("pf-pdf-rendering-deep");
        if (error?.name !== "RenderingCancelledException") {
          console.warn("Overview PDF render failed", error);
          restoreBrowserFallback();
        }
      }
    }

    function scheduleRender(camera, delay = 45) {
      pendingCamera = { ...camera };
      clearTimeout(renderTimer);
      if (suspended) return;
      if (camera.scale > MAX_CRISP_RENDER_SCALE) {
        snapshotTransform(camera);
        return;
      }
      renderTimer = window.setTimeout(() => renderCamera(pendingCamera), delay);
    }

    function onCamera(event) {
      const camera = event.detail || {};
      if (!Number.isFinite(camera.scale)) return;
      pendingCamera = { scale: camera.scale, tx: camera.tx || 0, ty: camera.ty || 0 };
      applyTrimCamera(pendingCamera);
      if (suspended) return;
      snapshotTransform(pendingCamera);
      if (camera.dragging) {
        clearTimeout(renderTimer);
        return;
      }
      scheduleRender(pendingCamera, camera.scale > 12 ? 0 : 20);
    }

    function releaseBuffers() {
      renderGeneration += 1;
      clearTimeout(renderTimer);
      try { renderTask?.cancel?.(); } catch { /* noop */ }
      try { page?.cleanup?.(); } catch { /* noop */ }
      try { pdf?.cleanup?.(); } catch { /* noop */ }
      hasRenderedFrame = false;
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.style.transform = "none";
      }
      if (bufferCanvas) {
        bufferCanvas.width = 1;
        bufferCanvas.height = 1;
      }
      stage?.classList.remove("pf-pdf-crisp-ready", "pf-pdf-preview-transform", "pf-pdf-rendering-deep");
    }

    async function loadPdf(url) {
      if (!url || url === currentPdfUrl || disposed) return;
      const loadUrl = url;
      currentPdfUrl = loadUrl;
      renderGeneration += 1;
      clearTimeout(renderTimer);
      try { renderTask?.cancel?.(); } catch { /* noop */ }
      try { page?.cleanup?.(); } catch { /* noop */ }
      try { await pdf?.destroy?.(); } catch { /* noop */ }
      page = null;
      pdf = null;

      // Keep the previous complete frame, bounds and camera untouched until the
      // next group has a fully rendered frame ready to swap in.
      stage?.classList.remove("pf-pdf-rendering-deep");
      if (!hasRenderedFrame) stage?.classList.remove("pf-pdf-crisp-ready");

      try {
        const nextPdf = await pdfjsLib.getDocument({
          url: loadUrl,
          isEvalSupported: false,
          disableAutoFetch: true,
        }).promise;
        if (disposed || currentPdfUrl !== loadUrl) {
          await nextPdf.destroy?.();
          return;
        }
        pdf = nextPdf;
        page = await pdf.getPage(1);
        if (disposed || currentPdfUrl !== loadUrl) return;
        if (!suspended) await renderCamera(pendingCamera);
      } catch (error) {
        if (currentPdfUrl === loadUrl) currentPdfUrl = "";
        console.warn(`Overview PDF.js unavailable for ${loadUrl}`, error);
        restoreBrowserFallback();
      }
    }

    function onMemoryVisibility(event) {
      suspended = Boolean(event.detail?.hidden);
      if (suspended) {
        releaseBuffers();
        return;
      }
      if (!page) loadPdf(overviewPdfUrl());
      else scheduleRender(pendingCamera, 0);
    }

    function onGroupChanged() {
      // All three overview PDFs share the same artboard. Do not reset zoom/pan
      // or viewport on a handover-tab switch; only replace the rendered content.
      requestAnimationFrame(() => {
        const next = overviewPdfUrl();
        if (next !== currentPdfUrl) loadPdf(next);
        else scheduleRender(pendingCamera, 0);
      });
    }

    async function attach(nextStage) {
      stage = nextStage;
      if (!stage || stage.dataset.pfPdfViewportReady === "1") return;
      stage.dataset.pfPdfViewportReady = "1";
      iframe = stage.querySelector(".pf-masterplan-pdf");
      if (iframe) {
        iframe.classList.add("pf-pdf-fallback");
        iframeSrc = iframe.getAttribute("src") || "";
      }
      canvas = document.createElement("canvas");
      canvas.className = "pf-overview-pdf-canvas";
      stage.prepend(canvas);
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      bufferCanvas = document.createElement("canvas");
      bufferCtx = bufferCanvas.getContext("2d", { alpha: false });
      window.addEventListener("pf-overview-camera", onCamera);
      window.addEventListener("pf-overview-group-changed", onGroupChanged);
      resizeObserver = new ResizeObserver(() => {
        const rect = stage?.getBoundingClientRect();
        if (!rect) return;
        const changed = Math.abs(rect.width - lastStageSize.width) > 1 || Math.abs(rect.height - lastStageSize.height) > 1;
        if (changed) scheduleRender(pendingCamera, 80);
      });
      resizeObserver.observe(stage);
      await loadPdf(overviewPdfUrl());
    }

    function sync() {
      const next = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (next && next.dataset.pfPdfViewportReady !== "1") attach(next);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pf-memory-visibility", onMemoryVisibility);

    return () => {
      disposed = true;
      renderGeneration += 1;
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-memory-visibility", onMemoryVisibility);
      clearTimeout(renderTimer);
      try { renderTask?.cancel?.(); } catch { /* noop */ }
      try { page?.cleanup?.(); } catch { /* noop */ }
      try { pdf?.destroy?.(); } catch { /* noop */ }
      canvas?.remove();
      trimFrame?.remove();
      bufferCanvas = null;
      bufferCtx = null;
      if (stage) {
        delete stage.dataset.pfPdfViewportReady;
        delete stage.dataset.pfPdfX;
        delete stage.dataset.pfPdfY;
        delete stage.dataset.pfPdfWidth;
        delete stage.dataset.pfPdfHeight;
      }
    };
  }, []);

  return null;
}
