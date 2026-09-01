import { useEffect } from "react";
import "./OverviewSimplifiedRuntime.css";

const SETTINGS_KEY = "phongflow-overview-v2-settings";
const LEGACY_MARKUP_KEY = "phongflow-overview-markup-v2";
const PEN_KEY = "phongflow-overview-pen-shapes-v1";

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
    line.style.setProperty("--pf-line-base-opacity", String(opacity));
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

export default function OverviewSimplifiedRuntime() {
  useEffect(() => {
    let observer = null;
    let stage = null;
    let control = null;

    function triggerAutoArrange() {
      const button = document.querySelector('.pf-overview-v2-controls [data-v2-action="arrange"]');
      button?.click();
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

        control = document.createElement("div");
        control.className = "pf-connector-control";
        control.innerHTML = `
          <div class="pf-card-layout-control">
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

        control.addEventListener("input", (event) => {
          if (event.target.closest("[data-connector]")) syncConnector();
        });
        control.addEventListener("change", (event) => {
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
      } else {
        const settings = readSettings();
        applyConnector(stage, Number(settings.lineWidth) || 0.5, settings.lineColor || "#e00000", Number.isFinite(Number(settings.lineOpacity)) ? Number(settings.lineOpacity) : 1);
      }
    }

    const onOverviewChanged = () => window.setTimeout(install, 0);

    install();
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", onOverviewChanged);
    window.addEventListener("pf-overview-group-changed", onOverviewChanged);
    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", onOverviewChanged);
      window.removeEventListener("pf-overview-group-changed", onOverviewChanged);
      control?.remove();
    };
  }, []);

  return null;
}
