import { useEffect } from "react";
import "./OverviewGuideRuntime.css";

const GUIDE_KEY = "plotflow-overview-guides-v1";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const PRECISION_KEY = "plotflow-overview-precision-arrange-v2";
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
    let observer = null;
    let drag = null;
    let state = { visible: true, x: 0.08, y: 0.14, ...readJson(GUIDE_KEY, {}) };

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
      vertical.hidden = !state.visible;
      horizontal.hidden = !state.visible;
      vertical.style.left = `${point.x}px`;
      vertical.style.top = `${bounds.y}px`;
      vertical.style.height = `${bounds.height}px`;
      horizontal.style.left = `${bounds.x}px`;
      horizontal.style.top = `${point.y}px`;
      horizontal.style.width = `${bounds.width}px`;
      panel?.querySelector("[data-guide-toggle]")?.classList.toggle("active", state.visible);
    }

    function arrangeSingleLeftColumn() {
      const bounds = pdfBounds();
      const list = cards();
      if (!bounds || !list.length) return;
      const precision = readJson(PRECISION_KEY, {});
      const requestedGap = clamp(precision.gap ?? 12, 0, 120);
      const inset = 14;
      const ordered = [...list].sort((a, b) => a.offsetTop - b.offsetTop || codeFor(a).localeCompare(codeFor(b)));
      const totalHeight = ordered.reduce((sum, card) => sum + card.offsetHeight, 0);
      const maxGap = ordered.length > 1
        ? Math.max(0, (bounds.height - inset * 2 - totalHeight) / (ordered.length - 1))
        : 0;
      const gap = Math.min(requestedGap, maxGap);
      const point = guideWorldPosition();
      const left = clamp(point.x, bounds.x + inset, bounds.x + bounds.width - inset - Math.max(...ordered.map((card) => card.offsetWidth)));
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

    function snapCardsAfterDrag(event) {
      if (!state.visible || !stage) return;
      const targetCard = event.target.closest?.(".pf-live-sales-callout");
      if (!targetCard || !stage.contains(targetCard)) return;
      const point = guideWorldPosition();
      const bounds = pdfBounds();
      if (!point || !bounds) return;

      const selected = cards().filter((card) => card.classList.contains("pf-card-selected"));
      const list = selected.length ? selected : [targetCard];
      const xCandidates = [
        { value: targetCard.offsetLeft, delta: point.x - targetCard.offsetLeft },
        { value: targetCard.offsetLeft + targetCard.offsetWidth / 2, delta: point.x - (targetCard.offsetLeft + targetCard.offsetWidth / 2) },
        { value: targetCard.offsetLeft + targetCard.offsetWidth, delta: point.x - (targetCard.offsetLeft + targetCard.offsetWidth) },
      ];
      const yCandidates = [
        { value: targetCard.offsetTop, delta: point.y - targetCard.offsetTop },
        { value: targetCard.offsetTop + targetCard.offsetHeight / 2, delta: point.y - (targetCard.offsetTop + targetCard.offsetHeight / 2) },
        { value: targetCard.offsetTop + targetCard.offsetHeight, delta: point.y - (targetCard.offsetTop + targetCard.offsetHeight) },
      ];
      const xSnap = xCandidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
      const ySnap = yCandidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
      const dx = Math.abs(xSnap.delta) <= SNAP_PX ? xSnap.delta : 0;
      const dy = Math.abs(ySnap.delta) <= SNAP_PX ? ySnap.delta : 0;
      if (!dx && !dy) return;

      list.forEach((card) => {
        const nextLeft = clamp(card.offsetLeft + dx, bounds.x, bounds.x + bounds.width - card.offsetWidth);
        const nextTop = clamp(card.offsetTop + dy, bounds.y, bounds.y + bounds.height - card.offsetHeight);
        card.style.left = `${nextLeft}px`;
        card.style.right = "auto";
        card.style.top = `${nextTop}px`;
      });
      persistCards(list);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: "guide-snap" } }));
    }

    function installPanel() {
      rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return;
      if (!panel?.isConnected) {
        panel = document.createElement("div");
        panel.className = "pf-overview-guide-control";
        panel.innerHTML = '<button type="button" data-guide-toggle class="active" title="Show or hide alignment guides">Guides</button>';
        panel.querySelector("[data-guide-toggle]").addEventListener("click", () => {
          state.visible = !state.visible;
          saveState();
          renderGuides();
        });
        rail.appendChild(panel);
      }
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      vertical?.remove();
      horizontal?.remove();
      vertical = null;
      horizontal = null;
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
    };
  }, []);

  return null;
}
