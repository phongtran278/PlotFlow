import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const LEVEL_WIDTHS = [1800, 2625, 5250, 10500, 21000, 42000];
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const MAX_DPR = 1.35;

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return {
    width,
    height,
    cols: Math.ceil(width / TILE_SIZE),
    rows: Math.ceil(height / TILE_SIZE),
  };
}

function chooseLevel(displayWidthPx) {
  return LEVEL_WIDTHS.find((width) => width >= displayWidthPx * 0.9) || LEVEL_WIDTHS[LEVEL_WIDTHS.length - 1];
}

async function loadBitmap(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Overview raster tile ${response.status}`);
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      image.__plotflowObjectUrl = objectUrl;
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Overview raster tile decode failed"));
    };
    image.src = objectUrl;
  });
}

function closeBitmap(bitmap) {
  if (!bitmap) return;
  try { bitmap.close?.(); } catch {}
  if (bitmap.__plotflowObjectUrl) {
    try { URL.revokeObjectURL(bitmap.__plotflowObjectUrl); } catch {}
    try { bitmap.src = ""; } catch {}
  }
}

export default function OverviewRasterRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let canvas = null;
    let ctx = null;
    let resizeObserver = null;
    let observer = null;
    let renderTimer = 0;
    let renderEpoch = 0;
    let renderedCamera = { scale: 1, tx: 0, ty: 0 };
    let pendingCamera = { scale: 1, tx: 0, ty: 0 };

    const stats = {
      mode: "raster-tile-pilot",
      source: "prepared-masterplan-page-1",
      group: "Hoàn thiện",
      currentLevel: 0,
      activeTiles: 0,
      loadedTiles: 0,
      releasedTiles: 0,
      renderCount: 0,
      pdfRuntimeLoaded: false,
    };
    window.__plotflowOverviewRuntime = stats;

    function publishBounds(rect, fit) {
      if (!stage) return;
      const width = BASE_WIDTH * fit;
      const height = BASE_HEIGHT * fit;
      const x = (rect.width - width) / 2;
      const y = (rect.height - height) / 2;
      const bounds = { x, y, width, height };
      stage.dataset.pfPdfX = String(x);
      stage.dataset.pfPdfY = String(y);
      stage.dataset.pfPdfWidth = String(width);
      stage.dataset.pfPdfHeight = String(height);
      stage.style.setProperty("--pf-pdf-x", `${x}px`);
      stage.style.setProperty("--pf-pdf-y", `${y}px`);
      stage.style.setProperty("--pf-pdf-width", `${width}px`);
      stage.style.setProperty("--pf-pdf-height", `${height}px`);
      window.dispatchEvent(new CustomEvent("pf-overview-pdf-bounds", { detail: bounds }));
      return bounds;
    }

    function snapshotTransform(camera) {
      if (!canvas) return;
      const base = renderedCamera;
      const ratio = camera.scale / Math.max(0.0001, base.scale);
      const dx = camera.tx - ratio * base.tx;
      const dy = camera.ty - ratio * base.ty;
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${ratio})`;
    }

    async function render(camera) {
      if (!stage || !canvas || !ctx || disposed) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const epoch = ++renderEpoch;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const pixelWidth = Math.max(2, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }

      const fit = Math.min(rect.width / BASE_WIDTH, rect.height / BASE_HEIGHT);
      const bounds = publishBounds(rect, fit);
      const displayedSourceWidth = bounds.width * camera.scale * dpr;
      const levelWidth = chooseLevel(displayedSourceWidth);
      const level = levelInfo(levelWidth);
      stats.currentLevel = levelWidth;
      stats.renderCount += 1;

      const invScale = 1 / Math.max(0.0001, camera.scale);
      const sourceLeft = (((0 - camera.tx) * invScale) - bounds.x) / fit;
      const sourceTop = (((0 - camera.ty) * invScale) - bounds.y) / fit;
      const sourceRight = (((rect.width - camera.tx) * invScale) - bounds.x) / fit;
      const sourceBottom = (((rect.height - camera.ty) * invScale) - bounds.y) / fit;
      const sx0 = Math.max(0, Math.min(BASE_WIDTH, sourceLeft));
      const sy0 = Math.max(0, Math.min(BASE_HEIGHT, sourceTop));
      const sx1 = Math.max(0, Math.min(BASE_WIDTH, sourceRight));
      const sy1 = Math.max(0, Math.min(BASE_HEIGHT, sourceBottom));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (sx1 <= sx0 || sy1 <= sy0) return;

      const levelScaleX = level.width / BASE_WIDTH;
      const levelScaleY = level.height / BASE_HEIGHT;
      const lx0 = sx0 * levelScaleX;
      const ly0 = sy0 * levelScaleY;
      const lx1 = sx1 * levelScaleX;
      const ly1 = sy1 * levelScaleY;
      const margin = 1;
      const firstCol = Math.max(0, Math.floor(lx0 / TILE_SIZE) - margin);
      const firstRow = Math.max(0, Math.floor(ly0 / TILE_SIZE) - margin);
      const lastCol = Math.min(level.cols - 1, Math.floor((lx1 - 0.001) / TILE_SIZE) + margin);
      const lastRow = Math.min(level.rows - 1, Math.floor((ly1 - 0.001) / TILE_SIZE) + margin);
      stats.activeTiles = Math.max(0, lastCol - firstCol + 1) * Math.max(0, lastRow - firstRow + 1);

      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) {
          if (disposed || epoch !== renderEpoch) return;
          const url = `${TILE_BASE}/${level.width}/${col}_${row}.webp`;
          let bitmap = null;
          try {
            bitmap = await loadBitmap(url);
            stats.loadedTiles += 1;
            if (disposed || epoch !== renderEpoch) continue;
            const tileLeft = col * TILE_SIZE;
            const tileTop = row * TILE_SIZE;
            const tileWidth = Math.min(TILE_SIZE, level.width - tileLeft);
            const tileHeight = Math.min(TILE_SIZE, level.height - tileTop);
            const baseX = tileLeft / levelScaleX;
            const baseY = tileTop / levelScaleY;
            const baseW = tileWidth / levelScaleX;
            const baseH = tileHeight / levelScaleY;
            const dx = (camera.tx + camera.scale * (bounds.x + baseX * fit)) * dpr;
            const dy = (camera.ty + camera.scale * (bounds.y + baseY * fit)) * dpr;
            const dw = baseW * fit * camera.scale * dpr;
            const dh = baseH * fit * camera.scale * dpr;
            ctx.drawImage(bitmap, 0, 0, tileWidth, tileHeight, dx, dy, dw, dh);
          } catch (error) {
            if (!disposed && epoch === renderEpoch) console.debug("Overview raster tile skipped", error);
          } finally {
            closeBitmap(bitmap);
            if (bitmap) stats.releasedTiles += 1;
          }
        }
      }

      if (disposed || epoch !== renderEpoch) return;
      renderedCamera = { ...camera };
      canvas.style.transform = "none";
      stage.classList.add("pf-pdf-crisp-ready");
    }

    function schedule(camera, delay = 60) {
      pendingCamera = { ...camera };
      clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => render(pendingCamera), delay);
    }

    function onCamera(event) {
      const detail = event.detail || {};
      if (!Number.isFinite(detail.scale)) return;
      pendingCamera = { scale: detail.scale, tx: detail.tx || 0, ty: detail.ty || 0 };
      snapshotTransform(pendingCamera);
      if (detail.dragging) {
        clearTimeout(renderTimer);
        return;
      }
      schedule(pendingCamera, 70);
    }

    function attach(nextStage) {
      if (!nextStage || nextStage.dataset.overviewRenderMode !== "raster") return;
      if (stage === nextStage && canvas?.isConnected) return;
      stage = nextStage;
      canvas = document.createElement("canvas");
      canvas.className = "pf-overview-pdf-canvas pf-overview-raster-canvas";
      canvas.setAttribute("aria-label", "Overview raster masterplan pilot");
      stage.prepend(canvas);
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(() => schedule(pendingCamera, 100));
      resizeObserver.observe(stage);
      schedule(pendingCamera, 0);
    }

    function sync() {
      const next = document.querySelector('.pf-masterplan-stage[data-overview-render-mode="raster"]');
      if (next) attach(next);
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      renderEpoch += 1;
      clearTimeout(renderTimer);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      if (canvas) {
        try { canvas.width = 1; canvas.height = 1; } catch {}
        canvas.remove();
      }
      if (stage) {
        stage.classList.remove("pf-pdf-crisp-ready");
        delete stage.dataset.pfPdfX;
        delete stage.dataset.pfPdfY;
        delete stage.dataset.pfPdfWidth;
        delete stage.dataset.pfPdfHeight;
      }
      stats.activeTiles = 0;
    };
  }, []);

  return null;
}
