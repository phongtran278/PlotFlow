import { useEffect } from "react";
import "./OverviewArrangeModesRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const PRECISION_KEY = "plotflow-overview-precision-arrange-v2";

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

export default function OverviewArrangeModesRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let observer = null;

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

    function anchorFor(card) {
      const code = codeFor(card);
      const anchor = Array.from(stage?.querySelectorAll(".pf-live-map-anchor") || []).find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code);
      return {
        x: clamp(Number.parseFloat(anchor?.style.left || "50"), 0, 100),
        y: clamp(Number.parseFloat(anchor?.style.top || "50"), 0, 100),
      };
    }

    function persist() {
      const layout = {};
      cards().forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function placeColumn(items, side, bounds, gap) {
      if (!items.length) return;
      const insetX = 20;
      const insetY = 18;
      const sorted = [...items].sort((a, b) => a.anchor.y - b.anchor.y || codeFor(a.card).localeCompare(codeFor(b.card)));
      const totalHeight = sorted.reduce((sum, item) => sum + item.card.offsetHeight, 0);
      const availableGap = sorted.length > 1 ? Math.max(0, (bounds.height - insetY * 2 - totalHeight) / (sorted.length - 1)) : 0;
      const resolvedGap = Math.min(gap, availableGap);
      let top = Math.max(bounds.y + insetY, bounds.y + (bounds.height - (totalHeight + resolvedGap * Math.max(0, sorted.length - 1))) / 2);

      sorted.forEach(({ card }) => {
        const left = side === "left"
          ? bounds.x + insetX
          : bounds.x + bounds.width - insetX - card.offsetWidth;
        card.style.left = `${clamp(left, bounds.x + insetX, Math.max(bounds.x + insetX, bounds.x + bounds.width - insetX - card.offsetWidth))}px`;
        card.style.top = `${clamp(top, bounds.y + insetY, Math.max(bounds.y + insetY, bounds.y + bounds.height - insetY - card.offsetHeight))}px`;
        card.style.right = "auto";
        top += card.offsetHeight + resolvedGap;
      });
    }

    function arrange(mode) {
      const bounds = pdfBounds();
      const list = cards();
      if (!bounds || !list.length) return;
      const gap = clamp(readJson(PRECISION_KEY, {}).gap ?? 14, 0, 120);
      const items = list.map((card) => ({ card, anchor: anchorFor(card) }));
      let left = [];
      let right = [];

      if (mode === "left") {
        left = items;
      } else if (mode === "right") {
        right = items;
      } else if (mode === "even") {
        const sorted = [...items].sort((a, b) => a.anchor.y - b.anchor.y);
        sorted.forEach((item, index) => (index % 2 === 0 ? left : right).push(item));
      } else {
        const sortedX = [...items].sort((a, b) => a.anchor.x - b.anchor.x || a.anchor.y - b.anchor.y);
        const leftCount = Math.ceil(sortedX.length / 2);
        left = sortedX.slice(0, leftCount);
        right = sortedX.slice(leftCount);
      }

      placeColumn(left, "left", bounds, gap);
      placeColumn(right, "right", bounds, gap);
      persist();
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: `preset-${mode}`, left: left.length, right: right.length, gap } }));
    }

    function enhanceArrangeUi() {
      const popover = document.querySelector(".pf-layout-map-popover");
      if (!popover || popover.querySelector(".pf-arrange-mode-grid")) return;
      const footer = popover.querySelector("footer");
      const legacy = footer?.querySelector('[data-layout-ui="tidy"]');
      if (legacy) legacy.style.display = "none";
      const modes = document.createElement("div");
      modes.className = "pf-arrange-mode-grid";
      modes.innerHTML = `
        <button type="button" data-pf-arrange-mode="smart"><strong>Smart balance</strong><small>Anchor-aware · least crossing</small></button>
        <button type="button" data-pf-arrange-mode="even"><strong>Even split</strong><small>Balanced left / right</small></button>
        <button type="button" data-pf-arrange-mode="left"><strong>Left column</strong><small>Single clean column</small></button>
        <button type="button" data-pf-arrange-mode="right"><strong>Right column</strong><small>Single clean column</small></button>`;
      modes.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-pf-arrange-mode]");
        if (!button) return;
        event.preventDefault();
        arrange(button.dataset.pfArrangeMode);
      });
      footer?.before(modes);
    }

    function sync() {
      if (disposed) return;
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      enhanceArrangeUi();
    }

    window.addEventListener("pf-overview-live-units-ready", sync);
    window.addEventListener("pf-overview-pdf-bounds", sync);
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", sync);
      window.removeEventListener("pf-overview-pdf-bounds", sync);
      document.querySelector(".pf-arrange-mode-grid")?.remove();
    };
  }, []);

  return null;
}