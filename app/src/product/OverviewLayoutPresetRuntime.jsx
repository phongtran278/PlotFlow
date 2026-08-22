import { useEffect } from "react";
import "./OverviewLayoutPresetRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const UI_KEY = "phongflow-overview-layout-ui-v1";

function readUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return { size: Number(value.size) || 88, mode: value.mode || "balanced" };
  } catch {
    return { size: 88, mode: "balanced" };
  }
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

function anchorFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-map-anchor")).find((node) =>
    (node.dataset.unitCode || node.textContent?.trim()) === code
  ) || null;
}

function lineFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-callout-lines line")).find((node) => node.dataset.unitCode === code) || null;
}

export default function OverviewLayoutPresetRuntime() {
  useEffect(() => {
    let stage = null;
    let rail = null;
    let control = null;
    let observer = null;
    let ui = readUi();
    const MODES = ["balanced", "left-heavy", "right-heavy", "natural"];
    const LABELS = { balanced: "Balanced", "left-heavy": "Left+", "right-heavy": "Right+", natural: "Natural" };

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    }

    function applySize() {
      if (!stage) return;
      stage.style.setProperty("--pf-sell-card-scale", String(ui.size / 100));
      cards().forEach((card) => {
        card.style.width = "";
        card.style.height = "";
        card.style.minHeight = "";
      });
    }

    function persistLayout() {
      if (!stage) return;
      const layout = {};
      cards().forEach((card) => {
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

    function updateConnectors() {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      cards().forEach((card) => {
        const code = codeFor(card);
        const line = lineFor(stage, code);
        const anchor = anchorFor(stage, code);
        if (!line || !anchor) return;
        line.setAttribute("x1", String(((card.offsetLeft + card.offsetWidth / 2) / w) * 100));
        line.setAttribute("y1", String(((card.offsetTop + card.offsetHeight / 2) / h) * 100));
        line.setAttribute("x2", String(Number.parseFloat(anchor.style.left || "50")));
        line.setAttribute("y2", String(Number.parseFloat(anchor.style.top || "50")));
      });
    }

    function splitCount(items) {
      const n = items.length;
      if (n < 2) return n;
      if (ui.mode === "left-heavy") return Math.min(n - 1, Math.ceil(n * 0.62));
      if (ui.mode === "right-heavy") return Math.max(1, Math.floor(n * 0.38));
      if (ui.mode === "natural") {
        const natural = items.filter((item) => item.x <= 50).length;
        return Math.max(1, Math.min(n - 1, natural || Math.ceil(n / 2)));
      }
      return Math.ceil(n / 2);
    }

    function arrange() {
      if (!stage) return;
      applySize();
      const all = cards();
      if (!all.length) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const items = all.map((card) => {
        const code = codeFor(card);
        const anchor = anchorFor(stage, code);
        return {
          card,
          code,
          anchor,
          x: Number.parseFloat(anchor?.style.left || "50"),
          y: Number.parseFloat(anchor?.style.top || "50"),
        };
      });
      const ordered = [...items].sort((a, b) => a.x - b.x);
      const leftCount = splitCount(ordered);
      const left = ordered.slice(0, leftCount).sort((a, b) => a.y - b.y);
      const right = ordered.slice(leftCount).sort((a, b) => a.y - b.y);

      // Keep cards clearly inside the PDF composition rather than hugging the stage edge.
      const insetX = Math.max(34, Math.round(w * 0.055));
      const insetY = Math.max(20, Math.round(h * 0.035));
      const sampleW = all[0].offsetWidth || 190;

      function place(list, side) {
        if (!list.length) return;
        const heights = list.map(({ card }) => card.offsetHeight || 220);
        const total = heights.reduce((sum, value) => sum + value, 0);
        const gap = list.length > 1 ? Math.max(8, (h - insetY * 2 - total) / (list.length - 1)) : 0;
        let top = list.length === 1 ? (h - heights[0]) / 2 : insetY;
        list.forEach(({ card }, index) => {
          const cardW = card.offsetWidth || sampleW;
          const leftPx = side === "left" ? insetX : Math.max(insetX, w - insetX - cardW);
          card.style.left = `${leftPx}px`;
          card.style.right = "auto";
          card.style.top = `${top}px`;
          card.dataset.pfAutoSide = side;
          top += heights[index] + gap;
        });
      }

      place(left, "left");
      place(right, "right");
      persistLayout();
      updateConnectors();
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { left: left.length, right: right.length, mode: ui.mode } }));
    }

    function cycleLayout() {
      const index = MODES.indexOf(ui.mode);
      ui.mode = MODES[(index + 1) % MODES.length];
      const button = control?.querySelector('[data-layout-ui="cycle"]');
      if (button) button.textContent = `Layout · ${LABELS[ui.mode]}`;
      arrange();
    }

    function installExportMenu() {
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      if (!toolbar || toolbar.querySelector(".pf-export-menu")) return;
      const png = toolbar.querySelector('[data-action="png"]');
      const pdf = toolbar.querySelector('[data-action="pdf"]');
      if (!png || !pdf) return;
      png.hidden = true;
      pdf.hidden = true;
      const wrap = document.createElement("details");
      wrap.className = "pf-export-menu";
      wrap.innerHTML = `<summary>Export</summary><div><button type="button" data-export="png">PNG image</button><button type="button" data-export="pdf">PDF</button></div>`;
      wrap.addEventListener("click", (event) => {
        const action = event.target.closest("button[data-export]")?.dataset?.export;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        (action === "png" ? png : pdf).click();
        wrap.removeAttribute("open");
      });
      png.before(wrap);
    }

    function install() {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const nextRail = document.querySelector(".pf-overview-control-rail");
      if (!nextStage || !nextRail) return;
      stage = nextStage;
      rail = nextRail;
      applySize();
      installExportMenu();

      // The older arrange group is superseded by the compact layout control.
      document.querySelector(".pf-v2-arrange")?.classList.add("pf-v2-arrange-superseded");

      if (!control?.isConnected) {
        control = document.createElement("div");
        control.className = "pf-card-layout-control";
        control.innerHTML = `
          <label><span>Card size</span><input data-layout-ui="size" type="range" min="68" max="118" step="2"><output></output></label>
          <button type="button" data-layout-ui="cycle">Layout · ${LABELS[ui.mode]}</button>`;
        const input = control.querySelector('[data-layout-ui="size"]');
        const output = control.querySelector("output");
        input.value = String(ui.size);
        output.textContent = `${ui.size}%`;
        input.addEventListener("input", () => {
          ui.size = Number(input.value) || 88;
          output.textContent = `${ui.size}%`;
          applySize();
          persistLayout();
          updateConnectors();
          localStorage.setItem(UI_KEY, JSON.stringify(ui));
        });
        control.querySelector('[data-layout-ui="cycle"]').addEventListener("click", cycleLayout);
        rail.appendChild(control);
      }
    }

    install();
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", install);
    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", install);
      control?.remove();
    };
  }, []);

  return null;
}
