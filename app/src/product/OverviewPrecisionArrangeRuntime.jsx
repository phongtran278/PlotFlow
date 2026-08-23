import { useEffect } from "react";
import "./OverviewPrecisionArrangeRuntime.css";

const UI_KEY = "plotflow-overview-precision-arrange-v1";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";

function readUi() {
  try {
    return { cardWidth: 180, gap: 12, ...(JSON.parse(localStorage.getItem(UI_KEY) || "{}") || {}) };
  } catch {
    return { cardWidth: 180, gap: 12 };
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
    const ui = readUi();

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    const selected = () => {
      const list = cards().filter((card) => card.classList.contains("pf-card-selected"));
      return list.length ? list : cards();
    };
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

    function applyCardWidth() {
      if (!stage) return;
      const width = clamp(ui.cardWidth, 72, 320);
      const factor = width / 208;
      stage.style.setProperty("--pf-sell-card-scale", String(factor));
      stage.style.setProperty("--pf-sell-card-width", `${width}px`);
      stage.style.setProperty("--pf-sell-card-pad-y", `${Math.max(4, 9 * factor)}px`);
      stage.style.setProperty("--pf-sell-card-pad-x", `${Math.max(5, 9 * factor)}px`);
      stage.style.setProperty("--pf-sell-code-size", `${Math.max(14, 32 * factor)}px`);
      stage.style.setProperty("--pf-sell-price-size", `${Math.max(13, 26 * factor)}px`);
      requestAnimationFrame(() => { persist(); updateConnectors(); });
    }

    function syncLegacyGap(value) {
      if (!rail) return;
      const oldGap = rail.querySelector('.pf-card-layout-control [data-layout-ui="gap"]');
      const oldLabel = oldGap?.closest("label");
      if (oldLabel) oldLabel.hidden = true;
      if (!oldGap) return;
      const next = String(clamp(value, 0, 96));
      if (oldGap.value === next) return;
      oldGap.value = next;
      oldGap.dispatchEvent(new Event("input", { bubbles: true }));
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

    function equalGap() {
      const list = [...selected()].sort((a, b) => a.offsetTop - b.offsetTop);
      if (list.length < 2) return;
      let top = list[0].offsetTop;
      const gap = clamp(ui.gap, 0, 120);
      list.forEach((card) => {
        card.style.top = `${top}px`;
        top += card.offsetHeight + gap;
      });
      persist(); updateConnectors();
    }

    function install() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      rail = document.querySelector(".pf-overview-control-rail");
      if (!stage || !rail) return false;
      applyCardWidth();
      const oldSize = rail.querySelector('.pf-card-layout-control [data-layout-ui="size"]')?.closest("label");
      if (oldSize) oldSize.hidden = true;
      syncLegacyGap(ui.gap);
      if (!panel?.isConnected) {
        panel = document.createElement("details");
        panel.className = "pf-precision-arrange";
        panel.innerHTML = `
          <summary>Precision</summary>
          <div class="pf-precision-popover">
            <header><strong>Pixel-perfect layout</strong><small>Select cards. Click a selected card again to make it the key object.</small></header>
            <label><span>Card width</span><input data-precision-width type="number" min="72" max="320" step="1"><b>px</b></label>
            <label><span>Equal gap</span><input data-precision-gap type="number" min="0" max="120" step="1"><b>px</b></label>
            <div class="pf-precision-group"><span>Align to key</span><div><button data-align="left">L</button><button data-align="center">C</button><button data-align="right">R</button><button data-align="top">T</button><button data-align="middle">M</button><button data-align="bottom">B</button></div></div>
            <button class="pf-precision-distribute" data-distribute>Distribute with exact gap</button>
          </div>`;
        const width = panel.querySelector("[data-precision-width]");
        const gap = panel.querySelector("[data-precision-gap]");
        width.value = String(clamp(ui.cardWidth, 72, 320));
        gap.value = String(clamp(ui.gap, 0, 120));
        width.addEventListener("input", () => { ui.cardWidth = Number(width.value) || 180; saveUi(ui); applyCardWidth(); });
        gap.addEventListener("input", () => { ui.gap = Number(gap.value) || 0; saveUi(ui); syncLegacyGap(ui.gap); });
        panel.querySelectorAll("[data-align]").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); align(button.dataset.align); }));
        panel.querySelector("[data-distribute]").addEventListener("click", (event) => { event.preventDefault(); equalGap(); });
        rail.appendChild(panel);
      }
      return true;
    }

    function tick() {
      if (disposed || install()) return;
      frame = requestAnimationFrame(tick);
    }

    tick();
    window.addEventListener("pf-overview-live-units-ready", install);
    window.addEventListener("pf-overview-auto-arranged", () => requestAnimationFrame(updateConnectors));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("pf-overview-live-units-ready", install);
      panel?.remove();
    };
  }, []);

  return null;
}
