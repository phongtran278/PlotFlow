import { useEffect } from "react";
import "./OverviewSimplifiedRuntime.css";

const SETTINGS_KEY = "phongflow-overview-v2-settings";

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

export default function OverviewSimplifiedRuntime() {
  useEffect(() => {
    let stage = null;
    let installRaf = 0;
    let installAttempts = 0;
    let control = null;
    let previewStyle = null;

    function triggerAutoArrange() {
      window.dispatchEvent(new CustomEvent("pf-overview-arrange-preview-request"));
    }

    function install() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const rail = document.querySelector(".pf-overview-control-rail");
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      if (!stage || !rail || !toolbar) return;

      toolbar.querySelector('[data-tool="line"]')?.remove();
      toolbar.querySelectorAll(".pf-overview-markup-layer line").forEach((node) => node.remove());

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
            <button type="button" data-card-action="arrange" title="Preview and arrange cards">Arrange</button>
          </div>
          <div class="pf-connector-style-control">
            <span>All connectors</span>
            <div class="pf-connector-style-fields">
              <label title="Connector thickness"><select data-connector="width">
                <option value="0.25">0.25</option><option value="0.5">0.5</option><option value="0.75">0.75</option>
                <option value="1">1</option><option value="1.25">1.25</option><option value="1.5">1.5</option><option value="2">2</option><option value="3">3</option>
                <option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option>
              </select></label>
              <label class="pf-connector-color" title="Connector color"><span class="pf-connector-color-label">Color</span><span class="pf-connector-color-swatch" data-connector-color-swatch></span><input data-connector="color" type="color" aria-label="Connector color"><code data-connector-color-value>#E00000</code></label>
              <label class="pf-connector-opacity" title="Connector opacity"><span>Opacity</span><input data-connector="opacity" type="range" min="0.1" max="1" step="0.05"></label>
            </div>
          </div>`;

        control.querySelector('[data-connector="width"]').value = String(width);
        control.querySelector('[data-connector="color"]').value = color;
        control.querySelector('[data-connector="opacity"]').value = String(opacity);

        const draftConnector = () => {
          const nextWidth = Number(control.querySelector('[data-connector="width"]').value) || 0.5;
          const nextColor = control.querySelector('[data-connector="color"]').value || "#e00000";
          const nextOpacity = Number(control.querySelector('[data-connector="opacity"]').value) || 1;
          const value = control.querySelector("[data-connector-color-value]");
          const swatch = control.querySelector("[data-connector-color-swatch]");
          if (value) value.textContent = nextColor.toUpperCase();
          if (swatch) swatch.style.background = nextColor;
          return { width: nextWidth, color: nextColor, opacity: nextOpacity };
        };
        const previewConnector = () => {
          previewStyle = draftConnector();
          applyConnector(stage, previewStyle.width, previewStyle.color, previewStyle.opacity);
        };
        const persistConnector = () => {
          previewStyle = draftConnector();
          saveConnector(previewStyle);
          applyConnector(stage, previewStyle.width, previewStyle.color, previewStyle.opacity);
        };

        control.addEventListener("input", (event) => {
          if (event.target.closest("[data-connector]")) previewConnector();
        });
        control.addEventListener("change", (event) => {
          if (event.target.closest("[data-connector]")) persistConnector();
        });
        control.addEventListener("click", (event) => {
          if (event.target.closest('[data-card-action="arrange"]')) {
            triggerAutoArrange();
            return;
          }
        });
        rail.appendChild(control);
        previewStyle = { width, color, opacity };
        draftConnector();
        applyConnector(stage, previewStyle.width, previewStyle.color, previewStyle.opacity);
      } else {
        if (!previewStyle) {
          const settings = readSettings();
          previewStyle = {
            width: Number(settings.lineWidth) || 0.5,
            color: settings.lineColor || "#e00000",
            opacity: Number.isFinite(Number(settings.lineOpacity)) ? Number(settings.lineOpacity) : 1,
          };
        }
        applyConnector(stage, previewStyle.width, previewStyle.color, previewStyle.opacity);
      }
    }

    function scheduleInitialInstall() {
      window.cancelAnimationFrame(installRaf);
      installAttempts = 0;
      const run = () => {
        if (control?.isConnected) return;
        install();
        if (control?.isConnected || installAttempts >= 11) return;
        installAttempts += 1;
        installRaf = window.requestAnimationFrame(run);
      };
      installRaf = window.requestAnimationFrame(run);
    }

    const onLiveUnitsReady = () => window.requestAnimationFrame(install);

    scheduleInitialInstall();
    window.addEventListener("pf-overview-live-units-ready", onLiveUnitsReady);
    return () => {
      window.cancelAnimationFrame(installRaf);
      window.removeEventListener("pf-overview-live-units-ready", onLiveUnitsReady);
      control?.remove();
    };
  }, []);

  return null;
}
