import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const LEVEL_WIDTHS = [1800, 2625, 5250, 10500, 21000, 42000];
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const MAX_VISIBLE_TILES = 8;
const FIT_TILE_LIMIT = 12;
const SETTLE_MS = 70;

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function chooseLevel(displayWidthPx) {
  return LEVEL_WIDTHS.find((width) => width >= displayWidthPx * 0.82) || LEVEL_WIDTHS.at(-1);
}

function tileKey(level, col, row) {
  return `${level}:${col}:${row}`;
}

export default function OverviewWindowsRasterRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let canvas = null;
    let ctx = null;
    let observer = null;
    let resizeObserver = null;
    let settleTimer = 0;
    let renderEpoch = 0;
    let abortController = null;
    let bounds = null;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let renderedCamera = { scale: 1, tx: 0, ty: 0 };

    const stats = {
      mode: "windows-viewport-canvas",
      platform: "windows",
      activeTiles: 0,
      pendingTiles: 0,
      tileCeiling: MAX_VISIBLE_TILES,
      fitTileCeiling: FIT_TILE_LIMIT,
      loadedTiles: 0,
      releasedBitmaps: 0,
      failedTiles: 0,
      canvasCount: 1,
      cacheMode: "no-store",
      pdfRuntimeLoaded: false,
      iframeOpened: false,
    };
    window.__plotflowOverviewRuntime = stats;
    window.__plotflowWindowsRasterCanvas = stats;

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
      if (!stage) return;
      if (!canvas?.isConnected) {
        canvas = document.createElement("canvas");
        canvas.className = "pf-overview-windows-raster-canvas";
        Object.assign(canvas.style, {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: "1",
          display: "block",
          transformOrigin: "0 0",
          willChange: "auto",
        });
        stage.prepend(canvas);
        ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      }
      const width = Math.max(1, Math.round(stage.clientWidth || 1));
      const height = Math.max(1, Math.round(stage.clientHeight || 1));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    function visibleJobs(level) {
      if (!bounds) return [];
      const info = levelInfo(level);
      const scale = Math.max(0.0001, camera.scale);
      const worldLeft = (0 - camera.tx) / scale;
      const worldTop = (0 - camera.ty) / scale;
      const worldRight = (bounds.rectWidth - camera.tx) / scale;
      const worldBottom = (bounds.rectHeight - camera.ty) / scale;
      const sourceLeft = (worldLeft - bounds.x) / bounds.fit;
      const sourceTop = (worldTop - bounds.y) / bounds.fit;
      const sourceRight = (worldRight - bounds.x) / bounds.fit;
      const sourceBottom = (worldBottom - bounds.y) / bounds.fit;
      const sx0 = Math.max(0, Math.min(BASE_WIDTH, sourceLeft));
      const sy0 = Math.max(0, Math.min(BASE_HEIGHT, sourceTop));
      const sx1 = Math.max(0, Math.min(BASE_WIDTH, sourceRight));
      const sy1 = Math.max(0, Math.min(BASE_HEIGHT, sourceBottom));
      if (sx1 <= sx0 || sy1 <= sy0) return [];

      const levelScaleX = info.width / BASE_WIDTH;
      const levelScaleY = info.height / BASE_HEIGHT;
      const firstCol = Math.max(0, Math.floor((sx0 * levelScaleX) / TILE_SIZE));
      const firstRow = Math.max(0, Math.floor((sy0 * levelScaleY) / TILE_SIZE));
      const lastCol = Math.min(info.cols - 1, Math.floor(((sx1 * levelScaleX) - 0.001) / TILE_SIZE));
      const lastRow = Math.min(info.rows - 1, Math.floor(((sy1 * levelScaleY) - 0.001) / TILE_SIZE));
      const centerCol = ((sx0 + sx1) * 0.5 * levelScaleX) / TILE_SIZE;
      const centerRow = ((sy0 + sy1) * 0.5 * levelScaleY) / TILE_SIZE;
      const jobs = [];
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) {
          jobs.push({ col, row, distance: Math.hypot(col - centerCol, row - centerRow) });
        }
      }
      jobs.sort((a, b) => a.distance - b.distance);
      const atFit = camera.scale <= 1.001 && Math.abs(camera.tx) < 1 && Math.abs(camera.ty) < 1;
      return jobs.slice(0, atFit ? FIT_TILE_LIMIT : MAX_VISIBLE_TILES);
    }

    function tileRect(level, col, row) {
      const info = levelInfo(level);
      const levelScaleX = info.width / BASE_WIDTH;
      const levelScaleY = info.height / BASE_HEIGHT;
      const tileLeft = col * TILE_SIZE;
      const tileTop = row * TILE_SIZE;
      const tileRight = Math.min(info.width, tileLeft + TILE_SIZE);
      const tileBottom = Math.min(info.height, tileTop + TILE_SIZE);
      const baseLeft = bounds.x + (tileLeft / levelScaleX) * bounds.fit;
      const baseTop = bounds.y + (tileTop / levelScaleY) * bounds.fit;
      const baseRight = bounds.x + (tileRight / levelScaleX) * bounds.fit;
      const baseBottom = bounds.y + (tileBottom / levelScaleY) * bounds.fit;
      const left = camera.tx + baseLeft * camera.scale;
      const top = camera.ty + baseTop * camera.scale;
      const right = camera.tx + baseRight * camera.scale;
      const bottom = camera.ty + baseBottom * camera.scale;
      return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    }

    function transformSnapshot() {
      if (!canvas || !renderedCamera.scale) return;
      const ratio = camera.scale / renderedCamera.scale;
      const dx = camera.tx - renderedCamera.tx * ratio;
      const dy = camera.ty - renderedCamera.ty * ratio;
      canvas.style.transform = `translate(${dx}px, ${dy}px) scale(${ratio})`;
    }

    async function refresh() {
      if (disposed || !stage || !canvas || !ctx || !bounds) return;
      const epoch = ++renderEpoch;
      abortController?.abort();
      abortController = new AbortController();
      const signal = abortController.signal;
      canvas.style.transform = "none";
      ensureCanvas();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const nextLevel = chooseLevel(bounds.width * camera.scale);
      const jobs = visibleJobs(nextLevel);
      stats.currentLevel = nextLevel;
      stats.activeTiles = 0;
      stats.pendingTiles = jobs.length;
      stats.tileKeys = jobs.map((job) => tileKey(nextLevel, job.col, job.row));

      for (const job of jobs) {
        if (disposed || epoch !== renderEpoch || signal.aborted) break;
        let bitmap = null;
        try {
          const response = await fetch(`${TILE_BASE}/${nextLevel}/${job.col}_${job.row}.webp`, {
            cache: "no-store",
            signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          bitmap = await createImageBitmap(blob);
          if (disposed || epoch !== renderEpoch || signal.aborted) continue;
          const rect = tileRect(nextLevel, job.col, job.row);
          ctx.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
          stats.loadedTiles += 1;
          stats.activeTiles += 1;
          stats.pendingTiles = Math.max(0, stats.pendingTiles - 1);
        } catch (error) {
          if (!signal.aborted) {
            stats.failedTiles += 1;
            stats.pendingTiles = Math.max(0, stats.pendingTiles - 1);
            console.debug("Windows Overview canvas tile skipped", error);
          }
        } finally {
          if (bitmap) {
            try { bitmap.close(); } catch {}
            stats.releasedBitmaps += 1;
          }
        }
      }

      if (disposed || epoch !== renderEpoch) return;
      renderedCamera = { ...camera };
      stats.pendingTiles = 0;
      stats.activeTiles = 0;
      stage.classList.add("pf-pdf-crisp-ready");
    }

    function scheduleRefresh(delay = SETTLE_MS) {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(refresh, delay);
    }

    function onCamera(event) {
      const next = event.detail || {};
      if (!Number.isFinite(next.scale)) return;
      camera = { scale: next.scale, tx: Number(next.tx) || 0, ty: Number(next.ty) || 0 };
      transformSnapshot();
      window.clearTimeout(settleTimer);
      if (!next.dragging) scheduleRefresh();
    }

    function onResize() {
      if (!stage) return;
      publishBounds();
      ensureCanvas();
      scheduleRefresh(0);
    }

    function detach() {
      window.clearTimeout(settleTimer);
      abortController?.abort();
      abortController = null;
      renderEpoch += 1;
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
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
      detach();
      stage = nextStage;
      camera = { scale: 1, tx: 0, ty: 0 };
      renderedCamera = { ...camera };
      publishBounds();
      ensureCanvas();
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(stage);
      scheduleRefresh(0);
    }

    function sync() {
      const next = document.querySelector('.pf-masterplan-stage[data-overview-render-mode="raster"]');
      if (next) attach(next);
      else if (stage) detach();
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
      detach();
      delete window.__plotflowOverviewRuntime;
      delete window.__plotflowWindowsRasterCanvas;
    };
  }, []);

  return null;
}
