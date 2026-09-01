import { useEffect } from "react";
import "./OverviewSimplifiedRuntime.css";

const SETTINGS_KEY = "phongflow-overview-v2-settings";
const LEGACY_MARKUP_KEY = "phongflow-overview-markup-v2";
const PEN_KEY = "phongflow-overview-pen-shapes-v1";
const CARD_SIZE_KEY = "plotflow-overview-card-size-v2";
const LEGACY_CARD_SIZE_KEY = "plotflow-overview-card-size-v1";
const DEFAULT_CARD_WIDTH = 160;
const MIN_CARD_WIDTH = 132;
const MAX_CARD_WIDTH = 260;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function saveConnector({ width, color, opacity }) {
  const next = { ...readSettings(), lineWidth: width, lineColor: color, lineOpacity: opacity };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function applyConnector(stage, width, color, opacity) {
  if (!stage) return;
  stage.style.setProperty("--pf-connector-width", String(width));
  stage.style.setProperty("--pf-connector-color", color);
  stage.style.setProperty("--pf-connector-opacity", String(opacity));
  stage.querySelectorAll(".pf-live-callout-lines line").forEach((line) => {
    line.style.setProperty("stroke", color, "important");
    line.style.setProperty("stroke-width", String(width), "important");
    line.style.setProperty("stroke-opacity", String(opacity), "important");
  });
}

function clearLegacyFreehandLines() {
  try {
    const items = JSON.parse(localStorage.getItem(LEGACY_MARKUP_KEY) || "[]");
    if (Array.isArray(items)) {
      localStorage.setItem(LEGACY_MARKUP_KEY, JSON.stringify(items.filter((item) => item?.type !== "line")));
    }
  } catch { /* noop */ }
}

function readCardSizes() {
  try {
    const value = JSON.parse(localStorage.getItem(CARD_SIZE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function groupKey(stage) {
  return String(stage?.dataset?.overviewGroup || "default").trim() || "default";
}

function legacyWidth(stage) {
  try {
    const values = JSON.parse(localStorage.getItem(LEGACY_CARD_SIZE_KEY) || "{}");
    const preset = values?.[groupKey(stage)];
    if (preset === "compact") return 168;
    if (preset === "large") return 220;
    if (preset === "standard") return 192;
  } catch { /* noop */ }
  return DEFAULT_CARD_WIDTH;
}

function savedCardWidth(stage) {
  const value = Number(readCardSizes()[groupKey(stage)]);
  return Number.isFinite(value) ? clamp(value, MIN_CARD_WIDTH, MAX_CARD_WIDTH) : legacyWidth(stage);
}

function saveCardWidth(stage, width) {
  const next = readCardSizes();
  next[groupKey(stage)] = clamp(width, MIN_CARD_WIDTH, MAX_CARD_WIDTH);
  localStorage.setItem(CARD_SIZE_KEY, JSON.stringify(next));
}

function applyCardWidth(stage, width = DEFAULT_CARD_WIDTH) {
  if (!stage) return;
  const resolved = clamp(width, MIN_CARD_WIDTH, MAX_CARD_WIDTH);
  const contentScale = clamp(resolved / 192, 0.78, 1.18);
  stage.querySelectorAll(".pf-live-sales-callout").forEach((card) => {
    card.style.setProperty("--pf-card-width", `${resolved}px`);
    card.style.setProperty("--pf-card-height", "auto");
    card.style.setProperty("--pf-card-content-scale", String(contentScale));
    card.style.removeProperty("min-height");
  });
  window.dispatchEvent(new CustomEvent("pf-overview-all-card-size", {
    detail: { width: resolved, scale: contentScale },
  }));
  window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", {
    detail: { width: resolved, scale: contentScale },
  }));
}

function triggerAutoArrange() {
  const button = document.querySelector('.pf-overview-v2-controls [data-v2-action="arrange"]');
  button?.click();
}

export default function OverviewSimplifiedRuntime() {
  useEffect(() => {
    let observer = null;
    let stage = null;
    let control = null;

    function syncCardWidth() {
      if (!stage) return;
      const width = savedCardWidth(stage);
      const slider = control?.querySelector('[data-card-size="range"]');
      const number = control?.querySelector('[data-card-size="number"]');
      if (slider) slider.value = String(width);
      if (number) number.value = String(width);
      applyCardWidth(stage, width);
    }

    function install() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const rail = document.querySelector(".pf-overview-control-rail");
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      if (!stage || !rail || !toolbar) return;

      toolbar.querySelector('[data-tool="line"]')?.remove();
      toolbar.querySelectorAll(".pf-overview-markup-layer line").forEach((node) => node.remove());
      clearLegacyFreehandLines();

      const oldStroke = toolbar.querySelector(".pf-stroke-control");
      if (oldStroke) oldStroke.style.display = "none";

      if (!control?.isConnected) {
        const settings = readSettings();
        const width = Number(settings.lineWidth) || 0.5;
        const color = settings.lineColor || "#e00000";
        const opacity = Number.isFinite(Number(settings.lineOpacity)) ? Number(settings.lineOpacity) : 1;
        const cardWidth = savedCardWidth(stage);

        control = document.createElement("div");
        control.className = "pf-connector-control";
        control.innerHTML = `
          <div class="pf-card-layout-control">
            <span>Card W</span>
            <label class="pf-card-width-slider" title="Resize every card in this group">
              <input data-card-size="range" type="range" min="${MIN_CARD_WIDTH}" max="${MAX_CARD_WIDTH}" step="2" value="${cardWidth}">
            </label>
            <label class="pf-card-width-number" title="Card width in pixels">
              <input data-card-size="number" type="number" min="${MIN_CARD_WIDTH}" max="${MAX_CARD_WIDTH}" step="2" value="${cardWidth}">
              <em>px</em>
            </label>
            <button type="button" data-card-action="arrange" title="Arrange cards automatically">Arrange</button>
          </div>
          <div class="pf-connector-style-control">
            <span>Connector</span>
            <label title="Connector thickness"><select data-connector="width">
              <option value="0.25">0.25</option><option value="0.5">0.5</option><option value="0.75">0.75</option>
              <option value="1">1</option><option value="1.25">1.25</option><option value="1.5">1.5</option><option value="2">2</option><option value="3">3</option>
            </select></label>
            <label class="pf-connector-color" title="Connector color"><input data-connector="color" type="color"></label>
            <label class="pf-connector-opacity" title="Connector opacity"><span>Opacity</span><input data-connector="opacity" type="range" min="0.1" max="1" step="0.05"></label>
            <button type="button" data-connector-action="clear" title="Remove every rectangle and pen highlight">Clear highlights</button>
          </div>`;

        control.querySelector('[data-connector="width"]').value = String(width);
        control.querySelector('[data-connector="color"]').value = color;
        control.querySelector('[data-connector="opacity"]').value = String(opacity);

        const syncConnector = () => {
          const nextWidth = Number(control.querySelector('[data-connector="width"]').value) || 0.5;
          const nextColor = control.querySelector('[data-connector="color"]').value || "#e00000";
          const nextOpacity = Number(control.querySelector('[data-connector="opacity"]').value) || 1;
          saveConnector({ width: nextWidth, color: nextColor, opacity: nextOpacity });
          applyConnector(stage, nextWidth, nextColor, nextOpacity);
        };

        const syncWidthInputs = (source) => {
          const nextWidth = clamp(source.value, MIN_CARD_WIDTH, MAX_CARD_WIDTH);
          const slider = control.querySelector('[data-card-size="range"]');
          const number = control.querySelector('[data-card-size="number"]');
          slider.value = String(nextWidth);
          number.value = String(nextWidth);
          saveCardWidth(stage, nextWidth);
          applyCardWidth(stage, nextWidth);
        };

        control.addEventListener("input", (event) => {
          const sizeInput = event.target.closest('[data-card-size="range"],[data-card-size="number"]');
          if (sizeInput) {
            syncWidthInputs(sizeInput);
            return;
          }
          if (event.target.closest("[data-connector]")) syncConnector();
        });
        control.addEventListener("change", (event) => {
          const sizeInput = event.target.closest('[data-card-size="range"],[data-card-size="number"]');
          if (sizeInput) {
            syncWidthInputs(sizeInput);
            return;
          }
          if (event.target.closest("[data-connector]")) syncConnector();
        });
        control.addEventListener("click", (event) => {
          if (event.target.closest('[data-card-action="arrange"]')) {
            triggerAutoArrange();
            return;
          }
          if (!event.target.closest('[data-connector-action="clear"]')) return;
          localStorage.setItem(LEGACY_MARKUP_KEY, "[]");
          localStorage.setItem(PEN_KEY, "[]");
          stage.querySelectorAll(".pf-overview-markup-layer rect,.pf-overview-markup-layer line,.pf-overview-pen-layer polygon,.pf-overview-pen-layer polyline,.pf-overview-pen-layer circle").forEach((node) => node.remove());
          window.dispatchEvent(new CustomEvent("pf-overview-clear-highlights"));
        });
        rail.appendChild(control);
        syncConnector();
        applyCardWidth(stage, cardWidth);
      } else {
        const settings = readSettings();
        applyConnector(stage, Number(settings.lineWidth) || 0.5, settings.lineColor || "#e00000", Number.isFinite(Number(settings.lineOpacity)) ? Number(settings.lineOpacity) : 1);
        syncCardWidth();
      }
    }

    const onGroupChanged = () => window.setTimeout(() => {
      install();
      syncCardWidth();
    }, 0);
    const onUnitsReady = () => {
      install();
      syncCardWidth();
    };

    install();
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", onUnitsReady);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", onUnitsReady);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      control?.remove();
    };
  }, []);

  return null;
}
