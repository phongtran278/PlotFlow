import { useEffect } from "react";
import "./OverviewLayoutPresetRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const UI_KEY = "phongflow-overview-layout-ui-v2";

function readUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return {
      size: Math.max(45, Math.min(115, Number(value.size) || 82)),
      leftCount: value.leftCount === "auto" ? "auto" : Number(value.leftCount) || "auto",
      pngScale: Number(value.pngScale) || 3,
    };
  } catch {
    return { size: 82, leftCount: "auto", pngScale: 3 };
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

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    }

    function saveUi() {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    }

    function applySize() {
      if (!stage) return;
      const scale = ui.size / 100;
      stage.style.setProperty("--pf-sell-card-scale", String(scale));
      stage.dataset.pfCardSize = String(ui.size);
      cards().forEach((card) => {
        card.style.setProperty("--pf-card-user-scale", String(scale));
        card.style.width = "";
        card.style.height = "";
        card.style.minHeight = "";
      });
      requestAnimationFrame(updateConnectors);
    }

    function persistLayout() {
      if (!stage) return;
      let layout = {};
      try { layout = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}") || {}; } catch { layout = {}; }
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

    function connectorStart(card, anchorX) {
      const w = stage?.clientWidth || 1;
      const h = stage?.clientHeight || 1;
      const left = card.offsetLeft;
      const top = card.offsetTop;
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      const centerX = ((left + cardW / 2) / w) * 100;
      const centerY = ((top + cardH / 2) / h) * 100;
      const useRightEdge = anchorX >= centerX;
      return {
        x: ((useRightEdge ? left + cardW : left) / w) * 100,
        y: centerY,
      };
    }

    function updateConnectors() {
      if (!stage) return;
      cards().forEach((card) => {
        const code = codeFor(card);
        const line = lineFor(stage, code);
        const anchor = anchorFor(stage, code);
        if (!line || !anchor) return;
        const anchorX = Number.parseFloat(anchor.style.left || "50");
        const anchorY = Number.parseFloat(anchor.style.top || "50");
        const start = connectorStart(card, anchorX);
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(anchorX));
        line.setAttribute("y2", String(anchorY));
      });
    }

    function leftCountFor(items) {
      const n = items.length;
      if (n < 2) return n;
      if (ui.leftCount !== "auto") return Math.max(1, Math.min(n - 1, Number(ui.leftCount) || Math.ceil(n / 2)));
      const natural = items.filter((item) => item.x <= 50).length;
      return Math.max(1, Math.min(n - 1, natural || Math.ceil(n / 2)));
    }

    function tidy() {
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

      // User chooses only the left/right split. Within each side we preserve visual order by lot Y,
      // then the app does the boring work: equal spacing + straight columns + clean connectors.
      const ordered = [...items].sort((a, b) => a.x - b.x);
      const leftCount = leftCountFor(ordered);
      const left = ordered.slice(0, leftCount).sort((a, b) => a.y - b.y);
      const right = ordered.slice(leftCount).sort((a, b) => a.y - b.y);
      const insetX = Math.max(46, Math.round(w * 0.065));
      const insetY = Math.max(20, Math.round(h * 0.035));

      function place(list, side) {
        if (!list.length) return;
        const heights = list.map(({ card }) => card.offsetHeight || 180);
        const total = heights.reduce((sum, value) => sum + value, 0);
        const available = Math.max(0, h - insetY * 2 - total);
        const gap = list.length > 1 ? Math.max(7, available / (list.length - 1)) : 0;
        let top = list.length === 1 ? Math.max(insetY, (h - heights[0]) / 2) : insetY;
        list.forEach(({ card }, index) => {
          const cardW = card.offsetWidth || 176;
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
      saveUi();
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { left: left.length, right: right.length, mode: "user-split" } }));
    }

    function populateSplit(select) {
      const n = cards().length;
      const current = String(ui.leftCount);
      select.innerHTML = `<option value="auto">Auto split</option>`;
      for (let left = 1; left < n; left += 1) {
        const option = document.createElement("option");
        option.value = String(left);
        option.textContent = `${left} left · ${n - left} right`;
        select.appendChild(option);
      }
      select.value = Array.from(select.options).some((option) => option.value === current) ? current : "auto";
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
      wrap.innerHTML = `<summary>Export</summary><div>
        <label class="pf-export-resolution"><span>PNG resolution</span><select data-export-scale><option value="1">1× · screen</option><option value="2">2×</option><option value="3">3× · high</option><option value="4">4× · max</option></select><small data-export-pixels></small></label>
        <button type="button" data-export="png">Export PNG</button>
        <button type="button" data-export="pdf">Export PDF</button>
      </div>`;
      const scaleSelect = wrap.querySelector("[data-export-scale]");
      const pixels = wrap.querySelector("[data-export-pixels]");
      scaleSelect.value = String(ui.pngScale);
      const syncPixels = () => {
        ui.pngScale = Number(scaleSelect.value) || 3;
        saveUi();
        const width = Math.round((stage?.clientWidth || 0) * ui.pngScale);
        const height = Math.round((stage?.clientHeight || 0) * ui.pngScale);
        pixels.textContent = width && height ? `${width.toLocaleString()} × ${height.toLocaleString()} px` : "";
        window.__PLOTFLOW_OVERVIEW_PNG_SCALE__ = ui.pngScale;
      };
      scaleSelect.addEventListener("change", syncPixels);
      syncPixels();
      wrap.addEventListener("click", (event) => {
        const action = event.target.closest("button[data-export]")?.dataset?.export;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        syncPixels();
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
      document.querySelector(".pf-v2-arrange")?.classList.add("pf-v2-arrange-superseded");

      if (!control?.isConnected) {
        control = document.createElement("div");
        control.className = "pf-card-layout-control";
        control.innerHTML = `
          <label class="pf-card-size-control"><span>Card</span><input data-layout-ui="size" type="range" min="45" max="115" step="1"><output></output></label>
          <div class="pf-layout-mini-nav"><span>Layout</span><select data-layout-ui="split"></select><button type="button" data-layout-ui="tidy">Tidy</button></div>`;
        const input = control.querySelector('[data-layout-ui="size"]');
        const output = control.querySelector("output");
        const split = control.querySelector('[data-layout-ui="split"]');
        input.value = String(ui.size);
        output.textContent = `${ui.size}%`;
        populateSplit(split);
        input.addEventListener("input", () => {
          ui.size = Math.max(45, Math.min(115, Number(input.value) || 82));
          output.textContent = `${ui.size}%`;
          applySize();
          saveUi();
        });
        input.addEventListener("change", () => { persistLayout(); updateConnectors(); });
        split.addEventListener("change", () => {
          ui.leftCount = split.value === "auto" ? "auto" : Number(split.value);
          saveUi();
          tidy();
        });
        control.querySelector('[data-layout-ui="tidy"]').addEventListener("click", tidy);
        rail.appendChild(control);
      } else {
        populateSplit(control.querySelector('[data-layout-ui="split"]'));
      }
    }

    install();
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", install);
    window.addEventListener("pf-overview-auto-arranged", updateConnectors);
    window.addEventListener("resize", updateConnectors);
    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", install);
      window.removeEventListener("pf-overview-auto-arranged", updateConnectors);
      window.removeEventListener("resize", updateConnectors);
      control?.remove();
    };
  }, []);

  return null;
}
