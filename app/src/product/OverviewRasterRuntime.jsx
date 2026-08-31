import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const LEVEL_WIDTHS = [1800, 2625, 5250, 10500, 21000, 42000];
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const BASE_LEVEL_WIDTH = 1800;
const MAX_DPR = 1.25;
const MAX_DETAIL_TILES = 12;
const MAX_PARALLEL_LOADS = 4;
const SETTLE_MS = 65;

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function chooseLevel(displayWidthPx) {
  return LEVEL_WIDTHS.find((width) => width >= displayWidthPx * 0.9) || LEVEL_WIDTHS.at(-1);
}

function releaseImage(image) {
  if (!image) return;
  try { image.onload = null; image.onerror = null; } catch {}
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

function tileKey(level, col, row) {
  return `${level}:${col}:${row}`;
}

export default function OverviewRasterRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let world = null;
    let baseLayer = null;
    let detailLayer = null;
    let observer = null;
    let resizeObserver = null;
    let settleTimer = 0;
    let renderEpoch = 0;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let bounds = null;
    const baseTiles = new Map();
    const detailTiles = new Map();

    const stats = {
      mode: "bounded-raster-world",
      source: "prepared-masterplan-page-1",
      group: "",
      pdfRuntimeLoaded: false,
      iframeOpened: false,
      currentLevel: BASE_LEVEL_WIDTH,
      baseTiles: 0,
      detailTiles: 0,
      activeTiles: 0,
      tileCeiling: 12 + MAX_DETAIL_TILES,
      loadedTiles: 0,
      releasedTiles: 0,
      failedTiles: 0,
    };
    window.__plotflowOverviewRuntime = stats;

    function updateStats() {
      stats.group = stage?.dataset?.overviewGroup || "";
      stats.baseTiles = baseTiles.size;
      stats.detailTiles = detailTiles.size;
      stats.activeTiles = baseTiles.size + detailTiles.size;
    }

    function makeLayer(className) {
      const node = document.createElement("div");
      node.className = className;
      node.style.position = "absolute";
      node.style.inset = "0";
      node.style.pointerEvents = "none";
      return node;
    }

    function ensureWorld() {
      if (!stage || world?.isConnected) return;
      world = makeLayer("pf-overview-raster-world");
      world.style.transformOrigin = "0 0";
      world.style.zIndex = "1";
      baseLayer = makeLayer("pf-overview-raster-base");
      detailLayer = makeLayer("pf-overview-raster-detail");
      world.append(baseLayer, detailLayer);
      stage.prepend(world);
      applyCamera();
    }

    function applyCamera() {
      if (!world) return;
      world.style.transform = `translate3d(${camera.tx}px,${camera.ty}px,0) scale(${camera.scale})`;
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

    function positionTile(image, level, col, row) {
      if (!bounds) return;
      const info = levelInfo(level);
      const tileLeft = col * TILE_SIZE;
      const tileTop = row * TILE_SIZE;
      const tileWidth = Math.min(TILE_SIZE, info.width - tileLeft);
      const tileHeight = Math.min(TILE_SIZE, info.height - tileTop);
      const sx = info.width / BASE_WIDTH;
      const sy = info.height / BASE_HEIGHT;
      image.className = "pf-overview-raster-tile";
      image.style.position = "absolute";
      image.style.left = `${bounds.x + (tileLeft / sx) * bounds.fit}px`;
      image.style.top = `${bounds.y + (tileTop / sy) * bounds.fit}px`;
      image.style.width = `${(tileWidth / sx) * bounds.fit + 0.45}px`;
      image.style.height = `${(tileHeight / sy) * bounds.fit + 0.45}px`;
      image.style.maxWidth = "none";
      image.style.pointerEvents = "none";
      image.style.userSelect = "none";
    }

    async function loadBaseTiles() {
      if (!stage || !baseLayer || !bounds) return;
      const epoch = ++renderEpoch;
      const info = levelInfo(BASE_LEVEL_WIDTH);
      const jobs = [];
      for (let row = 0; row < info.rows; row += 1) {
        for (let col = 0; col < info.cols; col += 1) jobs.push({ col, row });
      }
      let cursor = 0;
      async function worker() {
        while (!disposed && epoch === renderEpoch) {
          const job = jobs[cursor++];
          if (!job) return;
          const key = tileKey(BASE_LEVEL_WIDTH, job.col, job.row);
          if (baseTiles.has(key)) continue;
          try {
            const image = await loadImage(`${TILE_BASE}/${BASE_LEVEL_WIDTH}/${job.col}_${job.row}.webp`);
            if (disposed || epoch !== renderEpoch || !baseLayer?.isConnected) {
              releaseImage(image);
              stats.releasedTiles += 1;
              continue;
            }
            positionTile(image, BASE_LEVEL_WIDTH, job.col, job.row);
            baseLayer.appendChild(image);
            baseTiles.set(key, image);
            stats.loadedTiles += 1;
            updateStats();
            if (baseTiles.size === 1) stage.classList.add("pf-pdf-crisp-ready");
          } catch (error) {
            stats.failedTiles += 1;
            console.debug("Overview base tile skipped", error);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_LOADS, jobs.length) }, () => worker()));
    }

    function visibleDetailJobs(level) {
      if (!bounds) return [];
      const info = levelInfo(level);
      const inv = 1 / Math.max(0.0001, camera.scale);
      const worldLeft = (0 - camera.tx) * inv;
      const worldTop = (0 - camera.ty) * inv;
      const worldRight = (bounds.rectWidth - camera.tx) * inv;
      const worldBottom = (bounds.rectHeight - camera.ty) * inv;
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
      return jobs.slice(0, MAX_DETAIL_TILES);
    }

    function releaseDetailExcept(keep) {
      for (const [key, image] of detailTiles) {
        if (keep.has(key)) continue;
        detailTiles.delete(key);
        releaseImage(image);
        stats.releasedTiles += 1;
      }
      updateStats();
    }

    async function refreshDetailTiles() {
      if (!stage || !bounds || !detailLayer) return;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const level = chooseLevel(bounds.width * camera.scale * dpr);
      stats.currentLevel = level;
      if (level <= BASE_LEVEL_WIDTH) {
        releaseDetailExcept(new Set());
        return;
      }

      const jobs = visibleDetailJobs(level);
      const keep = new Set(jobs.map((job) => tileKey(level, job.col, job.row)));
      releaseDetailExcept(keep);
      const missing = jobs.filter((job) => !detailTiles.has(tileKey(level, job.col, job.row)));
      const epoch = ++renderEpoch;
      let cursor = 0;

      async function worker() {
        while (!disposed && epoch === renderEpoch) {
          const job = missing[cursor++];
          if (!job) return;
          const key = tileKey(level, job.col, job.row);
          try {
            const image = await loadImage(`${TILE_BASE}/${level}/${job.col}_${job.row}.webp`);
            if (disposed || epoch !== renderEpoch || !detailLayer?.isConnected || !keep.has(key)) {
              releaseImage(image);
              stats.releasedTiles += 1;
              continue;
            }
            positionTile(image, level, job.col, job.row);
            detailLayer.appendChild(image);
            detailTiles.set(key, image);
            stats.loadedTiles += 1;
            updateStats();
          } catch (error) {
            stats.failedTiles += 1;
            console.debug("Overview detail tile skipped", error);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_LOADS, Math.max(1, missing.length)) }, () => worker()));
      updateStats();
    }

    function scheduleDetail(delay = SETTLE_MS) {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(refreshDetailTiles, delay);
    }

    function onCamera(event) {
      const next = event.detail || {};
      if (!Number.isFinite(next.scale)) return;
      camera = { scale: next.scale, tx: next.tx || 0, ty: next.ty || 0 };
      applyCamera();
      window.clearTimeout(settleTimer);
      if (!next.dragging) scheduleDetail();
    }

    function releaseAll() {
      renderEpoch += 1;
      window.clearTimeout(settleTimer);
      for (const image of baseTiles.values()) releaseImage(image);
      for (const image of detailTiles.values()) releaseImage(image);
      stats.releasedTiles += baseTiles.size + detailTiles.size;
      baseTiles.clear();
      detailTiles.clear();
      world?.remove();
      world = null;
      baseLayer = null;
      detailLayer = null;
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

    function rebuildForSize() {
      if (!stage) return;
      releaseAll();
      ensureWorld();
      if (!publishBounds()) return;
      loadBaseTiles();
      scheduleDetail(90);
    }

    function attach(nextStage) {
      if (!nextStage || nextStage.dataset.overviewRenderMode !== "raster") return;
      if (stage === nextStage && world?.isConnected) return;
      detachStage();
      stage = nextStage;
      camera = { scale: 1, tx: 0, ty: 0 };
      ensureWorld();
      publishBounds();
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(() => rebuildForSize());
      resizeObserver.observe(stage);
      loadBaseTiles();
      scheduleDetail(0);
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
