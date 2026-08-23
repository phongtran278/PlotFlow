import { useEffect } from "react";
import "./OverviewLayoutPresetRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const UI_KEY = "phongflow-overview-layout-ui-v1";

function readUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return {
      size: Number(value.size) || 88,
      spacing: Number(value.spacing) || 100,
      map: value.map && typeof value.map === "object" ? value.map : {},
      columns: value.columns && typeof value.columns === "object" ? value.columns : {},
    };
  } catch {
    return { size: 88, spacing: 100, map: {}, columns: {} };
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function median(values, fallback) {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return fallback;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

export default function OverviewLayoutPresetRuntime() {
  useEffect(() => {
    let stage = null;
    let rail = null;
    let control = null;
    let disposed = false;
    let retryRaf = 0;
    let retryCount = 0;
    let mapCanvas = null;
    let mapDrag = null;
    const ui = readUi();

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    }

    function px(base, factor, min = 0) {
      return `${Math.max(min, base * factor).toFixed(2)}px`;
    }

    function saveUi() {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
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

    function cardSide(card, w) {
      return card.offsetLeft + card.offsetWidth / 2 <= w / 2 ? "left" : "right";
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
        const side = cardSide(card, w);
        const x = side === "left" ? card.offsetLeft + card.offsetWidth : card.offsetLeft;
        const y = card.offsetTop + card.offsetHeight / 2;
        line.setAttribute("x1", String((x / w) * 100));
        line.setAttribute("y1", String((y / h) * 100));
        line.setAttribute("x2", String(Number.parseFloat(anchor.style.left || "50")));
        line.setAttribute("y2", String(Number.parseFloat(anchor.style.top || "50")));
      });
    }

    function captureMapFromCanvas(force = false) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const leftCenters = [];
      const rightCenters = [];
      cards().forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        const x = clamp((card.offsetLeft + card.offsetWidth / 2) / w, 0.04, 0.96);
        const y = clamp((card.offsetTop + card.offsetHeight / 2) / h, 0.04, 0.96);
        if (force || !ui.map[code]) ui.map[code] = { x, y };
        (x <= 0.5 ? leftCenters : rightCenters).push(x);
      });
      if (force || !Number.isFinite(ui.columns.left)) ui.columns.left = median(leftCenters, 0.14);
      if (force || !Number.isFinite(ui.columns.right)) ui.columns.right = median(rightCenters, 0.86);
      ui.columns.left = clamp(ui.columns.left, 0.06, 0.44);
      ui.columns.right = clamp(ui.columns.right, 0.56, 0.94);
      saveUi();
    }

    function mapAnchorPoint(code) {
      const anchor = anchorFor(stage, code);
      return {
        x: clamp(Number.parseFloat(anchor?.style.left || "50") / 100, 0.02, 0.98),
        y: clamp(Number.parseFloat(anchor?.style.top || "50") / 100, 0.02, 0.98),
      };
    }

    function cardForCode(code) {
      return cards().find((card) => codeFor(card) === code) || null;
    }

    function applyMapPoint(code, x, y) {
      if (!stage) return;
      const card = cardForCode(code);
      if (!card) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const left = clamp(x * w - card.offsetWidth / 2, 8, Math.max(8, w - card.offsetWidth - 8));
      const top = clamp(y * h - card.offsetHeight / 2, 8, Math.max(8, h - card.offsetHeight - 8));
      card.style.left = `${left}px`;
      card.style.right = "auto";
      card.style.top = `${top}px`;
      ui.map[code] = {
        x: clamp((left + card.offsetWidth / 2) / w, 0.04, 0.96),
        y: clamp((top + card.offsetHeight / 2) / h, 0.04, 0.96),
      };
    }

    function applyColumn(side, centerX) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      cards().forEach((card) => {
        if (cardSide(card, w) !== side) return;
        const code = codeFor(card);
        const y = clamp((card.offsetTop + card.offsetHeight / 2) / h, 0.04, 0.96);
        applyMapPoint(code, centerX, y);
      });
      updateConnectors();
    }

    function renderLayoutMap() {
      if (!mapCanvas || !stage) return;
      captureMapFromCanvas(false);
      mapCanvas.innerHTML = "";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.classList.add("pf-layout-map-lines");
      mapCanvas.appendChild(svg);

      ["left", "right"].forEach((side) => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = `pf-layout-column-handle ${side}`;
        handle.dataset.column = side;
        handle.style.left = `${ui.columns[side] * 100}%`;
        handle.innerHTML = `<i></i><span>${side === "left" ? "L" : "R"}</span>`;
        handle.title = `Kéo cột ${side === "left" ? "trái" : "phải"} vào / ra`;
        handle.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          mapDrag = { type: "column", side, pointerId: event.pointerId, node: handle };
          handle.setPointerCapture?.(event.pointerId);
        });
        mapCanvas.appendChild(handle);
      });

      cards().forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        const point = ui.map[code] || { x: 0.5, y: 0.5 };
        const anchor = mapAnchorPoint(code);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.dataset.code = code;
        line.setAttribute("x1", String(point.x * 100));
        line.setAttribute("y1", String(point.y * 100));
        line.setAttribute("x2", String(anchor.x * 100));
        line.setAttribute("y2", String(anchor.y * 100));
        svg.appendChild(line);

        const dot = document.createElement("span");
        dot.className = "pf-layout-anchor-dot";
        dot.style.left = `${anchor.x * 100}%`;
        dot.style.top = `${anchor.y * 100}%`;
        dot.title = `Lot anchor · ${code}`;
        mapCanvas.appendChild(dot);

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pf-layout-map-chip";
        chip.dataset.code = code;
        chip.innerHTML = `<strong>${code}</strong><span><i></i><i></i><i></i></span>`;
        chip.style.left = `${point.x * 100}%`;
        chip.style.top = `${point.y * 100}%`;
        chip.title = `${code} · kéo tự do để đổi vị trí card`;
        chip.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          mapDrag = { type: "chip", code, pointerId: event.pointerId, node: chip, line };
          chip.setPointerCapture?.(event.pointerId);
        });
        mapCanvas.appendChild(chip);
      });
    }

    function moveMapDrag(event) {
      if (!mapDrag || event.pointerId !== mapDrag.pointerId || !mapCanvas) return;
      event.preventDefault();
      const rect = mapCanvas.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0.04, 0.96);
      const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0.04, 0.96);
      if (mapDrag.type === "column") {
        const value = mapDrag.side === "left" ? clamp(x, 0.06, 0.44) : clamp(x, 0.56, 0.94);
        ui.columns[mapDrag.side] = value;
        mapDrag.node.style.left = `${value * 100}%`;
        applyColumn(mapDrag.side, value);
      } else {
        applyMapPoint(mapDrag.code, x, y);
        const point = ui.map[mapDrag.code];
        mapDrag.node.style.left = `${point.x * 100}%`;
        mapDrag.node.style.top = `${point.y * 100}%`;
        mapDrag.line?.setAttribute("x1", String(point.x * 100));
        mapDrag.line?.setAttribute("y1", String(point.y * 100));
        updateConnectors();
      }
    }

    function finishMapDrag(event) {
      if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
      try { mapDrag.node.releasePointerCapture?.(event.pointerId); } catch {}
      mapDrag = null;
      saveUi();
      persistLayout();
    }

    function tidy() {
      if (!stage) return;
      applySize();
      captureMapFromCanvas(false);
      const all = cards();
      if (!all.length) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const insetY = Math.max(20, Math.round(h * 0.035));
      const left = [];
      const right = [];
      const spacingFactor = clamp(ui.spacing / 100, 0.45, 1.8);

      all.forEach((card) => {
        const code = codeFor(card);
        const point = ui.map[code] || { x: (card.offsetLeft + card.offsetWidth / 2) / w, y: 0.5 };
        (point.x <= 0.5 ? left : right).push({ card, code, point });
      });
      left.sort((a, b) => a.point.y - b.point.y);
      right.sort((a, b) => a.point.y - b.point.y);

      function place(list, side) {
        if (!list.length) return;
        const heights = list.map(({ card }) => card.offsetHeight || 180);
        const total = heights.reduce((sum, value) => sum + value, 0);
        const available = Math.max(0, h - insetY * 2 - total);
        const naturalGap = list.length > 1 ? Math.max(8, available / (list.length - 1)) : 0;
        const gap = naturalGap * spacingFactor;
        const usedHeight = total + Math.max(0, list.length - 1) * gap;
        let top = Math.max(insetY, (h - usedHeight) / 2);
        const centerX = (side === "left" ? ui.columns.left : ui.columns.right) * w;

        list.forEach(({ card, code }, index) => {
          const leftPx = clamp(centerX - card.offsetWidth / 2, 8, Math.max(8, w - card.offsetWidth - 8));
          card.style.left = `${leftPx}px`;
          card.style.right = "auto";
          card.style.top = `${top}px`;
          ui.map[code] = {
            x: clamp((leftPx + card.offsetWidth / 2) / w, 0.04, 0.96),
            y: clamp((top + card.offsetHeight / 2) / h, 0.04, 0.96),
          };
          top += heights[index] + gap;
        });
      }

      place(left, "left");
      place(right, "right");
      saveUi();
      persistLayout();
      updateConnectors();
      renderLayoutMap();
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { left: left.length, right: right.length, mode: "manual-layout" } }));
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
          <label class="pf-layout-quick-control"><span>Card</span><input data-layout-ui="size" type="range" min="45" max="115" step="1"><output></output></label>
          <label class="pf-layout-quick-control"><span>Spacing</span><input data-layout-ui="spacing" type="range" min="45" max="180" step="5"><output></output></label>
          <details class="pf-layout-map-menu">
            <summary>Arrange</summary>
            <div class="pf-layout-map-popover">
              <header><strong>Manual layout</strong><small>Card → connector → lot anchor are linked. Drag cards freely, move L/R columns, then quick-arrange only when you want a clean starting rhythm.</small></header>
              <div class="pf-layout-map-legend"><span><i class="card"></i>Info card</span><span><i class="line"></i>Connector</span><span><i class="anchor"></i>Lot anchor</span></div>
              <div class="pf-layout-map-canvas"></div>
              <footer><button type="button" data-layout-ui="capture">Use current layout</button><button type="button" class="primary" data-layout-ui="tidy">Quick arrange</button></footer>
            </div>
          </details>`;
        const sizeInput = control.querySelector('[data-layout-ui="size"]');
        const sizeOutput = sizeInput.closest("label").querySelector("output");
        const spacingInput = control.querySelector('[data-layout-ui="spacing"]');
        const spacingOutput = spacingInput.closest("label").querySelector("output");
        mapCanvas = control.querySelector(".pf-layout-map-canvas");
        sizeInput.value = String(Math.max(45, Math.min(115, ui.size)));
        sizeOutput.textContent = `${sizeInput.value}%`;
        spacingInput.value = String(Math.max(45, Math.min(180, ui.spacing)));
        spacingOutput.textContent = `${spacingInput.value}%`;
        sizeInput.addEventListener("input", () => {
          ui.size = Number(sizeInput.value) || 88;
          sizeOutput.textContent = `${ui.size}%`;
          applySize();
          updateConnectors();
          saveUi();
        });
        sizeInput.addEventListener("change", persistLayout);
        spacingInput.addEventListener("input", () => {
          ui.spacing = Number(spacingInput.value) || 100;
          spacingOutput.textContent = `${ui.spacing}%`;
          saveUi();
          tidy();
        });
        control.querySelector('[data-layout-ui="tidy"]').addEventListener("click", tidy);
        control.querySelector('[data-layout-ui="capture"]').addEventListener("click", () => {
          captureMapFromCanvas(true);
          renderLayoutMap();
        });
        control.querySelector(".pf-layout-map-menu").addEventListener("toggle", (event) => {
          if (event.currentTarget.open) {
            captureMapFromCanvas(false);
            renderLayoutMap();
          }
        });
        mapCanvas.addEventListener("pointermove", moveMapDrag);
        mapCanvas.addEventListener("pointerup", finishMapDrag);
        mapCanvas.addEventListener("pointercancel", finishMapDrag);
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

    function onAnchorChanged() {
      updateConnectors();
      if (document.querySelector(".pf-layout-map-menu[open]")) renderLayoutMap();
    }

    installWithRetry();
    window.addEventListener("pf-overview-live-units-ready", installWithRetry);
    window.addEventListener("pf-overview-auto-arranged", updateConnectors);
    window.addEventListener("pf-overview-anchor-changed", onAnchorChanged);
    window.addEventListener("resize", updateConnectors);

    return () => {
      disposed = true;
      cancelAnimationFrame(retryRaf);
      window.removeEventListener("pf-overview-live-units-ready", installWithRetry);
      window.removeEventListener("pf-overview-auto-arranged", updateConnectors);
      window.removeEventListener("pf-overview-anchor-changed", onAnchorChanged);
      window.removeEventListener("resize", updateConnectors);
      control?.remove();
    };
  }, []);

  return null;
}
