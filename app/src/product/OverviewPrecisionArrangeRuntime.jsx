import { useEffect } from "react";
import "./OverviewPrecisionArrangeRuntime.css";

const UI_KEY = "plotflow-overview-precision-arrange-v2";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const LEGACY_LAYOUT_UI_KEY = "phongflow-overview-layout-ui-v1";
const BASE_CARD_WIDTH = 192;

function readUi() {
  try {
    return { cardWidth: 180, cardHeight: 100, scale: 100, gap: 12, constrain: true, ...(JSON.parse(localStorage.getItem(UI_KEY) || "{}") || {}) };
  } catch {
    return { cardWidth: 180, cardHeight: 100, scale: 100, gap: 12, constrain: true };
  }
}

function saveUi(value) { localStorage.setItem(UI_KEY, JSON.stringify(value)); }
function codeFor(card) { return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || ""; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }

export default function OverviewPrecisionArrangeRuntime() {
  useEffect(() => {
    let disposed = false;
    let panel = null;
    let stage = null;
    let rail = null;
    let frame = 0;
    let railObserver = null;
    const ui = readUi();

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    const selected = () => cards().filter((card) => card.classList.contains("pf-card-selected"));
    const keyCard = (list) => list.find((card) => card.classList.contains("pf-card-key")) || list[0] || null;

    function persist() {
      const layout = {};
      cards().forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function updateConnectors() {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      cards().forEach((card) => {
        const code = codeFor(card);
        const line = Array.from(stage.querySelectorAll(".pf-live-callout-lines line")).find((node) => node.dataset.unitCode === code);
        const anchor = Array.from(stage.querySelectorAll(".pf-live-map-anchor")).find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code);
        if (!line || !anchor) return;
        const anchorX = Number.parseFloat(anchor.style.left || "50") / 100 * w;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const startX = anchorX >= cardCenter ? card.offsetLeft + card.offsetWidth : card.offsetLeft;
        const startY = card.offsetTop + card.offsetHeight / 2;
        line.setAttribute("x1", String(startX / w * 100));
        line.setAttribute("y1", String(startY / h * 100));
      });
    }

    function syncCardVisualScale(card, width = card?.offsetWidth || BASE_CARD_WIDTH) {
      if (!card) return;
      const visualScale = clamp(width / BASE_CARD_WIDTH, 0.34, 2.2);
      card.style.setProperty("--pf-card-content-scale", String(visualScale));
    }

    function syncAllCardVisualScales() {
      cards().forEach((card) => syncCardVisualScale(card));
    }

    function setCardSize(card, width, height) {
      const nextWidth = clamp(width, 64, 420);
      const nextHeight = clamp(height, 56, 420);
      card.style.setProperty("--pf-card-width", `${nextWidth}px`);
      card.style.setProperty("--pf-card-height", `${nextHeight}px`);
      card.style.width = `${nextWidth}px`;
      card.style.height = `${nextHeight}px`;
      card.style.minHeight = `${nextHeight}px`;
      card.style.right = "auto";
      syncCardVisualScale(card, nextWidth);
    }

    function applyDimensionsTo(list, { width = null, height = null, ratio = null } = {}) {
      if (!list.length) return;
      list.forEach((card) => {
        const currentWidth = card.offsetWidth || 180;
        const currentHeight = card.offsetHeight || 100;
        const nextWidth = ratio == null ? (width ?? currentWidth) : currentWidth * ratio;
        const nextHeight = ratio == null ? (height ?? currentHeight) : currentHeight * ratio;
        setCardSize(card, nextWidth, nextHeight);
      });
      persist();
      requestAnimationFrame(updateConnectors);
    }

    function applyDimensions(options = {}) { applyDimensionsTo(selected(), options); }

    function applySizeToAll(width, height) {
      const list = cards();
      if (!list.length) return;
      applyDimensionsTo(list, { width, height });
      window.dispatchEvent(new CustomEvent("pf-overview-all-card-size", { detail: { count: list.length, width, height } }));
    }

    function hideLegacySizing() {
      if (!rail) return;
      rail.querySelectorAll('.pf-card-layout-control [data-layout-ui="size"],.pf-card-layout-control [data-layout-ui="gap"]').forEach((input) => {
        const label = input.closest("label");
        if (label) label.style.display = "none";
      });
    }

    function syncQuickArrangeGap(value) {
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_LAYOUT_UI_KEY) || "{}") || {};
        legacy.gap = clamp(value, 0, 120);
        localStorage.setItem(LEGACY_LAYOUT_UI_KEY, JSON.stringify(legacy));
      } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("pf-overview-precision-gap", { detail: { gap: clamp(value, 0, 120) } }));
    }

    function align(kind) {
      const list = selected();
      if (list.length < 2) return;
      const key = keyCard(list);
      if (!key) return;
      const k = { left: key.offsetLeft, top: key.offsetTop, width: key.offsetWidth, height: key.offsetHeight };
      list.forEach((card) => {
        if (card === key) return;
        if (kind === "left") card.style.left = `${k.left}px`;
        if (kind === "center") card.style.left = `${k.left + k.width / 2 - card.offsetWidth / 2}px`;
        if (kind === "right") card.style.left = `${k.left + k.width - card.offsetWidth}px`;
        if (kind === "top") card.style.top = `${k.top}px`;
        if (kind === "middle") card.style.top = `${k.top + k.height / 2 - card.offsetHeight / 2}px`;
        if (kind === "bottom") card.style.top = `${k.top + k.height - card.offsetHeight}px`;
        card.style.right = "auto";
      });
      persist(); updateConnectors();
    }

    function equalGap(axis = "vertical") {
      const list = [...selected()];
      if (list.length < 2) return;
      const gap = clamp(ui.gap, 0, 120);
      if (axis === "horizontal") {
        list.sort((a, b) => a.offsetLeft - b.offsetLeft);
        let left = list[0].offsetLeft;
        list.forEach((card) => { card.style.left = `${left}px`; card.style.right = "auto"; left += card.offsetWidth + gap; });
      } else {
        list.sort((a, b) => a.offsetTop - b.offsetTop);
        let top = list[0].offsetTop;
        list.forEach((card) => { card.style.top = `${top}px`; top += card.offsetHeight + gap; });
      }
      persist(); updateConnectors();
    }

    function syncPanelFromSelection() {
      if (!panel?.isConnected) return;
      const list = selected();
      const key = keyCard(list);
      if (!key) return;
      const width = panel.querySelector("[data-precision-width]");
      const height = panel.querySelector("[data-precision-height]");
      if (width && document.activeElement !== width) width.value = String(Math.round(key.offsetWidth));
      if (height && document.activeElement !== height) height.value = String(Math.round(key.offsetHeight));
    }

    function install() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      rail = document.querySelector(".pf-overview-control-rail");
      if (!stage || !rail) return false;
      hideLegacySizing();
      syncQuickArrangeGap(ui.gap);
      syncAllCardVisualScales();
      if (!railObserver) {
        railObserver = new MutationObserver(() => {
          hideLegacySizing();
          syncAllCardVisualScales();
        });
        railObserver.observe(rail, { childList: true, subtree: true });
      }
      if (!panel?.isConnected) {
        panel = document.createElement("details");
        panel.className = "pf-precision-arrange";
        panel.innerHTML = `
          <summary>Transform</summary>
          <div class="pf-precision-popover">
            <header><strong>Card transform</strong><small>Resize selected cards, lock proportions, or apply one size to every card.</small></header>
            <label><span>Width</span><input data-precision-width type="number" min="64" max="420" step="1"><b>px</b></label>
            <label><span>Height</span><input data-precision-height type="number" min="56" max="420" step="1"><b>px</b></label>
            <label class="pf-precision-ratio"><span>Constrain</span><input data-precision-constrain type="checkbox"><b>W:H</b></label>
            <div class="pf-precision-distribute-row"><button data-precision-all-size>Apply size to all cards</button></div>
            <label><span>Scale</span><input data-precision-scale type="number" min="10" max="300" step="1"><b>%</b></label>
            <label><span>Gap</span><input data-precision-gap type="number" min="0" max="120" step="1"><b>px</b></label>
            <div class="pf-precision-group"><span>Align to key object</span><div><button data-align="left">L</button><button data-align="center">C</button><button data-align="right">R</button><button data-align="top">T</button><button data-align="middle">M</button><button data-align="bottom">B</button></div></div>
            <div class="pf-precision-distribute-row"><button data-distribute="vertical">Distribute V</button><button data-distribute="horizontal">Distribute H</button></div>
          </div>`;
        const width = panel.querySelector("[data-precision-width]");
        const height = panel.querySelector("[data-precision-height]");
        const constrain = panel.querySelector("[data-precision-constrain]");
        const scale = panel.querySelector("[data-precision-scale]");
        const gap = panel.querySelector("[data-precision-gap]");
        const applyAll = panel.querySelector("[data-precision-all-size]");
        width.value = String(clamp(ui.cardWidth, 64, 420));
        height.value = String(clamp(ui.cardHeight || 100, 56, 420));
        constrain.checked = ui.constrain !== false;
        ui.scale = clamp(ui.scale || 100, 10, 300);
        scale.value = String(ui.scale);
        gap.value = String(clamp(ui.gap, 0, 120));

        function currentRatio() {
          const w = Math.max(1, Number(width.value) || ui.cardWidth || 180);
          const h = Math.max(1, Number(height.value) || ui.cardHeight || 100);
          return w / h;
        }
        let ratio = currentRatio();

        constrain.addEventListener("change", () => {
          ui.constrain = constrain.checked;
          if (ui.constrain) ratio = currentRatio();
          saveUi(ui);
        });
        width.addEventListener("change", () => {
          const nextWidth = clamp(width.value, 64, 420);
          let nextHeight = clamp(height.value, 56, 420);
          if (constrain.checked) { nextHeight = clamp(nextWidth / Math.max(0.01, ratio), 56, 420); height.value = String(Math.round(nextHeight)); }
          ui.cardWidth = nextWidth; ui.cardHeight = nextHeight; saveUi(ui);
          applyDimensions({ width: nextWidth, height: constrain.checked ? nextHeight : null });
        });
        height.addEventListener("change", () => {
          const nextHeight = clamp(height.value, 56, 420);
          let nextWidth = clamp(width.value, 64, 420);
          if (constrain.checked) { nextWidth = clamp(nextHeight * ratio, 64, 420); width.value = String(Math.round(nextWidth)); }
          ui.cardWidth = nextWidth; ui.cardHeight = nextHeight; saveUi(ui);
          applyDimensions({ width: constrain.checked ? nextWidth : null, height: nextHeight });
        });
        applyAll.addEventListener("click", (event) => {
          event.preventDefault();
          ui.cardWidth = clamp(width.value, 64, 420);
          ui.cardHeight = clamp(height.value, 56, 420);
          saveUi(ui);
          applySizeToAll(ui.cardWidth, ui.cardHeight);
        });
        scale.addEventListener("change", () => {
          const next = clamp(scale.value, 10, 300);
          const previous = clamp(ui.scale || 100, 10, 300);
          ui.scale = next;
          saveUi(ui);
          scale.value = String(next);
          applyDimensions({ ratio: next / Math.max(10, previous) });
        });
        gap.addEventListener("change", () => { ui.gap = Number(gap.value) || 0; saveUi(ui); syncQuickArrangeGap(ui.gap); });
        panel.querySelectorAll("[data-align]").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); align(button.dataset.align); }));
        panel.querySelectorAll("[data-distribute]").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); equalGap(button.dataset.distribute); }));
        rail.appendChild(panel);
      }
      syncPanelFromSelection();
      return true;
    }

    function onSelectionChange() { requestAnimationFrame(syncPanelFromSelection); }
    function onUnitsReady() { requestAnimationFrame(() => { syncAllCardVisualScales(); install(); }); }
    function tick() { if (disposed || install()) return; frame = requestAnimationFrame(tick); }

    tick();
    window.addEventListener("pf-overview-live-units-ready", onUnitsReady);
    window.addEventListener("pf-overview-auto-arranged", () => requestAnimationFrame(updateConnectors));
    document.addEventListener("pointerup", onSelectionChange, true);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      railObserver?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", onUnitsReady);
      document.removeEventListener("pointerup", onSelectionChange, true);
      panel?.remove();
    };
  }, []);

  return null;
}
