import { useEffect } from "react";
import "./OverviewV2Runtime.css";

const SETTINGS_KEY = "phongflow-overview-v2-settings";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";

const DEFAULTS = {
  anchorMode: "first-letter",
  leftCount: "auto",
  cardA: "#0c4b45",
  cardB: "#083f3a",
  gradient: true,
  lineColor: "#ef1b16",
  lineWidth: 2,
  lineOpacity: 1,
  highlightColor: "#ef1b16",
  highlightOpacity: 0.12,
  highlightStrokeColor: "#ef1b16",
  highlightWidth: 2,
  highlightStrokeOpacity: 1,
};

function readSettings() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(value) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || card?.querySelector("header strong")?.textContent?.trim() || "";
}

function anchorFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-map-anchor")).find((node) =>
    (node.dataset.unitCode || node.textContent?.trim()) === code
  ) || null;
}

function lineFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-callout-lines line")).find((node) => node.dataset.unitCode === code) || null;
}

function numStyle(node, prop, fallback = 0) {
  const value = Number.parseFloat(node?.style?.[prop] || "");
  return Number.isFinite(value) ? value : fallback;
}

export default function OverviewV2Runtime() {
  useEffect(() => {
    let disposed = false;
    let observer = null;
    let panel = null;
    let stage = null;
    let settings = readSettings();
    let strokeSelect = null;

    function applyStyleVars() {
      if (!stage) return;
      stage.style.setProperty("--pf-v2-card-a", settings.cardA);
      stage.style.setProperty("--pf-v2-card-b", settings.gradient ? settings.cardB : settings.cardA);
      stage.style.setProperty("--pf-v2-line", settings.lineColor);
      stage.style.setProperty("--pf-v2-line-width", `${settings.lineWidth}`);
      stage.style.setProperty("--pf-v2-line-opacity", `${settings.lineOpacity}`);
      stage.style.setProperty("--pf-v2-highlight", settings.highlightColor);
      stage.style.setProperty("--pf-v2-highlight-opacity", `${settings.highlightOpacity}`);
      stage.style.setProperty("--pf-v2-highlight-stroke", settings.highlightStrokeColor);
      stage.style.setProperty("--pf-v2-highlight-width", `${settings.highlightWidth}`);
      stage.style.setProperty("--pf-v2-highlight-stroke-opacity", `${settings.highlightStrokeOpacity}`);
      if (strokeSelect && String(strokeSelect.value) !== String(settings.lineWidth)) strokeSelect.value = String(settings.lineWidth);
    }

    function setUnifiedStroke(value) {
      const width = Math.max(1, Math.min(12, Number(value) || 2));
      settings.lineWidth = width;
      settings.highlightWidth = width;
      saveSettings(settings);
      applyStyleVars();
      const lineRange = panel?.querySelector('[data-v2="lineWidth"]');
      const highlightRange = panel?.querySelector('[data-v2="highlightWidth"]');
      if (lineRange) lineRange.value = String(width);
      if (highlightRange) highlightRange.value = String(width);
    }

    function bindStrokeControl() {
      const next = document.querySelector(".pf-overview-zoom-toolbar .pf-stroke-control select");
      if (!next || next === strokeSelect) return;
      strokeSelect?.removeEventListener("change", onToolbarStroke);
      strokeSelect = next;
      strokeSelect.value = String(settings.lineWidth);
      strokeSelect.addEventListener("change", onToolbarStroke);
    }

    function onToolbarStroke(event) {
      setUnifiedStroke(event.target.value);
    }

    function persistLayout(cards) {
      let layout = {};
      try { layout = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}") || {}; } catch { layout = {}; }
      cards.forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = {
          left: numStyle(card, "left", card.offsetLeft),
          top: numStyle(card, "top", card.offsetTop),
          width: numStyle(card, "width", card.offsetWidth),
          height: numStyle(card, "height", card.offsetHeight),
        };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function updateLineStarts(cards) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      cards.forEach((card) => {
        const code = codeFor(card);
        const line = lineFor(stage, code);
        const anchor = anchorFor(stage, code);
        if (!line || !anchor) return;
        const left = numStyle(card, "left", card.offsetLeft);
        const top = numStyle(card, "top", card.offsetTop);
        const width = numStyle(card, "width", card.offsetWidth);
        const height = numStyle(card, "height", card.offsetHeight);
        line.setAttribute("x1", String(((left + width / 2) / w) * 100));
        line.setAttribute("y1", String(((top + height / 2) / h) * 100));
        line.setAttribute("x2", String(Number.parseFloat(anchor.style.left || "50")));
        line.setAttribute("y2", String(Number.parseFloat(anchor.style.top || "50")));
        line.style.opacity = anchor.dataset.located === "1" || anchor.dataset.saved === "1" ? "" : "0";
      });
    }

    function sameSize(cards) {
      if (!cards.length) return;
      const width = Math.max(...cards.map((card) => card.offsetWidth || 238));
      const height = Math.max(...cards.map((card) => card.offsetHeight || 286));
      cards.forEach((card) => {
        card.style.width = `${width}px`;
        card.style.height = `${height}px`;
        card.style.minHeight = `${height}px`;
      });
      persistLayout(cards);
      updateLineStarts(cards);
    }

    function autoArrange() {
      if (!stage) return;
      const cards = Array.from(stage.querySelectorAll(".pf-live-sales-callout"));
      if (cards.length < 2) return;

      sameSize(cards);
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const marginX = Math.max(12, Math.round(w * 0.015));
      const marginY = Math.max(10, Math.round(h * 0.02));
      const cardW = cards[0].offsetWidth || 238;
      const cardH = cards[0].offsetHeight || 286;

      const items = cards.map((card) => {
        const code = codeFor(card);
        const anchor = anchorFor(stage, code);
        return {
          card,
          code,
          anchor,
          x: Number.parseFloat(anchor?.style.left || "50"),
          y: Number.parseFloat(anchor?.style.top || "50"),
        };
      }).filter((item) => item.anchor && (item.anchor.dataset.located === "1" || item.anchor.dataset.saved === "1"));

      const unresolved = cards.filter((card) => !items.some((item) => item.card === card));
      let leftCount;
      if (settings.leftCount === "auto") {
        const natural = items.filter((item) => item.x <= 50).length;
        leftCount = Math.max(1, Math.min(items.length - 1, natural || Math.round(items.length / 2)));
      } else {
        leftCount = Math.max(1, Math.min(items.length - 1, Number(settings.leftCount) || Math.round(items.length / 2)));
      }

      const byX = [...items].sort((a, b) => a.x - b.x);
      const left = byX.slice(0, leftCount).sort((a, b) => a.y - b.y);
      const right = byX.slice(leftCount).sort((a, b) => a.y - b.y);

      function placeSide(list, side) {
        if (!list.length) return;
        const available = Math.max(0, h - marginY * 2 - cardH * list.length);
        const gap = list.length > 1 ? Math.max(5, available / (list.length - 1)) : 0;
        let top = list.length === 1 ? (h - cardH) / 2 : marginY;
        list.forEach(({ card }) => {
          const leftPx = side === "left" ? marginX : w - marginX - cardW;
          card.style.left = `${leftPx}px`;
          card.style.right = "auto";
          card.style.top = `${top}px`;
          card.style.width = `${cardW}px`;
          card.style.height = `${cardH}px`;
          card.style.minHeight = `${cardH}px`;
          card.dataset.pfAutoSide = side;
          top += cardH + gap;
        });
      }

      placeSide(left, "left");
      placeSide(right, "right");
      unresolved.forEach((card, index) => {
        card.style.left = `${marginX + index * 8}px`;
        card.style.top = `${marginY + index * 8}px`;
      });
      persistLayout(cards);
      updateLineStarts(cards);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { left: left.length, right: right.length } }));
    }

    function buildPanel() {
      const rail = document.querySelector(".pf-overview-control-rail");
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !nextStage) return;
      stage = nextStage;
      bindStrokeControl();
      applyStyleVars();
      if (panel?.isConnected) return;

      panel = document.createElement("div");
      panel.className = "pf-overview-v2-controls";
      panel.innerHTML = `
        <div class="pf-v2-group pf-v2-locator">
          <span>Anchor</span>
          <select data-v2="anchor" title="Anchor point on PDF text">
            <option value="first-letter">First letter</option>
            <option value="center">Text center</option>
          </select>
        </div>
        <div class="pf-v2-group pf-v2-arrange">
          <span>Arrange</span>
          <select data-v2="left" title="Number of cards on the left"><option value="auto">Auto L/R</option></select>
          <button type="button" data-v2-action="arrange" title="Auto arrange cards and reduce connector crossings">Auto Arrange</button>
          <button type="button" data-v2-action="same" title="Make all cards the same size">Same size</button>
        </div>
        <details class="pf-v2-style">
          <summary>Style</summary>
          <div class="pf-v2-style-popover">
            <div class="pf-v2-style-section"><strong>Card</strong></div>
            <label>Color A <input data-v2="cardA" type="color"></label>
            <label>Color B <input data-v2="cardB" type="color"></label>
            <label class="pf-v2-check"><input data-v2="gradient" type="checkbox"> Gradient</label>
            <div class="pf-v2-style-section"><strong>Connector line</strong></div>
            <label>Color <input data-v2="lineColor" type="color"></label>
            <label>Stroke <input data-v2="lineWidth" type="range" min="1" max="12" step="1"></label>
            <label>Opacity <input data-v2="lineOpacity" type="range" min="0.1" max="1" step="0.05"></label>
            <div class="pf-v2-style-section"><strong>Highlight</strong></div>
            <label>Fill <input data-v2="highlightColor" type="color"></label>
            <label>Fill opacity <input data-v2="highlightOpacity" type="range" min="0" max="0.6" step="0.02"></label>
            <label>Stroke <input data-v2="highlightStrokeColor" type="color"></label>
            <label>Stroke width <input data-v2="highlightWidth" type="range" min="1" max="12" step="1"></label>
            <label>Stroke opacity <input data-v2="highlightStrokeOpacity" type="range" min="0.1" max="1" step="0.05"></label>
            <button type="button" data-v2-action="apply-style">Apply all</button>
            <button type="button" data-v2-action="reset-style">Reset</button>
          </div>
        </details>`;

      const leftSelect = panel.querySelector('[data-v2="left"]');
      const count = Math.max(2, stage.querySelectorAll(".pf-live-sales-callout").length);
      for (let i = 1; i < count; i += 1) {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = `${i}L / ${count - i}R`;
        leftSelect.appendChild(option);
      }

      const keys = ["cardA", "cardB", "lineColor", "lineWidth", "lineOpacity", "highlightColor", "highlightOpacity", "highlightStrokeColor", "highlightWidth", "highlightStrokeOpacity"];
      panel.querySelector('[data-v2="anchor"]').value = settings.anchorMode;
      leftSelect.value = String(settings.leftCount);
      panel.querySelector('[data-v2="gradient"]').checked = Boolean(settings.gradient);
      keys.forEach((key) => {
        const input = panel.querySelector(`[data-v2="${key}"]`);
        if (input) input.value = String(settings[key]);
      });

      panel.addEventListener("change", (event) => {
        const key = event.target?.dataset?.v2;
        if (!key) return;
        if (key === "gradient") settings.gradient = event.target.checked;
        else if (["lineWidth", "lineOpacity", "highlightOpacity", "highlightWidth", "highlightStrokeOpacity"].includes(key)) settings[key] = Number(event.target.value);
        else if (key === "left") settings.leftCount = event.target.value;
        else settings[key] = event.target.value;
        if (key === "lineWidth") settings.highlightWidth = settings.lineWidth;
        if (key === "highlightWidth") settings.lineWidth = settings.highlightWidth;
        saveSettings(settings);
        applyStyleVars();
        if (key === "anchor") window.dispatchEvent(new CustomEvent("pf-overview-anchor-mode-changed", { detail: { mode: settings.anchorMode } }));
      });
      panel.addEventListener("input", (event) => {
        const key = event.target?.dataset?.v2;
        if (!keys.includes(key)) return;
        settings[key] = ["lineWidth", "lineOpacity", "highlightOpacity", "highlightWidth", "highlightStrokeOpacity"].includes(key) ? Number(event.target.value) : event.target.value;
        if (key === "lineWidth" || key === "highlightWidth") {
          settings.lineWidth = Number(event.target.value);
          settings.highlightWidth = Number(event.target.value);
          if (strokeSelect) strokeSelect.value = String(event.target.value);
        }
        applyStyleVars();
      });
      panel.addEventListener("click", (event) => {
        const action = event.target.closest("button[data-v2-action]")?.dataset?.v2Action;
        if (!action) return;
        if (action === "arrange") autoArrange();
        if (action === "same") sameSize(Array.from(stage.querySelectorAll(".pf-live-sales-callout")));
        if (action === "apply-style") { saveSettings(settings); applyStyleVars(); panel.querySelector("details")?.removeAttribute("open"); }
        if (action === "reset-style") {
          settings = { ...DEFAULTS };
          saveSettings(settings);
          applyStyleVars();
          panel.remove(); panel = null; buildPanel();
          window.dispatchEvent(new CustomEvent("pf-overview-anchor-mode-changed", { detail: { mode: settings.anchorMode } }));
        }
      });

      rail.appendChild(panel);
    }

    const sync = () => {
      if (disposed) return;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) { stage = nextStage; panel?.remove(); panel = null; }
      buildPanel();
      bindStrokeControl();
    };

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", sync);
    window.addEventListener("resize", sync);

    return () => {
      disposed = true;
      observer?.disconnect();
      strokeSelect?.removeEventListener("change", onToolbarStroke);
      window.removeEventListener("pf-overview-live-units-ready", sync);
      window.removeEventListener("resize", sync);
      panel?.remove();
    };
  }, []);

  return null;
}
