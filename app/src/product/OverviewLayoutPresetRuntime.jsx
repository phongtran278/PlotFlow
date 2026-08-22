import { useEffect } from "react";
import "./OverviewLayoutPresetRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const UI_KEY = "phongflow-overview-layout-ui-v1";

function readUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return { size: Number(value.size) || 88 };
  } catch {
    return { size: 88 };
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
    let disposed = false;
    let retryRaf = 0;
    let retryCount = 0;
    const ui = readUi();

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    }

    function px(base, factor, min = 0) {
      return `${Math.max(min, base * factor).toFixed(2)}px`;
    }

    function applySize() {
      if (!stage) return;
      const factor = Math.max(0.45, Math.min(1.15, Number(ui.size || 88) / 100));
      stage.style.setProperty("--pf-sell-card-width", px(218, factor, 98));
      stage.style.setProperty("--pf-sell-card-pad-y", px(10, factor, 4.5));
      stage.style.setProperty("--pf-sell-card-pad-x", px(11, factor, 5));
      stage.style.setProperty("--pf-sell-card-radius", px(17, factor, 8));
      stage.style.setProperty("--pf-sell-code-size", px(34, factor, 15));
      stage.style.setProperty("--pf-sell-code-gap", px(8, factor, 3));
      stage.style.setProperty("--pf-sell-spec-size", px(10.2, factor, 5));
      stage.style.setProperty("--pf-sell-spec-gap", px(2.4, factor, 1));
      stage.style.setProperty("--pf-sell-spec-bottom", px(8, factor, 3));
      stage.style.setProperty("--pf-sell-price-pad-y", px(8.5, factor, 4));
      stage.style.setProperty("--pf-sell-price-pad-x", px(8, factor, 4));
      stage.style.setProperty("--pf-sell-price-radius", px(12, factor, 6));
      stage.style.setProperty("--pf-sell-price-label-size", px(9.3, factor, 4.8));
      stage.style.setProperty("--pf-sell-price-size", px(27.5, factor, 13));
      stage.style.setProperty("--pf-sell-price-gap", px(4, factor, 1.5));
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

    function connectorStart(card, anchor, w, h) {
      const left = card.offsetLeft;
      const top = card.offsetTop;
      const right = left + card.offsetWidth;
      const bottom = top + card.offsetHeight;
      const cx = left + card.offsetWidth / 2;
      const cy = top + card.offsetHeight / 2;
      const ax = (Number.parseFloat(anchor?.style.left || "50") / 100) * w;
      const ay = (Number.parseFloat(anchor?.style.top || "50") / 100) * h;
      const candidates = [
        { x: left, y: cy, d: Math.abs(ax - left) },
        { x: right, y: cy, d: Math.abs(ax - right) },
        { x: cx, y: top, d: Math.abs(ay - top) },
        { x: cx, y: bottom, d: Math.abs(ay - bottom) },
      ];
      return candidates.sort((a, b) => a.d - b.d)[0];
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
        const start = connectorStart(card, anchor, w, h);
        line.setAttribute("x1", String((start.x / w) * 100));
        line.setAttribute("y1", String((start.y / h) * 100));
        line.setAttribute("x2", String(Number.parseFloat(anchor.style.left || "50")));
        line.setAttribute("y2", String(Number.parseFloat(anchor.style.top || "50")));
      });
    }

    function tidy() {
      if (!stage) return;
      applySize();
      const all = cards();
      if (!all.length) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const middle = w / 2;
      const insetX = Math.max(34, Math.round(w * 0.055));
      const insetY = Math.max(20, Math.round(h * 0.035));

      const left = [];
      const right = [];
      all.forEach((card) => {
        const bucket = card.offsetLeft + card.offsetWidth / 2 <= middle ? left : right;
        bucket.push(card);
      });
      left.sort((a, b) => a.offsetTop - b.offsetTop);
      right.sort((a, b) => a.offsetTop - b.offsetTop);

      function place(list, side) {
        if (!list.length) return;
        const heights = list.map((card) => card.offsetHeight || 180);
        const total = heights.reduce((sum, value) => sum + value, 0);
        const available = Math.max(0, h - insetY * 2 - total);
        const gap = list.length > 1 ? Math.max(8, available / (list.length - 1)) : 0;
        let top = list.length === 1 ? Math.max(insetY, (h - heights[0]) / 2) : insetY;
        list.forEach((card, index) => {
          const leftPx = side === "left" ? insetX : Math.max(insetX, w - insetX - card.offsetWidth);
          card.style.left = `${leftPx}px`;
          card.style.right = "auto";
          card.style.top = `${top}px`;
          top += heights[index] + gap;
        });
      }

      place(left, "left");
      place(right, "right");
      persistLayout();
      updateConnectors();
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { left: left.length, right: right.length, mode: "keep-sides" } }));
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
      if (disposed) return true;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const nextRail = document.querySelector(".pf-overview-control-rail");
      if (!nextStage || !nextRail) return false;
      stage = nextStage;
      rail = nextRail;
      applySize();
      installExportMenu();
      document.querySelector(".pf-v2-arrange")?.classList.add("pf-v2-arrange-superseded");

      if (!control?.isConnected) {
        control = document.createElement("div");
        control.className = "pf-card-layout-control";
        control.innerHTML = `
          <label><span>Card size</span><input data-layout-ui="size" type="range" min="45" max="115" step="1"><output></output></label>
          <button type="button" data-layout-ui="tidy" title="Giữ card ở bên trái/phải hiện tại, chỉ căn thẳng và giãn đều">Tidy</button>`;
        const input = control.querySelector('[data-layout-ui="size"]');
        const output = control.querySelector("output");
        input.value = String(Math.max(45, Math.min(115, ui.size)));
        output.textContent = `${input.value}%`;
        input.addEventListener("input", () => {
          ui.size = Number(input.value) || 88;
          output.textContent = `${ui.size}%`;
          applySize();
          updateConnectors();
          localStorage.setItem(UI_KEY, JSON.stringify(ui));
        });
        input.addEventListener("change", persistLayout);
        control.querySelector('[data-layout-ui="tidy"]').addEventListener("click", tidy);
        rail.appendChild(control);
      }
      updateConnectors();
      return true;
    }

    function installWithRetry() {
      cancelAnimationFrame(retryRaf);
      retryCount = 0;
      const attempt = () => {
        if (disposed || install()) return;
        retryCount += 1;
        if (retryCount < 45) retryRaf = requestAnimationFrame(attempt);
      };
      attempt();
    }

    installWithRetry();
    window.addEventListener("pf-overview-live-units-ready", installWithRetry);
    window.addEventListener("pf-overview-auto-arranged", updateConnectors);
    window.addEventListener("resize", updateConnectors);

    return () => {
      disposed = true;
      cancelAnimationFrame(retryRaf);
      window.removeEventListener("pf-overview-live-units-ready", installWithRetry);
      window.removeEventListener("pf-overview-auto-arranged", updateConnectors);
      window.removeEventListener("resize", updateConnectors);
      control?.remove();
    };
  }, []);

  return null;
}
