import { useEffect } from "react";
import "./OverviewLayoutGuardRuntime.css";

const GUIDE_KEY = "plotflow-overview-guides-v2";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const PRECISION_KEY = "plotflow-overview-precision-arrange-v2";
const BASE_CARD_WIDTH = 192;

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

export default function OverviewLayoutGuardRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let rail = null;
    let sizeControl = null;
    let observer = null;
    let cardDrag = null;
    let snapMarker = null;
    let needsFit = true;

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

    function persistCards(list = cards()) {
      const layout = readJson(CARD_LAYOUT_KEY, {});
      list.forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function setCardSize(card, width, height) {
      const nextWidth = clamp(width, 64, 420);
      const nextHeight = clamp(height, 56, 420);
      card.style.setProperty("--pf-card-width", `${nextWidth}px`);
      card.style.setProperty("--pf-card-height", `${nextHeight}px`);
      card.style.setProperty("--pf-card-content-scale", String(clamp(nextWidth / BASE_CARD_WIDTH, 0.34, 2.2)));
      card.style.width = `${nextWidth}px`;
      card.style.height = `${nextHeight}px`;
      card.style.minHeight = `${nextHeight}px`;
      card.style.right = "auto";
    }

    function ensureCardsFit() {
      const list = cards();
      if (!list.length) return;
      requestAnimationFrame(() => {
        let changed = false;
        list.forEach((card) => {
          const required = Math.ceil(card.scrollHeight);
          if (required > card.offsetHeight + 1) {
            card.style.setProperty("--pf-card-height", `${required}px`);
            card.style.height = `${required}px`;
            card.style.minHeight = `${required}px`;
            changed = true;
          }
        });
        if (changed) persistCards(list);
      });
    }

    function applyAllSize(width, height) {
      const list = cards();
      if (!list.length) return;
      const nextWidth = clamp(width, 64, 420);
      const nextHeight = clamp(height, 56, 420);
      list.forEach((card) => setCardSize(card, nextWidth, nextHeight));
      const precision = readJson(PRECISION_KEY, {});
      precision.cardWidth = nextWidth;
      precision.cardHeight = nextHeight;
      localStorage.setItem(PRECISION_KEY, JSON.stringify(precision));
      persistCards(list);
      ensureCardsFit();
      window.dispatchEvent(new CustomEvent("pf-overview-all-card-size", { detail: { width: nextWidth, height: nextHeight, count: list.length } }));
    }

    function gridTarget(card) {
      if (!card || !stage) return null;
      const guides = readJson(GUIDE_KEY, {});
      if (guides.snapGrid === false) return null;
      const bounds = pdfBounds();
      if (!bounds) return null;
      const size = clamp(guides.gridSize ?? 16, 8, 64);
      const localLeft = card.offsetLeft - bounds.x;
      const localTop = card.offsetTop - bounds.y;
      const snappedLeft = Math.round(localLeft / size) * size;
      const snappedTop = Math.round(localTop / size) * size;
      return {
        bounds,
        size,
        left: bounds.x + snappedLeft,
        top: bounds.y + snappedTop,
        dx: snappedLeft - localLeft,
        dy: snappedTop - localTop,
      };
    }

    function showSnapPreview(card) {
      const target = gridTarget(card);
      if (!target || !stage) {
        card?.classList.remove("pf-grid-snap-candidate");
        if (snapMarker) snapMarker.hidden = true;
        return;
      }
      if (!snapMarker?.isConnected) {
        snapMarker = document.createElement("div");
        snapMarker.className = "pf-grid-snap-marker";
        stage.appendChild(snapMarker);
      }
      card.classList.add("pf-grid-snap-candidate");
      snapMarker.hidden = false;
      snapMarker.style.left = `${target.left}px`;
      snapMarker.style.top = `${target.top}px`;
      snapMarker.style.width = `${Math.min(target.size, card.offsetWidth)}px`;
      snapMarker.style.height = `${Math.min(target.size, card.offsetHeight)}px`;
    }

    function clearSnapPreview() {
      cardDrag?.card?.classList.remove("pf-grid-snap-candidate");
      cards().forEach((card) => card.classList.remove("pf-grid-snap-candidate"));
      if (snapMarker) snapMarker.hidden = true;
    }

    function snapDraggedCards() {
      if (!cardDrag || !stage) return;
      const candidate = cardDrag.card;
      const target = gridTarget(candidate);
      cardDrag = null;
      if (!candidate?.isConnected || !target) {
        clearSnapPreview();
        return;
      }
      const selected = cards().filter((card) => card.classList.contains("pf-card-selected"));
      const list = selected.length ? selected : [candidate];
      list.forEach((card) => {
        const left = clamp(card.offsetLeft + target.dx, target.bounds.x, target.bounds.x + target.bounds.width - card.offsetWidth);
        const top = clamp(card.offsetTop + target.dy, target.bounds.y, target.bounds.y + target.bounds.height - card.offsetHeight);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.right = "auto";
      });
      persistCards(list);
      clearSnapPreview();
      stage.classList.add("pf-grid-snap-flash");
      window.setTimeout(() => stage?.classList.remove("pf-grid-snap-flash"), 220);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: "grid-snap" } }));
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      const card = event.target.closest?.(".pf-live-sales-callout");
      if (!card || !stage?.contains(card)) return;
      cardDrag = { card, pointerId: event.pointerId };
      showSnapPreview(card);
    }

    function onPointerMove(event) {
      if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
      requestAnimationFrame(() => showSnapPreview(cardDrag?.card));
    }

    function onPointerUp(event) {
      if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
      snapDraggedCards();
    }

    function triggerFit() {
      if (!document.body.classList.contains("pf-product-overview")) return;
      document.querySelector('.pf-overview-zoom-toolbar [data-action="fit"]')?.click();
      needsFit = false;
    }

    function requestFit() {
      needsFit = true;
      requestAnimationFrame(() => requestAnimationFrame(triggerFit));
    }

    function onPdfBounds() {
      if (needsFit) requestAnimationFrame(triggerFit);
      ensureCardsFit();
    }

    function onGroupChanged() {
      requestFit();
      window.setTimeout(requestFit, 120);
    }

    function installSizeControl() {
      rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return;
      if (!sizeControl?.isConnected) {
        const precision = readJson(PRECISION_KEY, {});
        sizeControl = document.createElement("div");
        sizeControl.className = "pf-overview-all-size-control";
        sizeControl.innerHTML = `<span>All cards</span><label>W <input data-all-width type="number" min="64" max="420" step="1" value="${clamp(precision.cardWidth ?? 180, 64, 420)}"><b>px</b></label><label>H <input data-all-height type="number" min="56" max="420" step="1" value="${clamp(precision.cardHeight ?? 132, 56, 420)}"><b>px</b></label><button type="button" data-all-apply>Apply</button>`;
        const width = sizeControl.querySelector("[data-all-width]");
        const height = sizeControl.querySelector("[data-all-height]");
        sizeControl.querySelector("[data-all-apply]").addEventListener("click", () => applyAllSize(width.value, height.value));
        rail.appendChild(sizeControl);
      }
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      if (stage) {
        stage.removeEventListener("pointerdown", onPointerDown, true);
        stage.removeEventListener("pointermove", onPointerMove, true);
        stage.removeEventListener("pointerup", onPointerUp, true);
        stage.removeEventListener("pointercancel", onPointerUp, true);
      }
      clearSnapPreview();
      stage = nextStage;
      stage.addEventListener("pointerdown", onPointerDown, true);
      stage.addEventListener("pointermove", onPointerMove, true);
      stage.addEventListener("pointerup", onPointerUp, true);
      stage.addEventListener("pointercancel", onPointerUp, true);
      requestFit();
      ensureCardsFit();
    }

    function sync() {
      if (disposed) return;
      installSizeControl();
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
    }

    window.addEventListener("pf-overview-pdf-bounds", onPdfBounds);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pf-overview-live-units-ready", sync);
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    sync();

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("pf-overview-pdf-bounds", onPdfBounds);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-overview-live-units-ready", sync);
      if (stage) {
        stage.removeEventListener("pointerdown", onPointerDown, true);
        stage.removeEventListener("pointermove", onPointerMove, true);
        stage.removeEventListener("pointerup", onPointerUp, true);
        stage.removeEventListener("pointercancel", onPointerUp, true);
      }
      clearSnapPreview();
      snapMarker?.remove();
      sizeControl?.remove();
    };
  }, []);

  return null;
}