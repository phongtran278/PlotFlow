import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const LEVEL_WIDTHS = [1800, 2625, 5250, 10500, 21000, 42000];
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const MAX_DPR = 1.35;
const CAMERA_SETTLE_MS = 96;

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function chooseLevel(displayWidthPx) {
  return LEVEL_WIDTHS.find((width) => width >= displayWidthPx * 0.9) || LEVEL_WIDTHS.at(-1);
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
    image.onload = () => { image.__plotflowObjectUrl = objectUrl; resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Overview raster tile decode failed")); };
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

function makeCanvas(stage, label) {
  const canvas = document.createElement("canvas");
  canvas.className = "pf-overview-pdf-canvas pf-overview-raster-canvas";
  canvas.setAttribute("aria-label", label);
  canvas.style.pointerEvents = "none";
  canvas.style.transformOrigin = "0 0";
  canvas.style.willChange = "transform";
  stage.prepend(canvas);
  return canvas;
}

export default function OverviewRasterRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let activeCanvas = null;
    let bufferCanvas = null;
    let activeCtx = null;
    let bufferCtx = null;
    let resizeObserver = null;
    let observer = null;
    let renderTimer = 0;
    let renderEpoch = 0;
    let renderedCamera = { scale: 1, tx: 0, ty: 0 };
    let pendingCamera = { scale: 1, tx: 0, ty: 0 };

    const stats = {
      mode: "raster-tile-double-buffer",
      source: "prepared-masterplan-page-1",
      group: "Hoàn thiện",
      currentLevel: 0,
      activeTiles: 0,
      loadedTiles: 0,
      releasedTiles: 0,
      renderCount: 0,
      frameSwaps: 0,
      cancelledRenders: 0,
      pdfRuntimeLoaded: false,
    };
    window.__plotflowOverviewRuntime = stats;

    function publishBounds(rect, fit) {
      if (!stage) return null;
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

    function sizeCanvas(canvas, rect, dpr) {
      const pixelWidth = Math.max(2, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    function followCamera(camera) {
      if (!activeCanvas) return;
      const base = renderedCamera;
      const ratio = camera.scale / Math.max(0.0001, base.scale);
      const dx = camera.tx - ratio * base.tx;
      const dy = camera.ty - ratio * base.ty;
      activeCanvas.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${ratio})`;
    }

    function markCancelled(epoch) {
      if (epoch !== renderEpoch) stats.cancelledRenders += 1;
    }

    async function render(camera) {
      if (!stage || !bufferCanvas || !bufferCtx || disposed) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const epoch = ++renderEpoch;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      sizeCanvas(bufferCanvas, rect, dpr);
      bufferCanvas.style.visibility = "hidden";
      bufferCanvas.style.transform = "none";

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

      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufferCtx.fillStyle = "#fff";
      bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
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
          if (disposed || epoch !== renderEpoch) { markCancelled(epoch); return; }
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
            bufferCtx.drawImage(bitmap, 0, 0, tileWidth, tileHeight, dx, dy, dw, dh);
          } catch (error) {
            if (!disposed && epoch === renderEpoch) console.debug("Overview raster tile skipped", error);
          } finally {
            closeBitmap(bitmap);
            if (bitmap) stats.releasedTiles += 1;
          }
        }
      }

      if (disposed || epoch !== renderEpoch) { markCancelled(epoch); return; }
      renderedCamera = { ...camera };
      bufferCanvas.style.visibility = "visible";
      bufferCanvas.style.transform = "none";
      activeCanvas.style.visibility = "hidden";

      const oldActiveCanvas = activeCanvas;
      const oldActiveCtx = activeCtx;
      activeCanvas = bufferCanvas;
      activeCtx = bufferCtx;
      bufferCanvas = oldActiveCanvas;
      bufferCtx = oldActiveCtx;
      bufferCanvas.style.visibility = "hidden";
      bufferCanvas.style.transform = "none";
      stats.frameSwaps += 1;
      stage.classList.add("pf-pdf-crisp-ready");
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
      followCamera(pendingCamera);
      clearTimeout(renderTimer);
      if (!detail.dragging) schedule(pendingCamera);
    }

    function detachStage() {
      renderEpoch += 1;
      clearTimeout(renderTimer);
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
      for (const canvas of [activeCanvas, bufferCanvas]) {
        if (!canvas) continue;
        try { canvas.width = 1; canvas.height = 1; } catch {}
        canvas.remove();
      }
      activeCanvas = bufferCanvas = null;
      activeCtx = bufferCtx = null;
      if (stage) {
        stage.classList.remove("pf-pdf-crisp-ready");
        delete stage.dataset.pfPdfX;
        delete stage.dataset.pfPdfY;
        delete stage.dataset.pfPdfWidth;
        delete stage.dataset.pfPdfHeight;
      }
      stage = null;
      stats.activeTiles = 0;
    }

    function attach(nextStage) {
      if (!nextStage || nextStage.dataset.overviewRenderMode !== "raster") return;
      if (stage === nextStage && activeCanvas?.isConnected) return;
      detachStage();
      stage = nextStage;
      activeCanvas = makeCanvas(stage, "Overview raster masterplan");
      bufferCanvas = makeCanvas(stage, "Overview raster masterplan buffer");
      activeCanvas.style.visibility = "visible";
      bufferCanvas.style.visibility = "hidden";
      activeCtx = activeCanvas.getContext("2d", { alpha: false, desynchronized: true });
      bufferCtx = bufferCanvas.getContext("2d", { alpha: false, desynchronized: true });
      window.addEventListener("pf-overview-camera", onCamera);
      resizeObserver = new ResizeObserver(() => schedule(pendingCamera, 120));
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-overview-render-mode"] });

    return () => {
      disposed = true;
      observer?.disconnect();
      detachStage();
    };
  }, []);

  return null;
}
