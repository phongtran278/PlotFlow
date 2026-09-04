import { useEffect } from "react";

const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const FIXED_LEVEL = 1800;
const SHARP_TILE_LIMIT = 6;
const SHARP_SETTLE_MS = 220;
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

function sharpLevelForScale(scale) {
  if (scale >= 18) return 42000;
  if (scale >= 6) return 21000;
  if (scale >= 2.5) return 10500;
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
    let settleTimer = 0;
    let sharpGeneration = 0;
    const bitmaps = new Map();
    const sharpBitmaps = new Map();
    const info = levelInfo(FIXED_LEVEL);
    const totalTiles = info.cols * info.rows;

    const stats = {
      mode: "windows-fixed-bitmap-canvas",
      platform: "Windows",
      fixedLevel: FIXED_LEVEL,
      fixedUrlSet: true,
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
      sharpTileLimit: SHARP_TILE_LIMIT,
      sharpLevel: 0,
      sharpActiveBitmaps: 0,
      sharpFetchTotal: 0,
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
      ctx.imageSmoothingQuality = "high";
      publishBounds();
      scheduleDraw();
      scheduleSharpSettle();
    }

    function drawEntry(entry, levelWidth, overlap = 0) {
      if (!ctx || !canvas || !bounds) return;
      const level = levelInfo(levelWidth);
      const levelScaleX = level.width / BASE_WIDTH;
      const levelScaleY = level.height / BASE_HEIGHT;
      const tileLeft = entry.col * TILE_SIZE;
      const tileTop = entry.row * TILE_SIZE;
      const tileRight = Math.min(level.width, tileLeft + entry.bitmap.width);
      const tileBottom = Math.min(level.height, tileTop + entry.bitmap.height);
      const baseLeft = bounds.x + (tileLeft / levelScaleX) * bounds.fit;
      const baseTop = bounds.y + (tileTop / levelScaleY) * bounds.fit;
      const baseRight = bounds.x + (tileRight / levelScaleX) * bounds.fit;
      const baseBottom = bounds.y + (tileBottom / levelScaleY) * bounds.fit;
      const left = camera.tx + baseLeft * camera.scale;
      const top = camera.ty + baseTop * camera.scale;
      const right = camera.tx + baseRight * camera.scale;
      const bottom = camera.ty + baseBottom * camera.scale;
      if (right <= 0 || bottom <= 0 || left >= canvas.width || top >= canvas.height) return;
      ctx.drawImage(entry.bitmap, left, top, right - left + overlap, bottom - top + overlap);
    }

    function drawNow() {
      raf = 0;
      if (disposed || !ctx || !canvas || !bounds) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const entry of bitmaps.values()) drawEntry(entry, FIXED_LEVEL, 1);
      for (const entry of sharpBitmaps.values()) drawEntry(entry, entry.level, 0.5);
      stats.drawCount += 1;
      stats.activeBitmaps = bitmaps.size;
      stats.sharpActiveBitmaps = sharpBitmaps.size;
    }

    function scheduleDraw() {
      if (raf) return;
      raf = window.requestAnimationFrame(drawNow);
    }

    function clearSharpBitmaps() {
      sharpGeneration += 1;
      for (const entry of sharpBitmaps.values()) entry.bitmap.close?.();
      sharpBitmaps.clear();
      stats.sharpActiveBitmaps = 0;
      stats.sharpPending = 0;
      stats.sharpLevel = 0;
    }

    function visibleSharpTiles(levelWidth) {
      if (!bounds || !canvas || camera.scale <= 0) return [];
      const level = levelInfo(levelWidth);
      const leftBase = (((0 - camera.tx) / camera.scale) - bounds.x) / Math.max(bounds.fit, 0.000001);
      const topBase = (((0 - camera.ty) / camera.scale) - bounds.y) / Math.max(bounds.fit, 0.000001);
      const rightBase = (((canvas.width - camera.tx) / camera.scale) - bounds.x) / Math.max(bounds.fit, 0.000001);
      const bottomBase = (((canvas.height - camera.ty) / camera.scale) - bounds.y) / Math.max(bounds.fit, 0.000001);
      const minBaseX = Math.max(0, Math.min(BASE_WIDTH, Math.min(leftBase, rightBase)));
      const maxBaseX = Math.max(0, Math.min(BASE_WIDTH, Math.max(leftBase, rightBase)));
      const minBaseY = Math.max(0, Math.min(BASE_HEIGHT, Math.min(topBase, bottomBase)));
      const maxBaseY = Math.max(0, Math.min(BASE_HEIGHT, Math.max(topBase, bottomBase)));
      if (maxBaseX <= minBaseX || maxBaseY <= minBaseY) return [];
      const sx = level.width / BASE_WIDTH;
      const sy = level.height / BASE_HEIGHT;
      const minCol = Math.max(0, Math.floor((minBaseX * sx) / TILE_SIZE));
      const maxCol = Math.min(level.cols - 1, Math.floor((maxBaseX * sx) / TILE_SIZE));
      const minRow = Math.max(0, Math.floor((minBaseY * sy) / TILE_SIZE));
      const maxRow = Math.min(level.rows - 1, Math.floor((maxBaseY * sy) / TILE_SIZE));
      const centerCol = ((minBaseX + maxBaseX) * 0.5 * sx) / TILE_SIZE;
      const centerRow = ((minBaseY + maxBaseY) * 0.5 * sy) / TILE_SIZE;
      const candidates = [];
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          candidates.push({ col, row, distance: Math.hypot(col + 0.5 - centerCol, row + 0.5 - centerRow) });
        }
      }
      return candidates.sort((a, b) => a.distance - b.distance).slice(0, SHARP_TILE_LIMIT);
    }

    async function loadSharpForSettle() {
      if (disposed || !stage || !bounds) return;
      const level = sharpLevelForScale(camera.scale);
      if (!level) {
        clearSharpBitmaps();
        scheduleDraw();
        return;
      }
      const targets = visibleSharpTiles(level);
      if (!targets.length) return;
      const generation = ++sharpGeneration;
      const next = new Map();
      stats.sharpLevel = level;
      stats.sharpPending = targets.length;
      for (const target of targets) {
        if (disposed || generation !== sharpGeneration) break;
        try {
          stats.sharpFetchTotal += 1;
          const response = await fetch(`${TILE_BASE}/${level}/${target.col}_${target.row}.webp`, { cache: "force-cache" });
          if (!response.ok) throw new Error(`sharp tile ${response.status}`);
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          if (disposed || generation !== sharpGeneration) {
            bitmap.close?.();
            break;
          }
          next.set(`${target.col}:${target.row}`, { bitmap, col: target.col, row: target.row, level });
          stats.sharpPending = Math.max(0, stats.sharpPending - 1);
        } catch (error) {
          stats.sharpPending = Math.max(0, stats.sharpPending - 1);
          console.debug("Windows sharp settle tile skipped", error);
        }
      }
      if (disposed || generation !== sharpGeneration) {
        for (const entry of next.values()) entry.bitmap.close?.();
        return;
      }
      for (const entry of sharpBitmaps.values()) entry.bitmap.close?.();
      sharpBitmaps.clear();
      for (const [key, entry] of next) sharpBitmaps.set(key, entry);
      stats.sharpActiveBitmaps = sharpBitmaps.size;
      stats.sharpPending = 0;
      scheduleDraw();
    }

    function scheduleSharpSettle() {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(loadSharpForSettle, SHARP_SETTLE_MS);
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
      scheduleSharpSettle();
    }

    function detachStage() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("pf-overview-camera", onCamera);
      window.clearTimeout(settleTimer);
      settleTimer = 0;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      clearSharpBitmaps();
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
