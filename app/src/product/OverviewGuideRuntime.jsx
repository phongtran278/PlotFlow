import { useEffect } from "react";
import "./OverviewGuideRuntime.css";

const GUIDE_KEY = "plotflow-overview-guides-v2";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const PRECISION_KEY = "plotflow-overview-precision-arrange-v2";
const BASELINE_KEY = "plotflow-overview-layout-baseline-v3";
const SNAP_PX = 18;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

export default function OverviewGuideRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let rail = null;
    let panel = null;
    let vertical = null;
    let horizontal = null;
    let grid = null;
    let observer = null;
    let drag = null;
    let state = {
      guidesVisible: true,
      gridVisible: true,
      snapGuides: true,
      snapGrid: true,
      gridSize: 16,
      x: 0.08,
      y: 0.14,
      ...readJson(GUIDE_KEY, {}),
    };

    if (!localStorage.getItem(BASELINE_KEY)) {
      localStorage.removeItem(CARD_LAYOUT_KEY);
      localStorage.removeItem("plotflow-overview-guides-v1");
      localStorage.setItem(BASELINE_KEY, "1");
    }

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];

    function pdfBounds() {
      if (!stage) return null;
      const x = Number(stage.dataset.pfPdfX);
      const y = Number(stage.dataset.pfPdfY);
      const width = Number(stage.dataset.pfPdfWidth);
      const height = Number(stage.dataset.pfPdfHeight);
      if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) return null;
      return { x, y, width, height };
    }

    function saveState() {
      localStorage.setItem(GUIDE_KEY, JSON.stringify(state));
    }

    function persistCards(list = cards()) {
      const layout = readJson(CARD_LAYOUT_KEY, {});
      list.forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = {
          left: card.offsetLeft,
          top: card.offsetTop,
          width: card.offsetWidth,
          height: card.offsetHeight,
        };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function guideWorldPosition() {
      const bounds = pdfBounds();
      if (!bounds) return null;
      return {
        x: bounds.x + clamp(state.x, 0, 1) * bounds.width,
        y: bounds.y + clamp(state.y, 0, 1) * bounds.height,
      };
    }

    function renderGuides() {
      if (!stage) return;
      const bounds = pdfBounds();
      if (!bounds) return;

      if (!grid?.isConnected) {
        grid = document.createElement("div");
        grid.className = "pf-overview-grid";
        stage.appendChild(grid);
      }
      grid.hidden = !state.gridVisible;
      grid.style.left = `${bounds.x}px`;
      grid.style.top = `${bounds.y}px`;
      grid.style.width = `${bounds.width}px`;
      grid.style.height = `${bounds.height}px`;
      grid.style.setProperty("--pf-grid-size", `${clamp(state.gridSize, 8, 64)}px`);

      if (!vertical?.isConnected) {
        vertical = document.createElement("div");
        vertical.className = "pf-overview-guide-line is-vertical";
        vertical.dataset.guideAxis = "x";
        vertical.innerHTML = '<span title="Drag vertical guide">↔</span>';
        stage.appendChild(vertical);
      }
      if (!horizontal?.isConnected) {
        horizontal = document.createElement("div");
        horizontal.className = "pf-overview-guide-line is-horizontal";
        horizontal.dataset.guideAxis = "y";
        horizontal.innerHTML = '<span title="Drag horizontal guide">↕</span>';
        stage.appendChild(horizontal);
      }

      const point = guideWorldPosition();
      vertical.hidden = !state.guidesVisible;
      horizontal.hidden = !state.guidesVisible;
      vertical.style.left = `${point.x}px`;
      vertical.style.top = `${bounds.y}px`;
      vertical.style.height = `${bounds.height}px`;
      horizontal.style.left = `${bounds.x}px`;
      horizontal.style.top = `${point.y}px`;
      horizontal.style.width = `${bounds.width}px`;

      panel?.querySelector("[data-guide-toggle]")?.classList.toggle("active", state.guidesVisible);
      panel?.querySelector("[data-grid-toggle]")?.classList.toggle("active", state.gridVisible);
      panel?.querySelector("[data-grid-snap]")?.classList.toggle("active", state.snapGrid);
      panel?.querySelector("[data-guide-snap]")?.classList.toggle("active", state.snapGuides);
      const sizeInput = panel?.querySelector("[data-grid-size]");
      if (sizeInput && document.activeElement !== sizeInput) sizeInput.value = String(clamp(state.gridSize, 8, 64));
    }

    function arrangeSingleLeftColumn() {
      const bounds = pdfBounds();
      const list = cards();
      if (!bounds || !list.length) return;
      const precision = readJson(PRECISION_KEY, {});
      const requestedGap = clamp(precision.gap ?? 14, 0, 120);
      const inset = 18;
      const ordered = [...list].sort((a, b) => a.offsetTop - b.offsetTop || codeFor(a).localeCompare(codeFor(b)));
      const totalHeight = ordered.reduce((sum, card) => sum + card.offsetHeight, 0);
      const maxGap = ordered.length > 1
        ? Math.max(0, (bounds.height - inset * 2 - totalHeight) / (ordered.length - 1))
        : 0;
      const gap = Math.min(requestedGap, maxGap);
      const point = guideWorldPosition();
      const maxCardWidth = Math.max(...ordered.map((card) => card.offsetWidth));
      const left = clamp(point.x, bounds.x + inset, bounds.x + bounds.width - inset - maxCardWidth);
      let top = bounds.y + inset;

      ordered.forEach((card) => {
        const maxLeft = bounds.x + bounds.width - inset - card.offsetWidth;
        const maxTop = bounds.y + bounds.height - inset - card.offsetHeight;
        card.style.left = `${clamp(left, bounds.x + inset, Math.max(bounds.x + inset, maxLeft))}px`;
        card.style.right = "auto";
        card.style.top = `${clamp(top, bounds.y + inset, Math.max(bounds.y + inset, maxTop))}px`;
        top += card.offsetHeight + gap;
      });

      persistCards(ordered);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", {
        detail: { left: ordered.length, right: 0, mode: "single-left-column", gap },
      }));
    }

    function onArrangeCapture(event) {
      const button = event.target.closest?.('[data-layout-ui="tidy"]');
      if (!button || !document.body.classList.contains("pf-product-overview")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      arrangeSingleLeftColumn();
    }

    function onGuidePointerDown(event) {
      const line = event.target.closest?.(".pf-overview-guide-line");
      if (!line || !stage?.contains(line) || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      drag = { axis: line.dataset.guideAxis, pointerId: event.pointerId, line };
      line.setPointerCapture?.(event.pointerId);
    }

    function onGuidePointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !stage) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const rect = stage.getBoundingClientRect();
      if (drag.axis === "x") {
        const worldX = event.clientX - rect.left;
        state.x = clamp((worldX - bounds.x) / bounds.width, 0, 1);
      } else {
        const worldY = event.clientY - rect.top;
        state.y = clamp((worldY - bounds.y) / bounds.height, 0, 1);
      }
      renderGuides();
    }

    function finishGuideDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { drag.line.releasePointerCapture?.(event.pointerId); } catch {}
      drag = null;
      saveState();
    }

    function gridDelta(card, bounds) {
      if (!state.snapGrid) return { dx: 0, dy: 0 };
      const size = clamp(state.gridSize, 8, 64);
      const localLeft = card.offsetLeft - bounds.x;
      const localTop = card.offsetTop - bounds.y;
      const snappedLeft = Math.round(localLeft / size) * size;
      const snappedTop = Math.round(localTop / size) * size;
      return { dx: snappedLeft - localLeft, dy: snappedTop - localTop };
    }

    function guideDelta(card, point) {
      if (!state.snapGuides || !state.guidesVisible) return { dx: 0, dy: 0 };
      const xCandidates = [
        point.x - card.offsetLeft,
        point.x - (card.offsetLeft + card.offsetWidth / 2),
        point.x - (card.offsetLeft + card.offsetWidth),
      ];
      const yCandidates = [
        point.y - card.offsetTop,
        point.y - (card.offsetTop + card.offsetHeight / 2),
        point.y - (card.offsetTop + card.offsetHeight),
      ];
      const nearestX = xCandidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      const nearestY = yCandidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      return {
        dx: Math.abs(nearestX) <= SNAP_PX ? nearestX : 0,
        dy: Math.abs(nearestY) <= SNAP_PX ? nearestY : 0,
      };
    }

    function snapCardsAfterDrag(event) {
      if (!stage) return;
      const targetCard = event.target.closest?.(".pf-live-sales-callout");
      if (!targetCard || !stage.contains(targetCard)) return;
      const bounds = pdfBounds();
      const point = guideWorldPosition();
      if (!bounds || !point) return;

      const selected = cards().filter((card) => card.classList.contains("pf-card-selected"));
      const list = selected.length ? selected : [targetCard];
      const guide = guideDelta(targetCard, point);
      const gridSnap = gridDelta(targetCard, bounds);
      const dx = guide.dx || gridSnap.dx;
      const dy = guide.dy || gridSnap.dy;
      if (!dx && !dy) return;

      list.forEach((card) => {
        const nextLeft = clamp(card.offsetLeft + dx, bounds.x, bounds.x + bounds.width - card.offsetWidth);
        const nextTop = clamp(card.offsetTop + dy, bounds.y, bounds.y + bounds.height - card.offsetHeight);
        card.style.left = `${nextLeft}px`;
        card.style.right = "auto";
        card.style.top = `${nextTop}px`;
      });
      persistCards(list);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: state.snapGuides && (guide.dx || guide.dy) ? "guide-snap" : "grid-snap" } }));
    }

    function resetCanonicalLayout() {
      localStorage.removeItem(CARD_LAYOUT_KEY);
      state = {
        guidesVisible: true,
        gridVisible: true,
        snapGuides: true,
        snapGrid: true,
        gridSize: 16,
        x: 0.08,
        y: 0.14,
      };
      saveState();
      renderGuides();
      requestAnimationFrame(arrangeSingleLeftColumn);
    }

    function installPanel() {
      rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return;
      if (!panel?.isConnected) {
        panel = document.createElement("div");
        panel.className = "pf-overview-guide-control";
        panel.innerHTML = `
          <button type="button" data-guide-toggle title="Show or hide alignment guides">Guides</button>
          <button type="button" data-guide-snap title="Snap cards to guides">Snap guide</button>
          <button type="button" data-grid-toggle title="Show or hide layout grid">Grid</button>
          <button type="button" data-grid-snap title="Snap cards to grid">Snap grid</button>
          <label title="Grid spacing"><span>Grid</span><input data-grid-size type="number" min="8" max="64" step="2"><b>px</b></label>
          <button type="button" data-layout-reset title="Reset local card layout to the canonical baseline">Reset layout</button>`;

        panel.querySelector("[data-guide-toggle]").addEventListener("click", () => {
          state.guidesVisible = !state.guidesVisible;
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-guide-snap]").addEventListener("click", () => {
          state.snapGuides = !state.snapGuides;
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-grid-toggle]").addEventListener("click", () => {
          state.gridVisible = !state.gridVisible;
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-grid-snap]").addEventListener("click", () => {
          state.snapGrid = !state.snapGrid;
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-grid-size]").addEventListener("change", (event) => {
          state.gridSize = clamp(event.target.value, 8, 64);
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-layout-reset]").addEventListener("click", resetCanonicalLayout);
        rail.appendChild(panel);
      }
      renderGuides();
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      if (stage) {
        stage.removeEventListener("pointerdown", onGuidePointerDown, true);
        stage.removeEventListener("pointermove", onGuidePointerMove, true);
        stage.removeEventListener("pointerup", finishGuideDrag, true);
        stage.removeEventListener("pointercancel", finishGuideDrag, true);
        stage.removeEventListener("pointerup", snapCardsAfterDrag, true);
      }
      vertical?.remove();
      horizontal?.remove();
      grid?.remove();
      vertical = null;
      horizontal = null;
      grid = null;
      stage = nextStage;
      stage.addEventListener("pointerdown", onGuidePointerDown, true);
      stage.addEventListener("pointermove", onGuidePointerMove, true);
      stage.addEventListener("pointerup", finishGuideDrag, true);
      stage.addEventListener("pointercancel", finishGuideDrag, true);
      stage.addEventListener("pointerup", snapCardsAfterDrag, true);
      renderGuides();
    }

    function sync() {
      if (disposed) return;
      installPanel();
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      else renderGuides();
    }

    document.addEventListener("click", onArrangeCapture, true);
    window.addEventListener("pf-overview-pdf-bounds", sync);
    window.addEventListener("pf-overview-live-units-ready", sync);
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    sync();

    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener("click", onArrangeCapture, true);
      window.removeEventListener("pf-overview-pdf-bounds", sync);
      window.removeEventListener("pf-overview-live-units-ready", sync);
      if (stage) {
        stage.removeEventListener("pointerdown", onGuidePointerDown, true);
        stage.removeEventListener("pointermove", onGuidePointerMove, true);
        stage.removeEventListener("pointerup", finishGuideDrag, true);
        stage.removeEventListener("pointercancel", finishGuideDrag, true);
        stage.removeEventListener("pointerup", snapCardsAfterDrag, true);
      }
      panel?.remove();
      vertical?.remove();
      horizontal?.remove();
      grid?.remove();
    };
  }, []);

  return null;
}
