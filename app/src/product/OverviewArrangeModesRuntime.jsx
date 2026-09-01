import { useEffect } from "react";
import "./OverviewArrangeModesRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const ARRANGE_UI_KEY = "plotflow-overview-arrange-preview-v1";
const SAFE_TOP_PX = 96;
const SAFE_BOTTOM_PX = 20;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function codeFor(card) {
  return card?.dataset?.unitCode
    || card?.querySelector(".pf-sell-card-code")?.textContent?.trim()
    || "";
}

function objectScale(card) {
  const value = Number(card?.dataset?.pfObjectScale || card?.style?.scale || 1);
  return Number.isFinite(value) ? clamp(value, 0.2, 2.2) : 1;
}

function readArrangeUi() {
  try {
    const value = JSON.parse(localStorage.getItem(ARRANGE_UI_KEY) || "{}");
    return { gap: clamp(value?.gap ?? 14, 0, 120) };
  } catch {
    return { gap: 14 };
  }
}

export default function OverviewArrangeModesRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let overlay = null;
    let canvas = null;
    let mode = "smart";
    let draft = {};
    let items = [];
    let drag = null;
    let resolvedGapPx = 14;
    const ui = readArrangeUi();

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];

    function saveArrangeUi() {
      localStorage.setItem(ARRANGE_UI_KEY, JSON.stringify(ui));
    }

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function pdfBounds() {
      if (!stage) return null;
      const x = Number(stage.dataset.pfPdfX);
      const y = Number(stage.dataset.pfPdfY);
      const width = Number(stage.dataset.pfPdfWidth);
      const height = Number(stage.dataset.pfPdfHeight);
      if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) return null;
      return { x, y, width, height };
    }

    function safeArea(bounds) {
      const top = clamp(SAFE_TOP_PX / Math.max(1, bounds.height), 0.04, 0.18);
      const bottom = clamp(SAFE_BOTTOM_PX / Math.max(1, bounds.height), 0.015, 0.08);
      return { top, bottom, height: Math.max(0.2, 1 - top - bottom) };
    }

    function anchorFor(code, bounds) {
      const anchor = Array.from(stage?.querySelectorAll(".pf-live-map-anchor") || [])
        .find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code);
      if (!anchor || !bounds) return { x: 0.5, y: 0.5, resolved: false };
      const stageW = stage.clientWidth || 1;
      const stageH = stage.clientHeight || 1;
      const px = Number.parseFloat(anchor.style.left || "50") / 100 * stageW;
      const py = Number.parseFloat(anchor.style.top || "50") / 100 * stageH;
      return {
        x: clamp((px - bounds.x) / bounds.width, 0.02, 0.98),
        y: clamp((py - bounds.y) / bounds.height, 0.02, 0.98),
        resolved: anchor.dataset.located === "1" || anchor.dataset.saved === "1",
      };
    }

    function captureItems() {
      const bounds = pdfBounds();
      if (!bounds) return [];
      return cards().map((card, index) => {
        const code = codeFor(card);
        const scale = objectScale(card);
        const width = (card.offsetWidth || 192) * scale;
        const height = (card.offsetHeight || 132) * scale;
        const anchor = anchorFor(code, bounds);
        return {
          card,
          code,
          index,
          width,
          height,
          anchor,
          current: {
            x: clamp((card.offsetLeft + width / 2 - bounds.x) / bounds.width, 0.03, 0.97),
            y: clamp((card.offsetTop + height / 2 - bounds.y) / bounds.height, 0.03, 0.97),
          },
        };
      }).filter((item) => item.code);
    }

    function split(itemsForMode, selectedMode) {
      const left = [];
      const right = [];
      const sorted = [...itemsForMode].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      if (selectedMode === "left") return { left: sorted, right };
      if (selectedMode === "right") return { left, right: sorted };

      const bounds = pdfBounds();
      if (!bounds) return { left: sorted, right };
      const safe = safeArea(bounds);
      const gap = ui.gap / Math.max(1, bounds.height);
      let leftLoad = 0;
      let rightLoad = 0;

      function addedLoad(list, item) {
        return item.height / Math.max(1, bounds.height) + (list.length ? gap : 0);
      }

      function addTo(side, item) {
        if (side === "left") {
          leftLoad += addedLoad(left, item);
          left.push(item);
        } else {
          rightLoad += addedLoad(right, item);
          right.push(item);
        }
      }

      if (selectedMode === "balanced" || selectedMode === "compact") {
        sorted.forEach((item) => addTo(leftLoad <= rightLoad ? "left" : "right", item));
        return { left, right };
      }

      sorted.forEach((item) => {
        const preferred = item.anchor.x < 0.47 ? "left" : item.anchor.x > 0.53 ? "right" : null;
        if (!preferred) {
          addTo(leftLoad <= rightLoad ? "left" : "right", item);
          return;
        }

        const preferredList = preferred === "left" ? left : right;
        const other = preferred === "left" ? "right" : "left";
        const preferredLoad = preferred === "left" ? leftLoad : rightLoad;
        const otherLoad = preferred === "left" ? rightLoad : leftLoad;
        const preferredNext = preferredLoad + addedLoad(preferredList, item);
        const otherList = other === "left" ? left : right;
        const otherNext = otherLoad + addedLoad(otherList, item);
        const shouldRebalance = preferredNext > safe.height && otherNext < preferredNext;
        addTo(shouldRebalance ? other : preferred, item);
      });
      return { left, right };
    }

    function gapCapacityPx(list, bounds) {
      if (!bounds || list.length <= 1) return ui.gap;
      const safe = safeArea(bounds);
      const cardHeightPx = list.reduce((sum, item) => sum + item.height, 0);
      const safeHeightPx = safe.height * bounds.height;
      return Math.max(0, (safeHeightPx - cardHeightPx) / (list.length - 1));
    }

    function exactVerticalCenters(list, { anchorAware = false, gapPx = ui.gap } = {}) {
      const bounds = pdfBounds();
      const sorted = [...list].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const result = new Map();
      if (!bounds || !sorted.length) return { centers: result };

      const safe = safeArea(bounds);
      const heights = sorted.map((item) => item.height / bounds.height);
      const cardHeight = heights.reduce((sum, value) => sum + value, 0);
      const gap = Math.max(0, gapPx) / bounds.height;
      const total = cardHeight + Math.max(0, sorted.length - 1) * gap;

      const anchorMean = sorted.reduce((sum, item) => sum + item.anchor.y, 0) / sorted.length;
      const targetCenter = anchorAware ? anchorMean : safe.top + safe.height / 2;
      const minStart = safe.top;
      const maxStart = Math.max(minStart, 1 - safe.bottom - total);
      let cursor = clamp(targetCenter - total / 2, minStart, maxStart);

      sorted.forEach((item, index) => {
        const center = cursor + heights[index] / 2;
        result.set(item.code, center);
        cursor += heights[index] + gap;
      });

      return { centers: result };
    }

    function buildDraft(selectedMode) {
      mode = selectedMode;
      const next = {};
      const { left, right } = split(items, selectedMode);
      const bounds = pdfBounds();
      const capacityCandidates = bounds
        ? [left, right].filter((list) => list.length > 1).map((list) => gapCapacityPx(list, bounds))
        : [];
      resolvedGapPx = capacityCandidates.length
        ? Math.min(ui.gap, ...capacityCandidates)
        : ui.gap;
      const anchorAware = selectedMode === "smart";
      const leftSolve = exactVerticalCenters(left, { anchorAware, gapPx: resolvedGapPx });
      const rightSolve = exactVerticalCenters(right, { anchorAware, gapPx: resolvedGapPx });
      const leftX = selectedMode === "compact" ? 0.24 : selectedMode === "left" ? 0.16 : 0.13;
      const rightX = selectedMode === "compact" ? 0.76 : selectedMode === "right" ? 0.84 : 0.87;
      left.forEach((item) => { next[item.code] = { x: leftX, y: leftSolve.centers.get(item.code) ?? 0.5 }; });
      right.forEach((item) => { next[item.code] = { x: rightX, y: rightSolve.centers.get(item.code) ?? 0.5 }; });
      draft = next;
      renderDraft();
    }

    function updateFooter() {
      const footer = overlay?.querySelector("footer>span");
      if (!footer) return;
      const resolved = Math.round(resolvedGapPx * 10) / 10;
      footer.textContent = resolved + 0.05 < ui.gap
        ? `${items.length} cards · ${ui.gap}px requested · ${resolved}px shared gap fits · preview only`
        : `${items.length} cards · ${ui.gap}px shared gap · preview only`;
    }

    function syncPreviewConnectors() {
      if (!canvas) return;
      const svg = canvas.querySelector(".pf-arrange-preview-lines");
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width < 1 || svgRect.height < 1) return;

      // Keep SVG user units identical to its rendered pixel box. Card chips and lot
      // anchors are HTML elements, so this avoids any percentage/viewBox mismatch.
      svg.setAttribute("viewBox", `0 0 ${svgRect.width} ${svgRect.height}`);
      svg.setAttribute("preserveAspectRatio", "none");

      svg.querySelectorAll("line").forEach((line) => {
        const code = line.dataset.code || "";
        const chip = canvas.querySelector(`.pf-arrange-preview-chip[data-code="${CSS.escape(code)}"]`);
        const anchor = canvas.querySelector(`.pf-arrange-preview-anchor[data-code="${CSS.escape(code)}"]`);
        if (!chip || !anchor) return;

        const chipRect = chip.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const cardLeft = chipRect.left - svgRect.left;
        const cardTop = chipRect.top - svgRect.top;
        const cardRight = chipRect.right - svgRect.left;
        const cardBottom = chipRect.bottom - svgRect.top;
        const cardCenterX = (cardLeft + cardRight) / 2;
        const cardCenterY = (cardTop + cardBottom) / 2;
        const anchorX = anchorRect.left + anchorRect.width / 2 - svgRect.left;
        const anchorY = anchorRect.top + anchorRect.height / 2 - svgRect.top;

        let startX = cardCenterX;
        let startY = cardCenterY;
        if (anchorX < cardLeft) {
          startX = cardLeft;
        } else if (anchorX > cardRight) {
          startX = cardRight;
        } else if (anchorY < cardTop) {
          startY = cardTop;
        } else if (anchorY > cardBottom) {
          startY = cardBottom;
        }

        line.setAttribute("x1", String(startX));
        line.setAttribute("y1", String(startY));
        line.setAttribute("x2", String(anchorX));
        line.setAttribute("y2", String(anchorY));
      });
    }

    function renderDraft() {
      if (!canvas) return;
      canvas.querySelectorAll(".pf-arrange-preview-chip").forEach((chip) => {
        const point = draft[chip.dataset.code];
        if (!point) return;
        chip.style.left = `${point.x * 100}%`;
        chip.style.top = `${point.y * 100}%`;
      });
      syncPreviewConnectors();
      overlay?.querySelectorAll("[data-arrange-mode]").forEach((button) => {
        button.classList.toggle("active", button.dataset.arrangeMode === mode);
      });
      const label = overlay?.querySelector("[data-arrange-mode-label]");
      if (label) label.textContent = mode === "smart" ? "Smart L/R" : mode === "balanced" ? "Balanced" : mode === "compact" ? "Compact" : mode === "left" ? "All left" : "All right";
      updateFooter();
    }

    function buildCanvas() {
      if (!canvas) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      canvas.innerHTML = "";
      canvas.style.setProperty("--pf-arrange-safe-top", `${safe.top * 100}%`);
      const reserved = document.createElement("div");
      reserved.className = "pf-arrange-preview-safe-top";
      reserved.style.height = `${safe.top * 100}%`;
      reserved.innerHTML = "<span>Reserved banner area</span>";
      canvas.appendChild(reserved);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.classList.add("pf-arrange-preview-lines");
      canvas.appendChild(svg);

      items.forEach((item) => {
        const anchor = document.createElement("span");
        anchor.className = `pf-arrange-preview-anchor${item.anchor.resolved ? " is-resolved" : ""}`;
        anchor.dataset.code = item.code;
        anchor.style.left = `${item.anchor.x * 100}%`;
        anchor.style.top = `${item.anchor.y * 100}%`;
        anchor.title = `${item.code} · lot point`;
        canvas.appendChild(anchor);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.dataset.code = item.code;
        if (!item.anchor.resolved) line.classList.add("is-unresolved");
        svg.appendChild(line);

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pf-arrange-preview-chip";
        chip.dataset.code = item.code;
        chip.textContent = item.code;
        chip.style.setProperty("--pf-preview-card-w", `${clamp(item.width / bounds.width * 100, 5.5, 18)}%`);
        chip.style.setProperty("--pf-preview-card-h", `${clamp(item.height / bounds.height * 100, 4, 18)}%`);
        chip.title = `${item.code} · drag to refine preview`;
        chip.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          drag = { code: item.code, pointerId: event.pointerId, node: chip };
          chip.setPointerCapture?.(event.pointerId);
        });
        canvas.appendChild(chip);
      });
    }

    function applyDraft() {
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      let layout = {};
      try { layout = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}") || {}; } catch { layout = {}; }
      items.forEach((item) => {
        const point = draft[item.code];
        if (!point) return;
        const minTop = bounds.y + safe.top * bounds.height;
        const maxLeft = bounds.x + bounds.width - item.width;
        const maxTop = bounds.y + bounds.height - safe.bottom * bounds.height - item.height;
        const left = clamp(bounds.x + point.x * bounds.width - item.width / 2, bounds.x, Math.max(bounds.x, maxLeft));
        const top = clamp(bounds.y + point.y * bounds.height - item.height / 2, minTop, Math.max(minTop, maxTop));
        item.card.style.left = `${left}px`;
        item.card.style.right = "auto";
        item.card.style.top = `${top}px`;
        item.card.dataset.pfAutoSide = point.x <= 0.5 ? "left" : "right";
        layout[item.code] = { ...(layout[item.code] || {}), left, top };
        delete layout[item.code].width;
        delete layout[item.code].height;
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: `preview-${mode}`, count: items.length, gap: resolvedGapPx, requestedGap: ui.gap } }));
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
      closePreview();
    }

    function closePreview() {
      drag = null;
      overlay?.remove();
      overlay = null;
      canvas = null;
    }

    function openPreview() {
      if (disposed || !syncStage()) return;
      items = captureItems();
      if (!items.length) return;
      closePreview();
      overlay = document.createElement("div");
      overlay.className = "pf-arrange-preview-overlay";
      overlay.innerHTML = `
        <section class="pf-arrange-preview-panel" role="dialog" aria-modal="true" aria-label="Arrange preview">
          <header><div><span>AUTO ARRANGE</span><strong>Preview layout before applying</strong></div><button type="button" data-arrange-close aria-label="Close">×</button></header>
          <div class="pf-arrange-preview-body">
            <div class="pf-arrange-preview-map-wrap">
              <div class="pf-arrange-preview-map-head"><span>Layout preview</span><b data-arrange-mode-label>Smart L/R</b></div>
              <div class="pf-arrange-preview-map"></div>
              <small>The top banner area is reserved. Every connector is attached to the rendered card edge and its matching lot point.</small>
            </div>
            <aside class="pf-arrange-preview-modes">
              <span>LAYOUT OPTIONS</span>
              <label class="pf-arrange-gap-control"><span>Gap</span><input data-arrange-gap type="number" min="0" max="120" step="1" value="${ui.gap}"><b>px</b></label>
              <button type="button" data-arrange-mode="smart"><strong>Smart L/R</strong><small>Follow lot side; rebalance only when needed</small></button>
              <button type="button" data-arrange-mode="balanced"><strong>Balanced</strong><small>Balance visual card load across both sides</small></button>
              <button type="button" data-arrange-mode="compact"><strong>Compact</strong><small>Balanced columns closer to the masterplan</small></button>
              <button type="button" data-arrange-mode="left"><strong>All left</strong><small>One left-side column</small></button>
              <button type="button" data-arrange-mode="right"><strong>All right</strong><small>One right-side column</small></button>
            </aside>
          </div>
          <footer><span>${items.length} cards · ${ui.gap}px gap · preview only</span><div><button type="button" data-arrange-cancel>Cancel</button><button type="button" class="primary" data-arrange-apply>Apply layout</button></div></footer>
        </section>`;
      document.body.appendChild(overlay);
      canvas = overlay.querySelector(".pf-arrange-preview-map");
      buildCanvas();
      buildDraft("smart");

      overlay.addEventListener("input", (event) => {
        if (!event.target.matches("[data-arrange-gap]")) return;
        ui.gap = clamp(event.target.value, 0, 120);
        saveArrangeUi();
        buildDraft(mode);
      });
      overlay.addEventListener("click", (event) => {
        const modeButton = event.target.closest("[data-arrange-mode]");
        if (modeButton) { buildDraft(modeButton.dataset.arrangeMode); return; }
        if (event.target.closest("[data-arrange-apply]")) { applyDraft(); return; }
        if (event.target.closest("[data-arrange-close],[data-arrange-cancel]")) { closePreview(); return; }
        if (event.target === overlay) closePreview();
      });
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !canvas) return;
      event.preventDefault();
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      const item = items.find((entry) => entry.code === drag.code);
      const rect = canvas.getBoundingClientRect();
      const halfH = item ? item.height / bounds.height / 2 : 0;
      const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0.04, 0.96);
      const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height), safe.top + halfH, 1 - safe.bottom - halfH);
      draft[drag.code] = { x, y };
      renderDraft();
    }

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { drag.node.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
      drag = null;
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && overlay) closePreview();
    }

    function onRequest() {
      openPreview();
    }

    function onGroupChanged() {
      closePreview();
      syncStage();
    }

    syncStage();
    window.addEventListener("pf-overview-arrange-preview-request", onRequest);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", finishDrag, true);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      disposed = true;
      closePreview();
      window.removeEventListener("pf-overview-arrange-preview-request", onRequest);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
