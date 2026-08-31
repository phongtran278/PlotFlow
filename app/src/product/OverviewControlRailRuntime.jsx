import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const CARD_DIMENSIONS_KEY = "plotflow-overview-card-dimensions-v2";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readJson(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let observer = null;
    let syncFrame = 0;
    let rail = null;
    let stage = null;
    let panel = null;
    let draggedCard = false;
    let ratioLocked = true;
    let lockedRatio = 192 / 140;

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
      const widthInput = panel.querySelector('[data-card-dimension="width"]');
      const heightInput = panel.querySelector('[data-card-dimension="height"]');
      const lock = panel.querySelector('[data-card-action="lock-ratio"]');
      if (widthInput) widthInput.value = String(Math.round(width));
      if (heightInput) heightInput.value = String(Math.round(height));
      if (lock) {
        lock.classList.toggle("active", ratioLocked);
        lock.setAttribute("aria-pressed", ratioLocked ? "true" : "false");
      }
    }

    function updateMinimap() {
      if (!panel || !stage) return;
      const svg = panel.querySelector(".pf-arrange-minimap svg");
      if (!svg) return;
      const stageWidth = stage.clientWidth || 1;
      const stageHeight = stage.clientHeight || 1;
      const anchorMap = new Map(anchors().map((anchor) => [anchor.dataset.unitCode || anchor.textContent?.trim() || "", anchor]));
      const output = ['<rect class="pf-mini-artboard" x="1" y="1" width="118" height="58" rx="5"/>'];

      cards().forEach((card) => {
        const code = card.dataset.unitCode || "";
        const x = clamp(card.offsetLeft / stageWidth * 120, 1, 116);
        const y = clamp(card.offsetTop / stageHeight * 60, 1, 56);
        const width = clamp(card.offsetWidth / stageWidth * 120, 3, 14);
        const height = clamp(card.offsetHeight / stageHeight * 60, 3, 10);
        const anchor = anchorMap.get(code);
        const anchorX = anchor ? clamp(Number.parseFloat(anchor.style.left || "50") / 100 * 120, 1, 119) : 60;
        const anchorY = anchor ? clamp(Number.parseFloat(anchor.style.top || "50") / 100 * 60, 1, 59) : 30;
        output.push(`<line class="pf-mini-line" x1="${(x + width / 2).toFixed(1)}" y1="${(y + height / 2).toFixed(1)}" x2="${anchorX.toFixed(1)}" y2="${anchorY.toFixed(1)}"/>`);
        output.push(`<rect class="pf-mini-card" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="1.5"/>`);
        output.push(`<circle class="pf-mini-anchor" cx="${anchorX.toFixed(1)}" cy="${anchorY.toFixed(1)}" r="1.2"/>`);
      });

      svg.innerHTML = output.join("");
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
        if (action === "arrange") {
          triggerAutoArrange();
          return;
        }
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
          if (dimension === "width") height = Math.round(width / Math.max(0.1, lockedRatio));
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

    function onPointerDown(event) {
      if (event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout")) draggedCard = true;
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
      window.setTimeout(() => {
        sync();
        syncDimensions();
        updateMinimap();
      }, 30);
    }

    function onGroupChanged() {
      window.setTimeout(() => {
        sync();
        syncDimensions();
        updateMinimap();
      }, 40);
    }

    window.addEventListener("pf-overview-live-units-ready", onUnitsReady);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pf-overview-auto-arranged", updateMinimap);
    window.addEventListener("pf-overview-card-size-changed", updateMinimap);

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
      cancelAnimationFrame(syncFrame);
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", onUnitsReady);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-overview-auto-arranged", updateMinimap);
      window.removeEventListener("pf-overview-card-size-changed", updateMinimap);
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("pointerup", onPointerUp, true);
      stage?.removeEventListener("pointercancel", onPointerUp, true);
      panel?.remove();
    };
  }, []);

  return null;
}
