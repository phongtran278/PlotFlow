import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const FIXED_LEVEL = 1800;
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

export default function OverviewWindowsFixedBitmapRuntime() {
  useEffect(() => {
    if (!isWindows()) return undefined;

    let disposed = false;
    let stage = null;
    let canvas = null;
    let ctx = null;
    let observer = null;
    let resizeObserver = null;
    let bounds = null;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let raf = 0;
    const bitmaps = new Map();
    const info = levelInfo(FIXED_LEVEL);
    const totalTiles = info.cols * info.rows;

    const stats = {
      mode: "windows-fixed-bitmap-canvas-no-sharp",
      platform: "Windows",
      fixedLevel: FIXED_LEVEL,
      baseFixedUrlSet: true,
      bitmapCeiling: totalTiles,
      loadedTiles: 0,
      activeBitmaps: 0,
      fetchCount: 0,
      drawCount: 0,
      canvasCount: 1,
      failedTiles: 0,
      pdfRuntimeLoaded: false,
      iframeOpened: false,
      refetchOnCamera: false,
      sharpOnSettle: false,
      sharpLevel: 0,
      sharpTileCeiling: 0,
      sharpFetchCount: 0,
      sharpTilesDrawn: 0,
      sharpReleasedBitmaps: 0,
      sharpPending: 0,
      sharpCacheMode: "disabled",
    };
    window.__plotflowOverviewRuntime = stats;

    function publishBounds() {
      if (!stage) return null;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;
      const fit = Math.min(rect.width / BASE_WIDTH, rect.height / BASE_HEIGHT);
      const width = BASE_WIDTH * fit;
      const height = BASE_HEIGHT * fit;
      const x = (rect.width - width) / 2;
      const y = (rect.height - height) / 2;
      bounds = { x, y, width, height, fit, rectWidth: rect.width, rectHeight: rect.height };
      stage.dataset.pfPdfX = String(x);
      stage.dataset.pfPdfY = String(y);
      stage.dataset.pfPdfWidth = String(width);
      stage.dataset.pfPdfHeight = String(height);
      stage.style.setProperty("--pf-pdf-x", `${x}px`);
      stage.style.setProperty("--pf-pdf-y", `${y}px`);
      stage.style.setProperty("--pf-pdf-width", `${width}px`);
      stage.style.setProperty("--pf-pdf-height", `${height}px`);
      window.dispatchEvent(new CustomEvent("pf-overview-pdf-bounds", { detail: { x, y, width, height } }));
      return bounds;
    }

    function ensureCanvas() {
      if (!stage || canvas?.isConnected) return;
      canvas = document.createElement("canvas");
      canvas.className = "pf-overview-windows-fixed-bitmap-canvas";
      Object.assign(canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "1",
        transform: "none",
        willChange: "auto",
      });
      ctx = canvas.getContext("2d", { alpha: false });
      stage.prepend(canvas);
      resizeCanvas();
    }

    function resizeCanvas() {
      if (!stage || !canvas || !ctx) return;
      const width = Math.max(1, Math.round(stage.clientWidth || 1));
      const height = Math.max(1, Math.round(stage.clientHeight || 1));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      publishBounds();
      scheduleDraw();
    }

    function drawEntry(bitmap, col, row) {
      if (!bitmap || !ctx || !canvas || !bounds) return false;
      const levelMetrics = levelInfo(FIXED_LEVEL);
      const levelScaleX = levelMetrics.width / BASE_WIDTH;
      const levelScaleY = levelMetrics.height / BASE_HEIGHT;
      const tileLeft = col * TILE_SIZE;
      const tileTop = row * TILE_SIZE;
      const tileRight = Math.min(levelMetrics.width, tileLeft + bitmap.width);
      const tileBottom = Math.min(levelMetrics.height, tileTop + bitmap.height);
      const baseLeft = bounds.x + (tileLeft / levelScaleX) * bounds.fit;
      const baseTop = bounds.y + (tileTop / levelScaleY) * bounds.fit;
      const baseRight = bounds.x + (tileRight / levelScaleX) * bounds.fit;
      const baseBottom = bounds.y + (tileBottom / levelScaleY) * bounds.fit;
      const left = camera.tx + baseLeft * camera.scale;
      const top = camera.ty + baseTop * camera.scale;
      const right = camera.tx + baseRight * camera.scale;
      const bottom = camera.ty + baseBottom * camera.scale;
      if (right <= 0 || bottom <= 0 || left >= canvas.width || top >= canvas.height) return false;
      ctx.drawImage(bitmap, left, top, right - left, bottom - top);
      return true;
    }

    function drawNow() {
      raf = 0;
      if (disposed || !ctx || !canvas || !bounds) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const entry of bitmaps.values()) drawEntry(entry.bitmap, entry.col, entry.row);
      stats.drawCount += 1;
      stats.activeBitmaps = bitmaps.size;
    }

    function scheduleDraw() {
      if (raf) return;
      raf = window.requestAnimationFrame(drawNow);
    }

    async function loadFixedBitmaps() {
      if (bitmaps.size || disposed) return;
      for (let row = 0; row < info.rows && !disposed; row += 1) {
        for (let col = 0; col < info.cols && !disposed; col += 1) {
          try {
            stats.fetchCount += 1;
            const response = await fetch(`${TILE_BASE}/${FIXED_LEVEL}/${col}_${row}.webp`, { cache: "force-cache" });
            if (!response.ok) throw new Error(`tile ${response.status}`);
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);
            if (disposed) {
              bitmap.close?.();
              return;
            }
            bitmaps.set(`${col}:${row}`, { bitmap, col, row });
            stats.loadedTiles = bitmaps.size;
            stats.activeBitmaps = bitmaps.size;
            scheduleDraw();
          } catch (error) {
            stats.failedTiles += 1;
            console.debug("Windows fixed bitmap tile skipped", error);
          }
        }
      }
      stage?.classList.add("pf-pdf-crisp-ready");
    }

    function onCamera(event) {
      const next = event.detail || {};
      if (!Number.isFinite(next.scale)) return;
      camera = { scale: next.scale, tx: next.tx || 0, ty: next.ty || 0 };
      scheduleDraw();
    }

    function detachStage() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      for (const entry of bitmaps.values()) entry.bitmap.close?.();
      bitmaps.clear();
      stats.activeBitmaps = 0;
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.remove();
      }
      canvas = null;
      ctx = null;
      if (stage) {
        stage.classList.remove("pf-pdf-crisp-ready");
        delete stage.dataset.pfPdfX;
        delete stage.dataset.pfPdfY;
        delete stage.dataset.pfPdfWidth;
        delete stage.dataset.pfPdfHeight;
      }
      stage = null;
      bounds = null;
    }

    function attach(nextStage) {
      if (!nextStage || nextStage.dataset.overviewRenderMode !== "raster") return;
      if (stage === nextStage && canvas?.isConnected) return;
      detachStage();
      stage = nextStage;
      camera = { scale: 1, tx: 0, ty: 0 };
      ensureCanvas();
      publishBounds();
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(stage);
      loadFixedBitmaps();
    }

    function sync() {
      const next = document.querySelector('.pf-masterplan-stage[data-overview-render-mode="raster"]');
      if (next) attach(next);
      else if (stage) detachStage();
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-overview-render-mode", "data-overview-group"],
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      detachStage();
      delete window.__plotflowOverviewRuntime;
    };
  }, []);

  return null;
}
