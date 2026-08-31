import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const FIXED_LEVEL = 1800;
const SHARP_LEVELS = [10500, 21000, 42000];
const SHARP_SETTLE_MS = 260;
const SHARP_TILE_CEILING = 6;
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

function sharpLevelFor(scale) {
  if (scale >= 20) return SHARP_LEVELS[2];
  if (scale >= 9) return SHARP_LEVELS[1];
  if (scale >= 4) return SHARP_LEVELS[0];
  return 0;
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
    let sharpTimer = 0;
    let sharpEpoch = 0;
    let lastSharpSignature = "";
    const bitmaps = new Map();
    const info = levelInfo(FIXED_LEVEL);
    const totalTiles = info.cols * info.rows;

    const stats = {
      mode: "windows-bounded-sharp-canvas",
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
      sharpOnSettle: true,
      sharpLevel: 0,
      sharpTileCeiling: SHARP_TILE_CEILING,
      sharpFetchCount: 0,
      sharpTilesDrawn: 0,
      sharpReleasedBitmaps: 0,
      sharpPending: 0,
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
      lastSharpSignature = "";
      sharpEpoch += 1;
      scheduleDraw();
      scheduleSharp();
    }

    function drawEntry(bitmap, level, col, row) {
      if (!bitmap || !ctx || !canvas || !bounds) return false;
      const levelMetrics = levelInfo(level);
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
      for (const entry of bitmaps.values()) drawEntry(entry.bitmap, FIXED_LEVEL, entry.col, entry.row);
      stats.drawCount += 1;
      stats.activeBitmaps = bitmaps.size;
    }

    function scheduleDraw() {
      if (raf) return;
      raf = window.requestAnimationFrame(drawNow);
    }

    function visibleSharpJobs(level) {
      if (!bounds || !canvas) return [];
      const levelMetrics = levelInfo(level);
      const scale = Math.max(0.0001, camera.scale);
      const worldLeft = (0 - camera.tx) / scale;
      const worldTop = (0 - camera.ty) / scale;
      const worldRight = (canvas.width - camera.tx) / scale;
      const worldBottom = (canvas.height - camera.ty) / scale;
      const sourceLeft = (worldLeft - bounds.x) / bounds.fit;
      const sourceTop = (worldTop - bounds.y) / bounds.fit;
      const sourceRight = (worldRight - bounds.x) / bounds.fit;
      const sourceBottom = (worldBottom - bounds.y) / bounds.fit;
      const sx0 = Math.max(0, Math.min(BASE_WIDTH, sourceLeft));
      const sy0 = Math.max(0, Math.min(BASE_HEIGHT, sourceTop));
      const sx1 = Math.max(0, Math.min(BASE_WIDTH, sourceRight));
      const sy1 = Math.max(0, Math.min(BASE_HEIGHT, sourceBottom));
      if (sx1 <= sx0 || sy1 <= sy0) return [];

      const levelScaleX = levelMetrics.width / BASE_WIDTH;
      const levelScaleY = levelMetrics.height / BASE_HEIGHT;
      const firstCol = Math.max(0, Math.floor((sx0 * levelScaleX) / TILE_SIZE));
      const firstRow = Math.max(0, Math.floor((sy0 * levelScaleY) / TILE_SIZE));
      const lastCol = Math.min(levelMetrics.cols - 1, Math.floor(((sx1 * levelScaleX) - 0.001) / TILE_SIZE));
      const lastRow = Math.min(levelMetrics.rows - 1, Math.floor(((sy1 * levelScaleY) - 0.001) / TILE_SIZE));
      const centerCol = ((sx0 + sx1) * 0.5 * levelScaleX) / TILE_SIZE;
      const centerRow = ((sy0 + sy1) * 0.5 * levelScaleY) / TILE_SIZE;
      const jobs = [];
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) {
          jobs.push({ col, row, distance: Math.hypot(col - centerCol, row - centerRow) });
        }
      }
      jobs.sort((a, b) => a.distance - b.distance);
      return jobs.slice(0, SHARP_TILE_CEILING);
    }

    async function renderSharpPatch() {
      sharpTimer = 0;
      if (disposed || !ctx || !canvas || !bounds || bitmaps.size < totalTiles) {
        if (!disposed && camera.scale >= 4) scheduleSharp(140);
        return;
      }
      const level = sharpLevelFor(camera.scale);
      stats.sharpLevel = level;
      if (!level) return;
      const signature = [level, Math.round(camera.scale * 20), Math.round(camera.tx / 20), Math.round(camera.ty / 20)].join(":");
      if (signature === lastSharpSignature) return;
      const jobs = visibleSharpJobs(level);
      if (!jobs.length) return;

      const epoch = ++sharpEpoch;
      stats.sharpPending = jobs.length;
      let cursor = 0;
      async function worker() {
        while (!disposed && epoch === sharpEpoch) {
          const job = jobs[cursor++];
          if (!job) return;
          let bitmap = null;
          try {
            stats.sharpFetchCount += 1;
            const response = await fetch(`${TILE_BASE}/${level}/${job.col}_${job.row}.webp`, { cache: "force-cache" });
            if (!response.ok) throw new Error(`tile ${response.status}`);
            const blob = await response.blob();
            bitmap = await createImageBitmap(blob);
            if (disposed || epoch !== sharpEpoch) continue;
            if (drawEntry(bitmap, level, job.col, job.row)) stats.sharpTilesDrawn += 1;
          } catch (error) {
            stats.failedTiles += 1;
            console.debug("Windows sharp tile skipped", error);
          } finally {
            if (bitmap) {
              bitmap.close?.();
              stats.sharpReleasedBitmaps += 1;
            }
          }
        }
      }
      await Promise.all([worker(), worker()]);
      if (disposed || epoch !== sharpEpoch) return;
      stats.sharpPending = 0;
      lastSharpSignature = signature;
      stage?.classList.add("pf-pdf-crisp-ready");
    }

    function scheduleSharp(delay = SHARP_SETTLE_MS) {
      window.clearTimeout(sharpTimer);
      sharpTimer = 0;
      if (camera.scale < 4 || disposed) {
        stats.sharpLevel = 0;
        return;
      }
      sharpTimer = window.setTimeout(renderSharpPatch, delay);
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
      scheduleSharp(80);
    }

    function onCamera(event) {
      const next = event.detail || {};
      if (!Number.isFinite(next.scale)) return;
      camera = { scale: next.scale, tx: next.tx || 0, ty: next.ty || 0 };
      sharpEpoch += 1;
      lastSharpSignature = "";
      window.clearTimeout(sharpTimer);
      sharpTimer = 0;
      scheduleDraw();
      if (!next.dragging) scheduleSharp();
    }

    function detachStage() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
      window.clearTimeout(sharpTimer);
      sharpTimer = 0;
      sharpEpoch += 1;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      for (const entry of bitmaps.values()) entry.bitmap.close?.();
      bitmaps.clear();
      stats.activeBitmaps = 0;
      stats.sharpPending = 0;
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
