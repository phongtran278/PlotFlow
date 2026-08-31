import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const LEVEL_WIDTHS = [1800, 2625, 5250, 10500, 21000, 42000];
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const MAX_DPR = 1.25;
const MAX_VISIBLE_TILES = 16;
const MAX_PARALLEL_LOADS = 4;
const SETTLE_MS = 45;

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function chooseLevel(displayWidthPx) {
  return LEVEL_WIDTHS.find((width) => width >= displayWidthPx * 0.9) || LEVEL_WIDTHS.at(-1);
}

function tileKey(level, col, row) {
  return `${level}:${col}:${row}`;
}

function releaseImage(image) {
  if (!image) return;
  try { image.onload = null; image.onerror = null; } catch {}
  try { image.src = ""; } catch {}
  try { image.removeAttribute("src"); } catch {}
  try { image.remove(); } catch {}
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.draggable = false;
    image.alt = "";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Overview raster tile failed: ${url}`));
    image.src = url;
  });
}

function snapToDevicePixel(value, dpr) {
  return Math.round(value * dpr) / dpr;
}

export default function OverviewRasterRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let layer = null;
    let observer = null;
    let resizeObserver = null;
    let settleTimer = 0;
    let renderEpoch = 0;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let bounds = null;
    const tiles = new Map();

    const stats = {
      mode: "viewport-raster-tiles",
      source: "prepared-masterplan-page-1",
      group: "",
      pdfRuntimeLoaded: false,
      iframeOpened: false,
      currentLevel: 0,
      activeTiles: 0,
      pendingTiles: 0,
      tileCeiling: MAX_VISIBLE_TILES,
      loadedTiles: 0,
      releasedTiles: 0,
      failedTiles: 0,
      cameraTransformOnRaster: false,
    };
    window.__plotflowOverviewRuntime = stats;

    function updateStats() {
      stats.group = stage?.dataset?.overviewGroup || "";
      stats.activeTiles = tiles.size;
    }

    function ensureLayer() {
      if (!stage || layer?.isConnected) return;
      layer = document.createElement("div");
      layer.className = "pf-overview-raster-viewport";
      Object.assign(layer.style, {
        position: "absolute",
        inset: "0",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: "1",
      });
      stage.prepend(layer);
    }

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
      const firstCol = Math.max(0, Math.floor((sx0 * levelScaleX) / TILE_SIZE) - 1);
      const firstRow = Math.max(0, Math.floor((sy0 * levelScaleY) / TILE_SIZE) - 1);
      const lastCol = Math.min(info.cols - 1, Math.floor(((sx1 * levelScaleX) - 0.001) / TILE_SIZE) + 1);
      const lastRow = Math.min(info.rows - 1, Math.floor(((sy1 * levelScaleY) - 0.001) / TILE_SIZE) + 1);
      const centerCol = ((sx0 + sx1) * 0.5 * levelScaleX) / TILE_SIZE;
      const centerRow = ((sy0 + sy1) * 0.5 * levelScaleY) / TILE_SIZE;
      const jobs = [];

      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) {
          jobs.push({ col, row, distance: Math.hypot(col - centerCol, row - centerRow) });
        }
      }
      jobs.sort((a, b) => a.distance - b.distance);
      return jobs.slice(0, MAX_VISIBLE_TILES);
    }

    function positionTile(image, level, col, row) {
      if (!bounds || !image) return;
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

      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const left = snapToDevicePixel(camera.tx + baseLeft * camera.scale, dpr);
      const top = snapToDevicePixel(camera.ty + baseTop * camera.scale, dpr);
      const right = snapToDevicePixel(camera.tx + baseRight * camera.scale, dpr);
      const bottom = snapToDevicePixel(camera.ty + baseBottom * camera.scale, dpr);

      image.className = "pf-overview-raster-tile";
      Object.assign(image.style, {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(0.5, right - left)}px`,
        height: `${Math.max(0.5, bottom - top)}px`,
        maxWidth: "none",
        pointerEvents: "none",
        userSelect: "none",
        display: "block",
        transform: "none",
      });
    }

    function repositionExistingTiles() {
      for (const entry of tiles.values()) {
        positionTile(entry.image, entry.level, entry.col, entry.row);
      }
    }

    function releaseExcept(keep) {
      for (const [key, entry] of tiles) {
        if (keep.has(key)) continue;
        tiles.delete(key);
        releaseImage(entry.image);
        stats.releasedTiles += 1;
      }
      updateStats();
    }

    async function refreshTiles() {
      if (!stage || !layer || !bounds || disposed) return;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const level = chooseLevel(bounds.width * camera.scale * dpr);
      stats.currentLevel = level;
      const jobs = visibleJobs(level);
      const keep = new Set(jobs.map((job) => tileKey(level, job.col, job.row)));
      const epoch = ++renderEpoch;
      const staging = new Map();
      const missing = jobs.filter((job) => !tiles.has(tileKey(level, job.col, job.row)));
      stats.pendingTiles = missing.length;

      let cursor = 0;
      async function worker() {
        while (!disposed && epoch === renderEpoch) {
          const job = missing[cursor++];
          if (!job) return;
          const key = tileKey(level, job.col, job.row);
          let image = null;
          try {
            image = await loadImage(`${TILE_BASE}/${level}/${job.col}_${job.row}.webp`);
            if (disposed || epoch !== renderEpoch || !layer?.isConnected || !keep.has(key)) {
              releaseImage(image);
              stats.releasedTiles += 1;
              continue;
            }
            positionTile(image, level, job.col, job.row);
            staging.set(key, { image, level, col: job.col, row: job.row });
          } catch (error) {
            stats.failedTiles += 1;
            console.debug("Overview raster tile skipped", error);
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_LOADS, Math.max(1, missing.length)) }, () => worker()));
      if (disposed || epoch !== renderEpoch || !layer?.isConnected) {
        for (const entry of staging.values()) releaseImage(entry.image);
        stats.releasedTiles += staging.size;
        stats.pendingTiles = 0;
        return;
      }

      for (const [key, entry] of staging) {
        if (tiles.has(key)) {
          releaseImage(entry.image);
          stats.releasedTiles += 1;
          continue;
        }
        layer.appendChild(entry.image);
        tiles.set(key, entry);
        stats.loadedTiles += 1;
      }

      releaseExcept(keep);
      repositionExistingTiles();
      stats.pendingTiles = 0;
      updateStats();
      if (tiles.size) stage.classList.add("pf-pdf-crisp-ready");
    }

    function scheduleRefresh(delay = SETTLE_MS) {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(refreshTiles, delay);
    }

    function onCamera(event) {
      const next = event.detail || {};
      if (!Number.isFinite(next.scale)) return;
      camera = { scale: next.scale, tx: next.tx || 0, ty: next.ty || 0 };
      repositionExistingTiles();
      window.clearTimeout(settleTimer);
      if (!next.dragging) scheduleRefresh();
    }

    function releaseAll() {
      renderEpoch += 1;
      window.clearTimeout(settleTimer);
      for (const entry of tiles.values()) releaseImage(entry.image);
      stats.releasedTiles += tiles.size;
      tiles.clear();
      layer?.remove();
      layer = null;
      stats.pendingTiles = 0;
      updateStats();
    }

    function detachStage() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
      releaseAll();
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

    function onResize() {
      if (!stage) return;
      publishBounds();
      repositionExistingTiles();
      scheduleRefresh(70);
    }

    function attach(nextStage) {
      if (!nextStage || nextStage.dataset.overviewRenderMode !== "raster") return;
      if (stage === nextStage && layer?.isConnected) return;
      detachStage();
      stage = nextStage;
      camera = { scale: 1, tx: 0, ty: 0 };
      ensureLayer();
      publishBounds();
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(stage);
      scheduleRefresh(0);
      updateStats();
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
