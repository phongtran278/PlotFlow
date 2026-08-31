import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const LEVEL_WIDTHS = [1800, 2625, 5250, 10500, 21000, 42000];
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const MAX_DPR = 1.35;
const CAMERA_SETTLE_MS = 70;
const MAX_PARALLEL_TILES = 4;

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function chooseLevel(displayWidthPx) {
  return LEVEL_WIDTHS.find((width) => width >= displayWidthPx * 0.9) || LEVEL_WIDTHS.at(-1);
}

function makeLayer(stage, label) {
  const layer = document.createElement("div");
  layer.className = "pf-overview-raster-tile-layer";
  layer.setAttribute("aria-label", label);
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.transformOrigin = "0 0";
  layer.style.overflow = "visible";
  layer.style.backfaceVisibility = "hidden";
  stage.prepend(layer);
  return layer;
}

function loadTileImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.draggable = false;
    image.alt = "";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Overview raster tile decode failed"));
    image.src = url;
  });
}

function releaseImage(image) {
  if (!image) return;
  try { image.onload = null; image.onerror = null; } catch {}
  try { image.removeAttribute("src"); } catch {}
  try { image.remove(); } catch {}
}

export default function OverviewRasterRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let activeLayer = null;
    let buildingLayer = null;
    let resizeObserver = null;
    let observer = null;
    let renderTimer = 0;
    let renderEpoch = 0;
    let pendingCamera = { scale: 1, tx: 0, ty: 0 };

    const stats = {
      mode: "raster-dom-tiles",
      source: "prepared-masterplan-page-1",
      group: "Hoàn thiện",
      currentLevel: 0,
      activeTiles: 0,
      buildingTiles: 0,
      loadedTiles: 0,
      releasedTiles: 0,
      renderCount: 0,
      layerSwaps: 0,
      cancelledRenders: 0,
      parallelLimit: MAX_PARALLEL_TILES,
      canvasCount: 0,
      pdfRuntimeLoaded: false,
    };
    window.__plotflowOverviewRuntime = stats;

    function publishBounds(rect) {
      if (!stage) return null;
      const fit = Math.min(rect.width / BASE_WIDTH, rect.height / BASE_HEIGHT);
      const width = BASE_WIDTH * fit;
      const height = BASE_HEIGHT * fit;
      const x = (rect.width - width) / 2;
      const y = (rect.height - height) / 2;
      const bounds = { x, y, width, height, fit };
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

    function applyCamera(layer, camera = pendingCamera) {
      if (!layer) return;
      layer.style.transform = `translate3d(${camera.tx}px,${camera.ty}px,0) scale(${camera.scale})`;
    }

    function releaseLayer(layer) {
      if (!layer) return;
      const images = Array.from(layer.querySelectorAll("img"));
      images.forEach(releaseImage);
      stats.releasedTiles += images.length;
      layer.remove();
      if (layer === activeLayer) activeLayer = null;
      if (layer === buildingLayer) buildingLayer = null;
    }

    function jobsFor(camera, rect, bounds, level) {
      const invScale = 1 / Math.max(0.0001, camera.scale);
      const worldLeft = (0 - camera.tx) * invScale;
      const worldTop = (0 - camera.ty) * invScale;
      const worldRight = (rect.width - camera.tx) * invScale;
      const worldBottom = (rect.height - camera.ty) * invScale;

      const sourceLeft = (worldLeft - bounds.x) / bounds.fit;
      const sourceTop = (worldTop - bounds.y) / bounds.fit;
      const sourceRight = (worldRight - bounds.x) / bounds.fit;
      const sourceBottom = (worldBottom - bounds.y) / bounds.fit;

      const sx0 = Math.max(0, Math.min(BASE_WIDTH, sourceLeft));
      const sy0 = Math.max(0, Math.min(BASE_HEIGHT, sourceTop));
      const sx1 = Math.max(0, Math.min(BASE_WIDTH, sourceRight));
      const sy1 = Math.max(0, Math.min(BASE_HEIGHT, sourceBottom));
      if (sx1 <= sx0 || sy1 <= sy0) return [];

      const levelScaleX = level.width / BASE_WIDTH;
      const levelScaleY = level.height / BASE_HEIGHT;
      const lx0 = sx0 * levelScaleX;
      const ly0 = sy0 * levelScaleY;
      const lx1 = sx1 * levelScaleX;
      const ly1 = sy1 * levelScaleY;
      const margin = level.width <= 2625 ? 0 : 1;
      const firstCol = Math.max(0, Math.floor(lx0 / TILE_SIZE) - margin);
      const firstRow = Math.max(0, Math.floor(ly0 / TILE_SIZE) - margin);
      const lastCol = Math.min(level.cols - 1, Math.floor((lx1 - 0.001) / TILE_SIZE) + margin);
      const lastRow = Math.min(level.rows - 1, Math.floor((ly1 - 0.001) / TILE_SIZE) + margin);
      const jobs = [];
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) jobs.push({ row, col });
      }
      return jobs;
    }

    function positionTile(image, job, level, bounds) {
      const tileLeft = job.col * TILE_SIZE;
      const tileTop = job.row * TILE_SIZE;
      const tileWidth = Math.min(TILE_SIZE, level.width - tileLeft);
      const tileHeight = Math.min(TILE_SIZE, level.height - tileTop);
      const levelScaleX = level.width / BASE_WIDTH;
      const levelScaleY = level.height / BASE_HEIGHT;
      const baseX = tileLeft / levelScaleX;
      const baseY = tileTop / levelScaleY;
      const baseW = tileWidth / levelScaleX;
      const baseH = tileHeight / levelScaleY;
      image.className = "pf-overview-raster-tile";
      image.style.position = "absolute";
      image.style.left = `${bounds.x + baseX * bounds.fit}px`;
      image.style.top = `${bounds.y + baseY * bounds.fit}px`;
      image.style.width = `${baseW * bounds.fit + 0.35}px`;
      image.style.height = `${baseH * bounds.fit + 0.35}px`;
      image.style.maxWidth = "none";
      image.style.userSelect = "none";
      image.style.pointerEvents = "none";
      image.style.backfaceVisibility = "hidden";
    }

    async function render(camera) {
      if (!stage || disposed) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const epoch = ++renderEpoch;
      stats.renderCount += 1;

      if (buildingLayer) releaseLayer(buildingLayer);
      const nextLayer = makeLayer(stage, "Overview raster tile viewport");
      buildingLayer = nextLayer;
      nextLayer.style.visibility = "hidden";
      applyCamera(nextLayer, camera);

      const bounds = publishBounds(rect);
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const levelWidth = chooseLevel(bounds.width * camera.scale * dpr);
      const level = levelInfo(levelWidth);
      stats.currentLevel = levelWidth;
      const jobs = jobsFor(camera, rect, bounds, level);
      stats.buildingTiles = jobs.length;
      if (!jobs.length) {
        releaseLayer(nextLayer);
        stats.buildingTiles = 0;
        return;
      }

      let cursor = 0;
      let loaded = 0;

      async function worker() {
        while (!disposed && epoch === renderEpoch) {
          const index = cursor;
          cursor += 1;
          if (index >= jobs.length) return;
          const job = jobs[index];
          let image = null;
          try {
            image = await loadTileImage(`${TILE_BASE}/${level.width}/${job.col}_${job.row}.webp`);
            if (disposed || epoch !== renderEpoch) {
              releaseImage(image);
              stats.releasedTiles += 1;
              continue;
            }
            positionTile(image, job, level, bounds);
            nextLayer.appendChild(image);
            loaded += 1;
            stats.loadedTiles += 1;
          } catch (error) {
            if (!disposed && epoch === renderEpoch) console.debug("Overview raster tile skipped", error);
          }
        }
      }

      const workerCount = Math.min(MAX_PARALLEL_TILES, Math.max(1, jobs.length));
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (disposed || epoch !== renderEpoch) {
        stats.cancelledRenders += 1;
        releaseLayer(nextLayer);
        stats.buildingTiles = 0;
        return;
      }
      if (!loaded) {
        releaseLayer(nextLayer);
        stats.buildingTiles = 0;
        return;
      }

      applyCamera(nextLayer, pendingCamera);
      nextLayer.style.visibility = "visible";
      const oldLayer = activeLayer;
      activeLayer = nextLayer;
      buildingLayer = null;
      stats.activeTiles = loaded;
      stats.buildingTiles = 0;
      stats.layerSwaps += 1;
      stage.classList.add("pf-pdf-crisp-ready");
      if (oldLayer) releaseLayer(oldLayer);
    }

    function schedule(camera, delay = CAMERA_SETTLE_MS) {
      pendingCamera = { ...camera };
      clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => render(pendingCamera), delay);
    }

    function onCamera(event) {
      const detail = event.detail || {};
      if (!Number.isFinite(detail.scale)) return;
      pendingCamera = { scale: detail.scale, tx: detail.tx || 0, ty: detail.ty || 0 };
      applyCamera(activeLayer, pendingCamera);
      applyCamera(buildingLayer, pendingCamera);
      clearTimeout(renderTimer);
      if (!detail.dragging) schedule(pendingCamera);
    }

    function detachStage() {
      renderEpoch += 1;
      clearTimeout(renderTimer);
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
      releaseLayer(buildingLayer);
      releaseLayer(activeLayer);
      buildingLayer = null;
      activeLayer = null;
      if (stage) {
        stage.classList.remove("pf-pdf-crisp-ready");
        delete stage.dataset.pfPdfX;
        delete stage.dataset.pfPdfY;
        delete stage.dataset.pfPdfWidth;
        delete stage.dataset.pfPdfHeight;
      }
      stage = null;
      stats.activeTiles = 0;
      stats.buildingTiles = 0;
    }

    function attach(nextStage) {
      if (!nextStage || nextStage.dataset.overviewRenderMode !== "raster") return;
      if (stage === nextStage && activeLayer?.isConnected) return;
      detachStage();
      stage = nextStage;
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(() => schedule(pendingCamera, 90));
      resizeObserver.observe(stage);
      schedule(pendingCamera, 0);
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
      attributeFilter: ["data-overview-render-mode"],
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      detachStage();
    };
  }, []);

  return null;
}
