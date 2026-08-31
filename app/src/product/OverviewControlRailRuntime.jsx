import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const CARD_DIMENSIONS_KEY = "plotflow-overview-card-dimensions-v2";
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const CRISP_TILE_CEILING = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function groupKey(stage) {
  return String(stage?.dataset?.overviewGroup || "default").trim() || "default";
}

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

function crispLevelFor(scale) {
  if (scale >= 20) return 42000;
  if (scale >= 8) return 21000;
  if (scale >= 3.5) return 10500;
  return 0;
}

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let disposed = false;
    let observer = null;
    let syncFrame = 0;
    let rail = null;
    let stage = null;
    let panel = null;
    let groups = null;
    let toolbar = null;
    let navigatorNode = null;
    let draggedCard = null;
    let lockedRatio = 192 / 140;
    let ratioLocked = true;

    let crispCanvas = null;
    let crispCtx = null;
    let crispTimer = 0;
    let crispEpoch = 0;
    let crispSignature = "";
    let crispCamera = { scale: 1, tx: 0, ty: 0, dragging: false };

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")) : [];
    }

    function anchors() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor")) : [];
    }

    function readDimensions() {
      const saved = readJson(CARD_DIMENSIONS_KEY, {});
      const value = saved[groupKey(stage)] || {};
      return {
        width: clamp(Number(value.width) || 192, 120, 360),
        height: clamp(Number(value.height) || 140, 90, 360),
        locked: value.locked !== false,
      };
    }

    function saveDimensions(width, height, locked = ratioLocked) {
      const saved = readJson(CARD_DIMENSIONS_KEY, {});
      saved[groupKey(stage)] = { width, height, locked };
      localStorage.setItem(CARD_DIMENSIONS_KEY, JSON.stringify(saved));
    }

    function updateDimensionInputs(width, height) {
      if (!panel) return;
      const widthInput = panel.querySelector('[data-card-dimension="width"]');
      const heightInput = panel.querySelector('[data-card-dimension="height"]');
      const lockButton = panel.querySelector('[data-card-action="lock-ratio"]');
      if (widthInput) widthInput.value = String(Math.round(width));
      if (heightInput) heightInput.value = String(Math.round(height));
      if (lockButton) {
        lockButton.classList.toggle("active", ratioLocked);
        lockButton.setAttribute("aria-pressed", ratioLocked ? "true" : "false");
        lockButton.title = ratioLocked ? "Unlock card aspect ratio" : "Lock card aspect ratio";
      }
    }

    function applyDimensions(width, height, { persist = true } = {}) {
      if (!stage) return;
      const nextWidth = clamp(Math.round(Number(width) || 192), 120, 360);
      const nextHeight = clamp(Math.round(Number(height) || 140), 90, 360);
      cards().forEach((card) => {
        card.style.setProperty("--pf-card-width", `${nextWidth}px`);
        card.style.setProperty("--pf-card-height", `${nextHeight}px`);
        card.style.width = `${nextWidth}px`;
        card.style.height = `${nextHeight}px`;
        card.style.minHeight = `${nextHeight}px`;
      });
      if (persist) saveDimensions(nextWidth, nextHeight);
      updateDimensionInputs(nextWidth, nextHeight);
      window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { width: nextWidth, height: nextHeight } }));
      window.dispatchEvent(new CustomEvent("pf-overview-all-card-size", { detail: { width: nextWidth, height: nextHeight } }));
      requestAnimationFrame(updateMinimap);
    }

    function syncDimensions() {
      const saved = readDimensions();
      ratioLocked = saved.locked;
      lockedRatio = saved.width / Math.max(1, saved.height);
      applyDimensions(saved.width, saved.height, { persist: false });
    }

    function persistCurrentCardLayout() {
      if (!stage) return;
      const saved = readJson(CARD_LAYOUT_KEY, {});
      cards().forEach((card) => {
        const code = card.dataset.unitCode || card.querySelector(".pf-sell-card-code,header strong")?.textContent?.trim() || "";
        if (!code) return;
        saved[code] = {
          left: Number(card.offsetLeft.toFixed(2)),
          top: Number(card.offsetTop.toFixed(2)),
          width: Number(card.offsetWidth.toFixed(2)),
          height: Number(card.offsetHeight.toFixed(2)),
        };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(saved));
    }

    function updateMinimap() {
      if (!panel || !stage) return;
      const svg = panel.querySelector(".pf-arrange-minimap svg");
      if (!svg) return;
      const width = stage.clientWidth || 1;
      const height = stage.clientHeight || 1;
      const anchorMap = new Map(anchors().map((anchor) => [anchor.dataset.unitCode || anchor.textContent?.trim() || "", anchor]));
      const parts = ['<rect class="pf-mini-artboard" x="1" y="1" width="118" height="58" rx="5"/>'];
      cards().forEach((card) => {
        const code = card.dataset.unitCode || "";
        const x = clamp((card.offsetLeft / width) * 120, 1, 116);
        const y = clamp((card.offsetTop / height) * 60, 1, 56);
        const w = clamp((card.offsetWidth / width) * 120, 3, 14);
        const h = clamp((card.offsetHeight / height) * 60, 3, 10);
        const anchor = anchorMap.get(code);
        const ax = anchor ? clamp((Number.parseFloat(anchor.style.left || "50") / 100) * 120, 1, 119) : 60;
        const ay = anchor ? clamp((Number.parseFloat(anchor.style.top || "50") / 100) * 60, 1, 59) : 30;
        parts.push(`<line class="pf-mini-line" x1="${(x + w / 2).toFixed(1)}" y1="${(y + h / 2).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"/>`);
        parts.push(`<rect class="pf-mini-card" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`);
        parts.push(`<circle class="pf-mini-anchor" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="1.2"/>`);
      });
      svg.innerHTML = parts.join("");
    }

    function triggerAutoArrange() {
      const button = document.querySelector('.pf-overview-v2-controls [data-v2-action="arrange"]');
      button?.click();
      window.setTimeout(() => {
        persistCurrentCardLayout();
        window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { reason: "arrange" } }));
        updateMinimap();
      }, 40);
    }

    function ensurePanel() {
      if (!rail || !stage) return;
      if (!panel?.isConnected) {
        panel = document.createElement("div");
        panel.className = "pf-overview-layout-panel";
        panel.innerHTML = `
          <div class="pf-card-dimensions" aria-label="Card dimensions">
            <span>Card</span>
            <label>W <input data-card-dimension="width" type="number" min="120" max="360" step="2"></label>
            <button type="button" data-card-action="lock-ratio" class="active" aria-pressed="true">⌁</button>
            <label>H <input data-card-dimension="height" type="number" min="90" max="360" step="2"></label>
          </div>
          <button type="button" class="pf-auto-arrange-button" data-card-action="arrange">Auto Arrange</button>
          <div class="pf-arrange-minimap" title="Live card / connector layout preview"><svg viewBox="0 0 120 60" aria-label="Arrange minimap"></svg></div>`;
        rail.appendChild(panel);

        panel.addEventListener("click", (event) => {
          const action = event.target.closest("button")?.dataset?.cardAction;
          if (action === "arrange") {
            triggerAutoArrange();
            return;
          }
          if (action === "lock-ratio") {
            ratioLocked = !ratioLocked;
            const width = Number(panel.querySelector('[data-card-dimension="width"]')?.value) || 192;
            const height = Number(panel.querySelector('[data-card-dimension="height"]')?.value) || 140;
            if (ratioLocked) lockedRatio = width / Math.max(1, height);
            saveDimensions(width, height, ratioLocked);
            updateDimensionInputs(width, height);
          }
        });

        panel.addEventListener("change", (event) => {
          const dimension = event.target?.dataset?.cardDimension;
          if (!dimension) return;
          let width = Number(panel.querySelector('[data-card-dimension="width"]')?.value) || 192;
          let height = Number(panel.querySelector('[data-card-dimension="height"]')?.value) || 140;
          if (ratioLocked) {
            if (dimension === "width") height = Math.round(width / Math.max(0.1, lockedRatio));
            else width = Math.round(height * lockedRatio);
          }
          applyDimensions(width, height);
        });
      }
      syncDimensions();
      updateMinimap();
    }

    function moveControlsOutsideStage() {
      if (!rail || !stage) return;
      groups = document.querySelector(".pf-overview-groups");
      navigatorNode = stage.querySelector(":scope > .pf-unit-navigator") || document.querySelector(".pf-unit-navigator");
      toolbar = stage.querySelector(":scope > .pf-overview-zoom-toolbar") || document.querySelector(".pf-overview-zoom-toolbar");
      if (groups && groups.parentElement !== rail) rail.prepend(groups);
      if (navigatorNode && navigatorNode.parentElement !== rail) rail.appendChild(navigatorNode);
      if (toolbar && toolbar.parentElement !== rail) rail.appendChild(toolbar);
      document.querySelectorAll(".pf-card-layout-control").forEach((node) => node.classList.add("pf-legacy-card-layout-hidden"));
    }

    function clearCrispOverlay() {
      window.clearTimeout(crispTimer);
      crispTimer = 0;
      crispEpoch += 1;
      crispSignature = "";
      if (crispCanvas) crispCanvas.style.display = "none";
    }

    function ensureCrispCanvas() {
      if (!isWindows() || !stage) return null;
      if (crispCanvas?.isConnected && crispCanvas.parentElement === stage) return crispCanvas;
      crispCanvas?.remove();
      crispCanvas = document.createElement("canvas");
      crispCanvas.className = "pf-overview-windows-crisp-overlay";
      Object.assign(crispCanvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "2",
        display: "none",
      });
      crispCtx = crispCanvas.getContext("2d", { alpha: true });
      stage.prepend(crispCanvas);
      return crispCanvas;
    }

    function visibleCrispJobs(level) {
      if (!stage) return [];
      const pdfX = Number(stage.dataset.pfPdfX);
      const pdfY = Number(stage.dataset.pfPdfY);
      const pdfWidth = Number(stage.dataset.pfPdfWidth);
      const pdfHeight = Number(stage.dataset.pfPdfHeight);
      if (![pdfX, pdfY, pdfWidth, pdfHeight].every(Number.isFinite) || pdfWidth < 2 || pdfHeight < 2) return [];
      const fit = pdfWidth / BASE_WIDTH;
      const scale = Math.max(0.001, crispCamera.scale);
      const viewW = stage.clientWidth || 1;
      const viewH = stage.clientHeight || 1;
      const sourceLeft = ((0 - crispCamera.tx) / scale - pdfX) / fit;
      const sourceTop = ((0 - crispCamera.ty) / scale - pdfY) / fit;
      const sourceRight = ((viewW - crispCamera.tx) / scale - pdfX) / fit;
      const sourceBottom = ((viewH - crispCamera.ty) / scale - pdfY) / fit;
      const sx0 = clamp(sourceLeft, 0, BASE_WIDTH);
      const sy0 = clamp(sourceTop, 0, BASE_HEIGHT);
      const sx1 = clamp(sourceRight, 0, BASE_WIDTH);
      const sy1 = clamp(sourceBottom, 0, BASE_HEIGHT);
      if (sx1 <= sx0 || sy1 <= sy0) return [];
      const info = levelInfo(level);
      const levelScaleX = info.width / BASE_WIDTH;
      const levelScaleY = info.height / BASE_HEIGHT;
      const firstCol = Math.max(0, Math.floor((sx0 * levelScaleX) / TILE_SIZE));
      const firstRow = Math.max(0, Math.floor((sy0 * levelScaleY) / TILE_SIZE));
      const lastCol = Math.min(info.cols - 1, Math.floor(((sx1 * levelScaleX) - 0.001) / TILE_SIZE));
      const lastRow = Math.min(info.rows - 1, Math.floor(((sy1 * levelScaleY) - 0.001) / TILE_SIZE));
      const cx = ((sx0 + sx1) * 0.5 * levelScaleX) / TILE_SIZE;
      const cy = ((sy0 + sy1) * 0.5 * levelScaleY) / TILE_SIZE;
      const jobs = [];
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) jobs.push({ col, row, distance: Math.hypot(col - cx, row - cy) });
      }
      jobs.sort((a, b) => a.distance - b.distance);
      return jobs.slice(0, CRISP_TILE_CEILING);
    }

    async function renderCrispOverlay() {
      crispTimer = 0;
      if (disposed || !isWindows() || !stage || crispCamera.dragging) return;
      const level = crispLevelFor(crispCamera.scale);
      if (!level) return;
      const signature = `${level}:${Math.round(crispCamera.scale * 10)}:${Math.round(crispCamera.tx / 10)}:${Math.round(crispCamera.ty / 10)}`;
      if (signature === crispSignature) return;
      const jobs = visibleCrispJobs(level);
      if (!jobs.length) return;
      ensureCrispCanvas();
      if (!crispCanvas || !crispCtx) return;

      const cssWidth = Math.max(1, stage.clientWidth || 1);
      const cssHeight = Math.max(1, stage.clientHeight || 1);
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      crispCanvas.width = Math.round(cssWidth * dpr);
      crispCanvas.height = Math.round(cssHeight * dpr);
      crispCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      crispCtx.clearRect(0, 0, cssWidth, cssHeight);
      crispCanvas.style.display = "block";

      const pdfX = Number(stage.dataset.pfPdfX);
      const pdfY = Number(stage.dataset.pfPdfY);
      const pdfWidth = Number(stage.dataset.pfPdfWidth);
      const fit = pdfWidth / BASE_WIDTH;
      const info = levelInfo(level);
      const levelScaleX = info.width / BASE_WIDTH;
      const levelScaleY = info.height / BASE_HEIGHT;
      const epoch = ++crispEpoch;
      let cursor = 0;
      let drawn = 0;

      async function worker() {
        while (!disposed && epoch === crispEpoch) {
          const job = jobs[cursor++];
          if (!job) return;
          let bitmap = null;
          try {
            const response = await fetch(`${TILE_BASE}/${level}/${job.col}_${job.row}.webp`, { cache: "force-cache" });
            if (!response.ok) throw new Error(`crisp tile ${response.status}`);
            bitmap = await createImageBitmap(await response.blob());
            if (disposed || epoch !== crispEpoch) continue;
            const tileLeft = job.col * TILE_SIZE;
            const tileTop = job.row * TILE_SIZE;
            const tileRight = Math.min(info.width, tileLeft + bitmap.width);
            const tileBottom = Math.min(info.height, tileTop + bitmap.height);
            const baseLeft = pdfX + (tileLeft / levelScaleX) * fit;
            const baseTop = pdfY + (tileTop / levelScaleY) * fit;
            const baseRight = pdfX + (tileRight / levelScaleX) * fit;
            const baseBottom = pdfY + (tileBottom / levelScaleY) * fit;
            const left = crispCamera.tx + baseLeft * crispCamera.scale;
            const top = crispCamera.ty + baseTop * crispCamera.scale;
            const right = crispCamera.tx + baseRight * crispCamera.scale;
            const bottom = crispCamera.ty + baseBottom * crispCamera.scale;
            crispCtx.drawImage(bitmap, left, top, right - left, bottom - top);
            drawn += 1;
          } catch (error) {
            console.debug("Overview crisp overlay tile skipped", error);
          } finally {
            bitmap?.close?.();
          }
        }
      }

      await Promise.all([worker(), worker()]);
      if (disposed || epoch !== crispEpoch) return;
      crispSignature = signature;
      if (window.__plotflowOverviewRuntime) {
        window.__plotflowOverviewRuntime.crispOverlay = true;
        window.__plotflowOverviewRuntime.crispOverlayLevel = level;
        window.__plotflowOverviewRuntime.crispOverlayTiles = drawn;
        window.__plotflowOverviewRuntime.crispOverlayDpr = dpr;
      }
    }

    function onCamera(event) {
      crispCamera = { ...crispCamera, ...(event.detail || {}) };
      clearCrispOverlay();
      if (isWindows() && !crispCamera.dragging && crispCamera.scale >= 3.5) {
        crispTimer = window.setTimeout(renderCrispOverlay, 180);
      }
    }

    function onPointerDown(event) {
      const card = event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      draggedCard = card || null;
    }

    function onPointerUp() {
      if (!draggedCard) return;
      draggedCard = null;
      window.setTimeout(() => {
        persistCurrentCardLayout();
        window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { reason: "manual-layout" } }));
        updateMinimap();
      }, 0);
    }

    function bindStage(nextStage) {
      if (stage === nextStage) return;
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("pointerup", onPointerUp, true);
      stage?.removeEventListener("pointercancel", onPointerUp, true);
      crispCanvas?.remove();
      crispCanvas = null;
      crispCtx = null;
      stage = nextStage;
      if (stage) {
        stage.addEventListener("pointerdown", onPointerDown, true);
        stage.addEventListener("pointerup", onPointerUp, true);
        stage.addEventListener("pointercancel", onPointerUp, true);
      }
    }

    function sync() {
      rail = document.querySelector(".pf-overview-control-rail");
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      bindStage(nextStage || null);
      if (!rail || !stage) return;
      moveControlsOutsideStage();
      ensurePanel();
    }

    function scheduleSync() {
      cancelAnimationFrame(syncFrame);
      syncFrame = requestAnimationFrame(sync);
    }

    function onUnitsReady() {
      window.setTimeout(() => {
        sync();
        syncDimensions();
        updateMinimap();
      }, 20);
    }

    function onGroupChanged() {
      window.setTimeout(() => {
        sync();
        syncDimensions();
        updateMinimap();
      }, 30);
    }

    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-live-units-ready", onUnitsReady);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pf-overview-auto-arranged", updateMinimap);
    window.addEventListener("pf-overview-card-size-changed", updateMinimap);

    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      disposed = true;
      cancelAnimationFrame(syncFrame);
      observer?.disconnect();
      window.clearTimeout(crispTimer);
      crispEpoch += 1;
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-live-units-ready", onUnitsReady);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-overview-auto-arranged", updateMinimap);
      window.removeEventListener("pf-overview-card-size-changed", updateMinimap);
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("pointerup", onPointerUp, true);
      stage?.removeEventListener("pointercancel", onPointerUp, true);
      crispCanvas?.remove();
      panel?.remove();
    };
  }, []);

  return null;
}
