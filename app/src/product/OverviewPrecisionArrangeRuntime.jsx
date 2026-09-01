import { useEffect } from "react";
import "./OverviewPrecisionArrangeRuntime.css";

const UI_KEY = "plotflow-overview-precision-arrange-v2";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const LEGACY_LAYOUT_UI_KEY = "phongflow-overview-layout-ui-v1";
const BASE_CARD_WIDTH = 192;
const DEFAULT_CARD_WIDTH = 180;
const DEFAULT_CARD_HEIGHT = 132;

function readUi() {
  try {
    return { cardWidth: DEFAULT_CARD_WIDTH, cardHeight: DEFAULT_CARD_HEIGHT, scale: 100, gap: 14, constrain: true, ...(JSON.parse(localStorage.getItem(UI_KEY) || "{}") || {}) };
  } catch {
    return { cardWidth: DEFAULT_CARD_WIDTH, cardHeight: DEFAULT_CARD_HEIGHT, scale: 100, gap: 14, constrain: true };
  }
}

function saveUi(value) { localStorage.setItem(UI_KEY, JSON.stringify(value)); }
function codeFor(card) { return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || ""; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }

export default function OverviewPrecisionArrangeRuntime() {
  useEffect(() => {
    let disposed = false;
    let panel = null;
    let quickScale = null;
    let stage = null;
    let rail = null;
    let frame = 0;
    let railObserver = null;
    const ui = readUi();

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    const selected = () => cards().filter((card) => card.classList.contains("pf-card-selected"));
    const keyCard = (list) => list.find((card) => card.classList.contains("pf-card-key")) || list[0] || null;
    const targetCards = () => selected().length ? selected() : cards();

    function objectScale(card) {
      return clamp(card?.dataset?.pfObjectScale || 1, 0.34, 2.2);
    }

    function visualWidth(card) {
      return (card?.offsetWidth || BASE_CARD_WIDTH) * objectScale(card);
    }

    function visualHeight(card) {
      return (card?.offsetHeight || DEFAULT_CARD_HEIGHT) * objectScale(card);
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
        const cardWidth = visualWidth(card);
        const cardHeight = visualHeight(card);
        const cardCenter = card.offsetLeft + cardWidth / 2;
        const startX = anchorX >= cardCenter ? card.offsetLeft + cardWidth : card.offsetLeft;
        const startY = card.offsetTop + cardHeight / 2;
        line.setAttribute("x1", String(startX / w * 100));
        line.setAttribute("y1", String(startY / h * 100));
      });
    }

    function syncCardVisualScale(card, width = card?.offsetWidth || BASE_CARD_WIDTH) {
      if (!card) return;
      const visualScale = clamp(width / BASE_CARD_WIDTH, 0.34, 2.2);
      card.style.setProperty("--pf-card-content-scale", String(visualScale));
    }

    function setObjectScale(card, scale) {
      if (!card) return;
      const nextScale = clamp(scale, 0.34, 2.2);
      card.dataset.pfObjectScale = String(nextScale);
      card.style.transformOrigin = "0 0";
      card.style.transform = `scale(${nextScale})`;
      card.style.borderRadius = `${16 / nextScale}px`;
      const priceBox = card.querySelector(".pf-sell-card-pricebox");
      if (priceBox) priceBox.style.borderRadius = `${11 / nextScale}px`;
    }

    function setProportionalCardWidth(card, width) {
      if (!card) return;
      const nextWidth = clamp(width, 64, 420);
      card.style.setProperty("--pf-card-width", `${nextWidth}px`);
      card.style.removeProperty("--pf-card-height");
      card.style.width = `${nextWidth}px`;
      card.style.height = "auto";
      card.style.minHeight = "0px";
      card.style.right = "auto";
      syncCardVisualScale(card, nextWidth);
    }

    function setFreeCardSize(card, width, height) {
      if (!card) return;
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

    function syncAllCardVisualScales() {
      cards().forEach((card) => {
        syncCardVisualScale(card);
        setObjectScale(card, clamp(ui.scale || 100, 34, 220) / 100);
      });
    }

    function applyProportionalWidth(list, width, { save = true } = {}) {
      if (!list.length) return;
      list.forEach((card) => setProportionalCardWidth(card, width));
      requestAnimationFrame(() => {
        if (save) persist();
        updateConnectors();
        syncPanelFromSelection();
      });
    }

    function applyAbsoluteScale(list, percent, { save = true } = {}) {
      if (!list.length) return;
      const next = clamp(percent, 34, 220);
      list.forEach((card) => setObjectScale(card, next / 100));
      ui.scale = next;
      if (save) saveUi(ui);
      requestAnimationFrame(() => {
        if (save) persist();
        updateConnectors();
        syncPanelFromSelection();
      });
    }

    function scaleCards(list, ratio) {
      if (!list.length) return;
      list.forEach((card) => {
        const currentWidth = card.offsetWidth || DEFAULT_CARD_WIDTH;
        setProportionalCardWidth(card, currentWidth * ratio);
      });
      requestAnimationFrame(() => {
        persist();
        updateConnectors();
        syncPanelFromSelection();
      });
    }

    function applyFreeSize(list, width, height) {
      if (!list.length) return;
      list.forEach((card) => setFreeCardSize(card, width ?? card.offsetWidth, height ?? card.offsetHeight));
      persist();
      requestAnimationFrame(updateConnectors);
    }

    function applySizeToAll(width, height) {
      const list = cards();
      if (!list.length) return;
      if (ui.constrain !== false) applyProportionalWidth(list, width);
      else applyFreeSize(list, width, height);
      window.dispatchEvent(new CustomEvent("pf-overview-all-card-size", { detail: { count: list.length, width, height, proportional: ui.constrain !== false } }));
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
      const k = { left: key.offsetLeft, top: key.offsetTop, width: visualWidth(key), height: visualHeight(key) };
      list.forEach((card) => {
        if (card === key) return;
        const width = visualWidth(card);
        const height = visualHeight(card);
        if (kind === "left") card.style.left = `${k.left}px`;
        if (kind === "center") card.style.left = `${k.left + k.width / 2 - width / 2}px`;
        if (kind === "right") card.style.left = `${k.left + k.width - width}px`;
        if (kind === "top") card.style.top = `${k.top}px`;
        if (kind === "middle") card.style.top = `${k.top + k.height / 2 - height / 2}px`;
        if (kind === "bottom") card.style.top = `${k.top + k.height - height}px`;
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
        list.forEach((card) => { card.style.left = `${left}px`; card.style.right = "auto"; left += visualWidth(card) + gap; });
      } else {
        list.sort((a, b) => a.offsetTop - b.offsetTop);
        let top = list[0].offsetTop;
        list.forEach((card) => { card.style.top = `${top}px`; top += visualHeight(card) + gap; });
      }
      persist(); updateConnectors();
    }

    function syncPanelFromSelection() {
      const list = selected();
      const key = keyCard(list);
      if (panel?.isConnected && key) {
        const width = panel.querySelector("[data-precision-width]");
        const height = panel.querySelector("[data-precision-height]");
        if (width && document.activeElement !== width) width.value = String(Math.round(key.offsetWidth));
        if (height && document.activeElement !== height) height.value = String(Math.round(key.offsetHeight));
      }
      if (quickScale?.isConnected && key) {
        const pct = clamp(objectScale(key) * 100, 34, 220);
        const range = quickScale.querySelector("[data-quick-scale-range]");
        const number = quickScale.querySelector("[data-quick-scale-number]");
        if (range && document.activeElement !== range) range.value = String(Math.round(pct));
        if (number && document.activeElement !== number) number.value = String(Math.round(pct));
      }
    }

    function installQuickScale() {
      if (!rail || quickScale?.isConnected) return;
      quickScale = document.createElement("div");
      quickScale.className = "pf-card-quick-scale";
      quickScale.innerHTML = `
        <span>Scale</span>
        <input data-quick-scale-range type="range" min="34" max="220" step="1" value="100" aria-label="Card scale percent">
        <label><input data-quick-scale-number type="number" min="34" max="220" step="1" value="100" aria-label="Card scale percent"><b>%</b></label>`;
      const range = quickScale.querySelector("[data-quick-scale-range]");
      const number = quickScale.querySelector("[data-quick-scale-number]");
      const applyLive = (value) => {
        const next = clamp(value, 34, 220);
        range.value = String(next);
        number.value = String(Math.round(next));
        applyAbsoluteScale(targetCards(), next, { save: false });
      };
      range.addEventListener("input", () => applyLive(range.value));
      range.addEventListener("change", () => applyAbsoluteScale(targetCards(), range.value, { save: true }));
      number.addEventListener("input", () => applyLive(number.value));
      number.addEventListener("change", () => applyAbsoluteScale(targetCards(), number.value, { save: true }));
      rail.appendChild(quickScale);
    }

    function install() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      rail = document.querySelector(".pf-overview-control-rail");
      if (!stage || !rail) return false;
      hideLegacySizing();
      syncQuickArrangeGap(ui.gap);
      syncAllCardVisualScales();
      installQuickScale();
      if (!railObserver) {
        railObserver = new MutationObserver(() => {
          hideLegacySizing();
          installQuickScale();
        });
        railObserver.observe(rail, { childList: true, subtree: true });
      }
      if (!panel?.isConnected) {
        panel = document.createElement("details");
        panel.className = "pf-precision-arrange";
        panel.innerHTML = `
          <summary>Transform</summary>
          <div class="pf-precision-popover">
            <header><strong>Card transform</strong><small>Scale transforms the whole card as one object. Width and Height are separate reflow controls.</small></header>
            <label><span>Width</span><input data-precision-width type="number" min="64" max="420" step="1"><b>px</b></label>
            <label><span>Height</span><input data-precision-height type="number" min="56" max="420" step="1"><b>px</b></label>
            <label class="pf-precision-ratio"><span>Constrain</span><input data-precision-constrain type="checkbox"><b>W:H</b></label>
            <div class="pf-precision-distribute-row"><button data-precision-all-size>Apply size to all cards</button></div>
            <label><span>Scale</span><input data-precision-scale type="number" min="34" max="220" step="1"><b>%</b></label>
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
        width.value = String(clamp(ui.cardWidth || DEFAULT_CARD_WIDTH, 64, 420));
        height.value = String(clamp(ui.cardHeight || DEFAULT_CARD_HEIGHT, 56, 420));
        constrain.checked = ui.constrain !== false;
        ui.scale = clamp(ui.scale || 100, 34, 220);
        scale.value = String(ui.scale);
        gap.value = String(clamp(ui.gap, 0, 120));

        constrain.addEventListener("change", () => {
          ui.constrain = constrain.checked;
          saveUi(ui);
        });
        width.addEventListener("change", () => {
          const nextWidth = clamp(width.value, 64, 420);
          ui.cardWidth = nextWidth;
          if (constrain.checked) applyProportionalWidth(selected(), nextWidth);
          else applyFreeSize(selected(), nextWidth, null);
          requestAnimationFrame(() => {
            const key = keyCard(selected());
            if (key) ui.cardHeight = key.offsetHeight;
            saveUi(ui);
            syncPanelFromSelection();
          });
        });
        height.addEventListener("change", () => {
          const nextHeight = clamp(height.value, 56, 420);
          const list = selected();
          if (constrain.checked) {
            const key = keyCard(list);
            const currentHeight = Math.max(1, key?.offsetHeight || DEFAULT_CARD_HEIGHT);
            scaleCards(list, nextHeight / currentHeight);
          } else {
            applyFreeSize(list, null, nextHeight);
          }
          requestAnimationFrame(() => {
            const key = keyCard(selected());
            if (key) { ui.cardWidth = key.offsetWidth; ui.cardHeight = key.offsetHeight; }
            saveUi(ui);
            syncPanelFromSelection();
          });
        });
        applyAll.addEventListener("click", (event) => {
          event.preventDefault();
          ui.cardWidth = clamp(width.value, 64, 420);
          ui.cardHeight = clamp(height.value, 56, 420);
          saveUi(ui);
          applySizeToAll(ui.cardWidth, ui.cardHeight);
        });
        scale.addEventListener("change", () => {
          const next = clamp(scale.value, 34, 220);
          scale.value = String(next);
          applyAbsoluteScale(targetCards(), next, { save: true });
          if (quickScale?.isConnected) {
            quickScale.querySelector("[data-quick-scale-range]").value = String(next);
            quickScale.querySelector("[data-quick-scale-number]").value = String(next);
          }
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
    function onUnitsReady() { requestAnimationFrame(() => { syncAllCardVisualScales(); install(); updateConnectors(); }); }
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
      quickScale?.remove();
      panel?.remove();
    };
  }, []);

  return null;
}
