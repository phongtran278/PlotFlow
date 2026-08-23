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
    let scaleControl = null;
    let observer = null;
    let cardDrag = null;
    let needsFit = true;
    let allScale = 100;

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
        layout[code] = {
          left: card.offsetLeft,
          top: card.offsetTop,
          width: card.offsetWidth,
          height: card.offsetHeight,
        };
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

    function applyAllScale(nextValue) {
      const next = clamp(nextValue, 10, 300);
      const previous = clamp(allScale, 10, 300);
      const ratio = next / Math.max(10, previous);
      const list = cards();
      if (!list.length) return;
      list.forEach((card) => setCardSize(card, card.offsetWidth * ratio, card.offsetHeight * ratio));
      allScale = next;
      const precision = readJson(PRECISION_KEY, {});
      precision.scale = next;
      localStorage.setItem(PRECISION_KEY, JSON.stringify(precision));
      persistCards(list);
      ensureCardsFit();
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: "scale-all", scale: next } }));
    }

    function snapDraggedCards() {
      if (!cardDrag || !stage) return;
      const candidate = cardDrag.card;
      cardDrag = null;
      if (!candidate?.isConnected) return;
      const guides = readJson(GUIDE_KEY, {});
      if (guides.snapGrid === false) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const gridSize = clamp(guides.gridSize ?? 16, 8, 64);
      const localLeft = candidate.offsetLeft - bounds.x;
      const localTop = candidate.offsetTop - bounds.y;
      const dx = Math.round(localLeft / gridSize) * gridSize - localLeft;
      const dy = Math.round(localTop / gridSize) * gridSize - localTop;
      const selected = cards().filter((card) => card.classList.contains("pf-card-selected"));
      const list = selected.length ? selected : [candidate];
      list.forEach((card) => {
        const left = clamp(card.offsetLeft + dx, bounds.x, bounds.x + bounds.width - card.offsetWidth);
        const top = clamp(card.offsetTop + dy, bounds.y, bounds.y + bounds.height - card.offsetHeight);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.right = "auto";
      });
      persistCards(list);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: "grid-snap" } }));
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      const card = event.target.closest?.(".pf-live-sales-callout");
      if (!card || !stage?.contains(card)) return;
      cardDrag = { card, pointerId: event.pointerId };
    }

    function onPointerUp(event) {
      if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
      snapDraggedCards();
    }

    function triggerFit() {
      if (!document.body.classList.contains("pf-product-overview")) return;
      const fit = document.querySelector('.pf-overview-zoom-toolbar [data-action="fit"]');
      fit?.click();
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

    function installScaleControl() {
      rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return;
      if (!scaleControl?.isConnected) {
        scaleControl = document.createElement("label");
        scaleControl.className = "pf-overview-all-scale-control";
        scaleControl.innerHTML = '<span>All cards</span><input type="number" min="10" max="300" step="5" value="100" aria-label="Scale all cards"><b>%</b>';
        const input = scaleControl.querySelector("input");
        input.addEventListener("change", () => {
          const next = clamp(input.value, 10, 300);
          input.value = String(next);
          applyAllScale(next);
        });
        rail.appendChild(scaleControl);
      }
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      if (stage) {
        stage.removeEventListener("pointerdown", onPointerDown, true);
        stage.removeEventListener("pointerup", onPointerUp, true);
        stage.removeEventListener("pointercancel", onPointerUp, true);
      }
      stage = nextStage;
      stage.addEventListener("pointerdown", onPointerDown, true);
      stage.addEventListener("pointerup", onPointerUp, true);
      stage.addEventListener("pointercancel", onPointerUp, true);
      requestFit();
      ensureCardsFit();
    }

    function sync() {
      if (disposed) return;
      installScaleControl();
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
        stage.removeEventListener("pointerup", onPointerUp, true);
        stage.removeEventListener("pointercancel", onPointerUp, true);
      }
      scaleControl?.remove();
    };
  }, []);

  return null;
}
