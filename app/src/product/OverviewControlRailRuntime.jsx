import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const CARD_DIMENSIONS_KEY = "plotflow-overview-card-dimensions-v2";
const TILE_BASE = "/masterplan/generated/page-tiles/page-1";
const BASE_WIDTH = 42000;
const BASE_HEIGHT = 29709;
const TILE_SIZE = 512;
const FOCUS_LEVEL = 42000;
const FOCUS_TILE_CEILING = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

function readJson(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function levelInfo(width) {
  const height = Math.round(BASE_HEIGHT * (width / BASE_WIDTH));
  return { width, height, cols: Math.ceil(width / TILE_SIZE), rows: Math.ceil(height / TILE_SIZE) };
}

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let disposed = false;
    let observer = null;
    let syncFrame = 0;
    let rail = null;
    let stage = null;
    let panel = null;
    let draggedCard = null;
    let ratioLocked = true;
    let lockedRatio = 192 / 140;
    let focusCanvas = null;
    let focusCtx = null;
    let focusTimer = 0;
    let focusEpoch = 0;

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")) : [];
    const anchors = () => stage ? Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor")) : [];
    const currentGroup = () => String(stage?.dataset?.overviewGroup || "default").trim() || "default";

    function readDimensions() {
      const value = readJson(CARD_DIMENSIONS_KEY)[currentGroup()] || {};
      return {
        width: clamp(Number(value.width) || 192, 120, 360),
        height: clamp(Number(value.height) || 140, 90, 360),
        locked: value.locked !== false,
      };
    }

    function saveDimensions(width, height) {
      const all = readJson(CARD_DIMENSIONS_KEY);
      all[currentGroup()] = { width, height, locked: ratioLocked };
      localStorage.setItem(CARD_DIMENSIONS_KEY, JSON.stringify(all));
    }

    function updateInputs(width, height) {
      if (!panel) return;
      const w = panel.querySelector('[data-card-dimension="width"]');
      const h = panel.querySelector('[data-card-dimension="height"]');
      const lock = panel.querySelector('[data-card-action="lock-ratio"]');
      if (w) w.value = String(Math.round(width));
      if (h) h.value = String(Math.round(height));
      if (lock) {
        lock.classList.toggle("active", ratioLocked);
        lock.setAttribute("aria-pressed", ratioLocked ? "true" : "false");
      }
    }

    function applyDimensions(width, height, persist = true) {
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
      updateInputs(nextWidth, nextHeight);
      window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { width: nextWidth, height: nextHeight } }));
      window.dispatchEvent(new CustomEvent("pf-overview-all-card-size", { detail: { width: nextWidth, height: nextHeight } }));
      requestAnimationFrame(updateMinimap);
    }

    function syncDimensions() {
      const saved = readDimensions();
      ratioLocked = saved.locked;
      lockedRatio = saved.width / Math.max(1, saved.height);
      applyDimensions(saved.width, saved.height, false);
    }

    function persistCardLayout() {
      const saved = readJson(CARD_LAYOUT_KEY);
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
      const sw = stage.clientWidth || 1;
      const sh = stage.clientHeight || 1;
      const anchorMap = new Map(anchors().map((anchor) => [anchor.dataset.unitCode || anchor.textContent?.trim() || "", anchor]));
      const out = ['<rect class="pf-mini-artboard" x="1" y="1" width="118" height="58" rx="5"/>'];
      cards().forEach((card) => {
        const code = card.dataset.unitCode || "";
        const x = clamp(card.offsetLeft / sw * 120, 1, 116);
        const y = clamp(card.offsetTop / sh * 60, 1, 56);
        const w = clamp(card.offsetWidth / sw * 120, 3, 14);
        const h = clamp(card.offsetHeight / sh * 60, 3, 10);
        const anchor = anchorMap.get(code);
        const ax = anchor ? clamp(Number.parseFloat(anchor.style.left || "50") / 100 * 120, 1, 119) : 60;
        const ay = anchor ? clamp(Number.parseFloat(anchor.style.top || "50") / 100 * 60, 1, 59) : 30;
        out.push(`<line class="pf-mini-line" x1="${(x + w / 2).toFixed(1)}" y1="${(y + h / 2).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"/>`);
        out.push(`<rect class="pf-mini-card" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`);
        out.push(`<circle class="pf-mini-anchor" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="1.2"/>`);
      });
      svg.innerHTML = out.join("");
    }

    function triggerAutoArrange() {
      document.querySelector('.pf-overview-v2-controls [data-v2-action="arrange"]')?.click();
      window.setTimeout(() => {
        persistCardLayout();
        window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { reason: "arrange" } }));
        updateMinimap();
      }, 50);
    }

    function ensurePanel() {
      if (!rail || !stage || panel?.isConnected) return;
      panel = document.createElement("div");
      panel.className = "pf-overview-layout-panel";
      panel.innerHTML = `
        <div class="pf-card-dimensions" aria-label="Card dimensions">
          <span>Card</span>
          <label>W <input data-card-dimension="width" type="number" min="120" max="360" step="2"></label>
          <button type="button" data-card-action="lock-ratio" class="active" aria-pressed="true" title="Lock aspect ratio">⌁</button>
          <label>H <input data-card-dimension="height" type="number" min="90" max="360" step="2"></label>
        </div>
        <button type="button" class="pf-auto-arrange-button" data-card-action="arrange">Auto Arrange</button>
        <div class="pf-arrange-minimap" title="Live card and connector layout"><svg viewBox="0 0 120 60" aria-label="Arrange minimap"></svg></div>`;
      rail.appendChild(panel);

      panel.addEventListener("click", (event) => {
        const action = event.target.closest("button")?.dataset?.cardAction;
        if (action === "arrange") return triggerAutoArrange();
        if (action !== "lock-ratio") return;
        ratioLocked = !ratioLocked;
        const width = Number(panel.querySelector('[data-card-dimension="width"]')?.value) || 192;
        const height = Number(panel.querySelector('[data-card-dimension="height"]')?.value) || 140;
        if (ratioLocked) lockedRatio = width / Math.max(1, height);
        saveDimensions(width, height);
        updateInputs(width, height);
      });

      panel.addEventListener("change", (event) => {
        const dimension = event.target?.dataset?.cardDimension;
        if (!dimension) return;
        let width = Number(panel.querySelector('[data-card-dimension="width"]')?.value) || 192;
        let height = Number(panel.querySelector('[data-card-dimension="height"]')?.value) || 140;
        if (ratioLocked) {
          if (dimension === "width") height = Math.round(width / Math.max(.1, lockedRatio));
          else width = Math.round(height * lockedRatio);
        }
        applyDimensions(width, height);
      });
      syncDimensions();
      updateMinimap();
    }

    function moveControls() {
      if (!rail || !stage) return;
      const groups = document.querySelector(".pf-overview-groups");
      const navigatorNode = stage.querySelector(":scope > .pf-unit-navigator") || document.querySelector(".pf-unit-navigator");
      const toolbar = stage.querySelector(":scope > .pf-overview-zoom-toolbar") || document.querySelector(".pf-overview-zoom-toolbar");
      if (groups && groups.parentElement !== rail) rail.prepend(groups);
      if (navigatorNode && navigatorNode.parentElement !== rail) rail.appendChild(navigatorNode);
      if (toolbar && toolbar.parentElement !== rail) rail.appendChild(toolbar);
      document.querySelectorAll(".pf-card-layout-control").forEach((node) => node.classList.add("pf-legacy-card-layout-hidden"));
    }

    function removeFocusOverlay() {
      window.clearTimeout(focusTimer);
      focusTimer = 0;
      focusEpoch += 1;
      if (focusCanvas) focusCanvas.style.display = "none";
    }

    function ensureFocusCanvas() {
      if (!isWindows() || !stage) return false;
      if (!focusCanvas?.isConnected || focusCanvas.parentElement !== stage) {
        focusCanvas?.remove();
        focusCanvas = document.createElement("canvas");
        focusCanvas.className = "pf-overview-windows-crisp-overlay";
        Object.assign(focusCanvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", zIndex: "2", pointerEvents: "none", display: "none" });
        focusCtx = focusCanvas.getContext("2d", { alpha: true });
        stage.prepend(focusCanvas);
      }
      return Boolean(focusCtx);
    }

    async function renderFocusOverlay(detail) {
      focusTimer = 0;
      if (disposed || !isWindows() || !stage || !ensureFocusCanvas()) return;
      const xPct = Number(detail?.x);
      const yPct = Number(detail?.y);
      const scale = clamp(Number(detail?.scale) || 54, 1, 54);
      if (![xPct, yPct].every(Number.isFinite)) return;
      const cssWidth = stage.clientWidth || 1;
      const cssHeight = stage.clientHeight || 1;
      const pdfX = Number(stage.dataset.pfPdfX);
      const pdfY = Number(stage.dataset.pfPdfY);
      const pdfWidth = Number(stage.dataset.pfPdfWidth);
      const pdfHeight = Number(stage.dataset.pfPdfHeight);
      if (![pdfX, pdfY, pdfWidth, pdfHeight].every(Number.isFinite) || pdfWidth < 2 || pdfHeight < 2) return;
      const tx = cssWidth * .5 - (xPct / 100 * cssWidth) * scale;
      const ty = cssHeight * .5 - (yPct / 100 * cssHeight) * scale;
      const fit = pdfWidth / BASE_WIDTH;
      const sourceLeft = ((0 - tx) / scale - pdfX) / fit;
      const sourceTop = ((0 - ty) / scale - pdfY) / fit;
      const sourceRight = ((cssWidth - tx) / scale - pdfX) / fit;
      const sourceBottom = ((cssHeight - ty) / scale - pdfY) / fit;
      const sx0 = clamp(sourceLeft, 0, BASE_WIDTH);
      const sy0 = clamp(sourceTop, 0, BASE_HEIGHT);
      const sx1 = clamp(sourceRight, 0, BASE_WIDTH);
      const sy1 = clamp(sourceBottom, 0, BASE_HEIGHT);
      if (sx1 <= sx0 || sy1 <= sy0) return;

      const info = levelInfo(FOCUS_LEVEL);
      const firstCol = Math.max(0, Math.floor(sx0 / TILE_SIZE));
      const firstRow = Math.max(0, Math.floor(sy0 / TILE_SIZE));
      const lastCol = Math.min(info.cols - 1, Math.floor((sx1 - .001) / TILE_SIZE));
      const lastRow = Math.min(info.rows - 1, Math.floor((sy1 - .001) / TILE_SIZE));
      const cx = (sx0 + sx1) * .5 / TILE_SIZE;
      const cy = (sy0 + sy1) * .5 / TILE_SIZE;
      const jobs = [];
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let col = firstCol; col <= lastCol; col += 1) jobs.push({ col, row, distance: Math.hypot(col - cx, row - cy) });
      }
      jobs.sort((a, b) => a.distance - b.distance);
      const selected = jobs.slice(0, FOCUS_TILE_CEILING);
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      focusCanvas.width = Math.round(cssWidth * dpr);
      focusCanvas.height = Math.round(cssHeight * dpr);
      focusCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      focusCtx.clearRect(0, 0, cssWidth, cssHeight);
      focusCanvas.style.display = "block";
      const epoch = ++focusEpoch;
      let cursor = 0;
      let drawn = 0;

      async function worker() {
        while (!disposed && epoch === focusEpoch) {
          const job = selected[cursor++];
          if (!job) return;
          let bitmap = null;
          try {
            const response = await fetch(`${TILE_BASE}/${FOCUS_LEVEL}/${job.col}_${job.row}.webp`, { cache: "force-cache" });
            if (!response.ok) throw new Error(`focus tile ${response.status}`);
            bitmap = await createImageBitmap(await response.blob());
            if (disposed || epoch !== focusEpoch) continue;
            const tileLeft = job.col * TILE_SIZE;
            const tileTop = job.row * TILE_SIZE;
            const tileRight = Math.min(FOCUS_LEVEL, tileLeft + bitmap.width);
            const tileBottom = Math.min(info.height, tileTop + bitmap.height);
            const baseLeft = pdfX + tileLeft * fit;
            const baseTop = pdfY + tileTop * fit;
            const baseRight = pdfX + tileRight * fit;
            const baseBottom = pdfY + tileBottom * fit;
            const left = tx + baseLeft * scale;
            const top = ty + baseTop * scale;
            const right = tx + baseRight * scale;
            const bottom = ty + baseBottom * scale;
            focusCtx.drawImage(bitmap, left, top, right - left, bottom - top);
            drawn += 1;
          } catch (error) {
            console.debug("Overview Focus tile skipped", error);
          } finally {
            bitmap?.close?.();
          }
        }
      }
      await Promise.all([worker(), worker()]);
      if (disposed || epoch !== focusEpoch) return;
      if (window.__plotflowOverviewRuntime) {
        window.__plotflowOverviewRuntime.focusCrispOverlay = true;
        window.__plotflowOverviewRuntime.focusCrispTiles = drawn;
        window.__plotflowOverviewRuntime.focusCrispDpr = dpr;
      }
    }

    function onFocusRequest(event) {
      if (!isWindows()) return;
      window.clearTimeout(focusTimer);
      const detail = { ...(event.detail || {}) };
      focusTimer = window.setTimeout(() => renderFocusOverlay(detail), 470);
    }

    function onCamera() {
      if (focusCanvas) focusCanvas.style.display = "none";
    }

    function onPointerDown(event) {
      if (event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout")) draggedCard = true;
      if (focusCanvas) focusCanvas.style.display = "none";
    }

    function onPointerUp() {
      if (!draggedCard) return;
      draggedCard = false;
      window.setTimeout(() => {
        persistCardLayout();
        window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { reason: "manual-layout" } }));
        updateMinimap();
      }, 0);
    }

    function bindStage(nextStage) {
      if (stage === nextStage) return;
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("pointerup", onPointerUp, true);
      stage?.removeEventListener("pointercancel", onPointerUp, true);
      focusCanvas?.remove();
      focusCanvas = null;
      focusCtx = null;
      stage = nextStage;
      if (stage) {
        stage.addEventListener("pointerdown", onPointerDown, true);
        stage.addEventListener("pointerup", onPointerUp, true);
        stage.addEventListener("pointercancel", onPointerUp, true);
      }
    }

    function sync() {
      rail = document.querySelector(".pf-overview-control-rail");
      bindStage(document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts"));
      if (!rail || !stage) return;
      moveControls();
      ensurePanel();
    }

    function scheduleSync() {
      cancelAnimationFrame(syncFrame);
      syncFrame = requestAnimationFrame(sync);
    }

    function onUnitsReady() {
      window.setTimeout(() => { sync(); syncDimensions(); updateMinimap(); }, 30);
    }

    function onGroupChanged() {
      window.setTimeout(() => { sync(); syncDimensions(); updateMinimap(); }, 40);
    }

    window.addEventListener("pf-overview-focus-request", onFocusRequest);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-live-units-ready", onUnitsReady);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pf-overview-auto-arranged", updateMinimap);

    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target?.parentElement;
        if (target?.closest?.(".pf-overview-control-rail")) return false;
        return Array.from(record.addedNodes || []).some((node) => node instanceof Element && (
          node.matches?.(".pf-overview-control-rail,.pf-masterplan-stage,.pf-overview-zoom-toolbar,.pf-unit-navigator,.pf-overview-groups,.pf-live-sales-callout") ||
          node.querySelector?.(".pf-overview-control-rail,.pf-masterplan-stage,.pf-overview-zoom-toolbar,.pf-unit-navigator,.pf-overview-groups,.pf-live-sales-callout")
        ));
      });
      if (relevant || !rail?.isConnected || !stage?.isConnected) scheduleSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      disposed = true;
      cancelAnimationFrame(syncFrame);
      observer?.disconnect();
      removeFocusOverlay();
      window.removeEventListener("pf-overview-focus-request", onFocusRequest);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-live-units-ready", onUnitsReady);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-overview-auto-arranged", updateMinimap);
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("pointerup", onPointerUp, true);
      stage?.removeEventListener("pointercancel", onPointerUp, true);
      focusCanvas?.remove();
      panel?.remove();
    };
  }, []);

  return null;
}
