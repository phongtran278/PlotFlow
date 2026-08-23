import { useEffect } from "react";
import "./OverviewPrecisionArrangeRuntime.css";

const UI_KEY = "plotflow-overview-precision-arrange-v2";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const LEGACY_LAYOUT_UI_KEY = "phongflow-overview-layout-ui-v1";

function readUi() {
  try {
    return { cardWidth: 180, cardHeight: 0, scale: 100, gap: 12, ...(JSON.parse(localStorage.getItem(UI_KEY) || "{}") || {}) };
  } catch {
    return { cardWidth: 180, cardHeight: 0, scale: 100, gap: 12 };
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

    function targetCards() {
      return selected();
    }

    function applyDimensions({ width = null, height = null, ratio = null } = {}) {
      const list = targetCards();
      if (!list.length) return;
      list.forEach((card) => {
        const currentWidth = card.offsetWidth || 180;
        const currentHeight = card.offsetHeight || 100;
        const nextWidth = ratio == null ? (width ?? currentWidth) : currentWidth * ratio;
        const nextHeight = ratio == null ? (height ?? currentHeight) : currentHeight * ratio;
        card.style.width = `${clamp(nextWidth, 64, 420)}px`;
        card.style.height = `${clamp(nextHeight, 56, 420)}px`;
        card.style.minHeight = `${clamp(nextHeight, 56, 420)}px`;
        card.style.right = "auto";
      });
      persist();
      requestAnimationFrame(updateConnectors);
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
        list.forEach((card) => {
          card.style.left = `${left}px`;
          card.style.right = "auto";
          left += card.offsetWidth + gap;
        });
      } else {
        list.sort((a, b) => a.offsetTop - b.offsetTop);
        let top = list[0].offsetTop;
        list.forEach((card) => {
          card.style.top = `${top}px`;
          top += card.offsetHeight + gap;
        });
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
      if (!railObserver) {
        railObserver = new MutationObserver(hideLegacySizing);
        railObserver.observe(rail, { childList: true, subtree: true });
      }
      if (!panel?.isConnected) {
        panel = document.createElement("details");
        panel.className = "pf-precision-arrange";
        panel.innerHTML = `
          <summary>Transform</summary>
          <div class="pf-precision-popover">
            <header><strong>Card transform</strong><small>Select one or more cards. Size and spacing never reset during align/distribute.</small></header>
            <label><span>Width</span><input data-precision-width type="number" min="64" max="420" step="1"><b>px</b></label>
            <label><span>Height</span><input data-precision-height type="number" min="56" max="420" step="1"><b>px</b></label>
            <label><span>Scale</span><input data-precision-scale type="number" min="25" max="300" step="1"><b>%</b></label>
            <label><span>Gap</span><input data-precision-gap type="number" min="0" max="120" step="1"><b>px</b></label>
            <div class="pf-precision-group"><span>Align to key object</span><div><button data-align="left">L</button><button data-align="center">C</button><button data-align="right">R</button><button data-align="top">T</button><button data-align="middle">M</button><button data-align="bottom">B</button></div></div>
            <div class="pf-precision-distribute-row"><button data-distribute="vertical">Distribute V</button><button data-distribute="horizontal">Distribute H</button></div>
          </div>`;
        const width = panel.querySelector("[data-precision-width]");
        const height = panel.querySelector("[data-precision-height]");
        const scale = panel.querySelector("[data-precision-scale]");
        const gap = panel.querySelector("[data-precision-gap]");
        width.value = String(clamp(ui.cardWidth, 64, 420));
        height.value = String(clamp(ui.cardHeight || 100, 56, 420));
        scale.value = "100";
        gap.value = String(clamp(ui.gap, 0, 120));
        width.addEventListener("change", () => { ui.cardWidth = Number(width.value) || 180; saveUi(ui); applyDimensions({ width: ui.cardWidth }); });
        height.addEventListener("change", () => { ui.cardHeight = Number(height.value) || 100; saveUi(ui); applyDimensions({ height: ui.cardHeight }); });
        scale.addEventListener("change", () => {
          const next = clamp(scale.value, 25, 300);
          const previous = clamp(ui.scale || 100, 25, 300);
          ui.scale = next;
          saveUi(ui);
          applyDimensions({ ratio: next / previous });
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
    function tick() {
      if (disposed || install()) return;
      frame = requestAnimationFrame(tick);
    }

    tick();
    window.addEventListener("pf-overview-live-units-ready", install);
    window.addEventListener("pf-overview-auto-arranged", () => requestAnimationFrame(updateConnectors));
    document.addEventListener("pointerup", onSelectionChange, true);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      railObserver?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", install);
      document.removeEventListener("pointerup", onSelectionChange, true);
      panel?.remove();
    };
  }, []);

  return null;
}
