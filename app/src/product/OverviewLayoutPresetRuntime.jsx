import { useEffect } from "react";
import "./OverviewLayoutPresetRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const UI_KEY = "phongflow-overview-layout-ui-v1";

function readUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    const legacySpacing = Number(value.spacing);
    return {
      gap: Number.isFinite(Number(value.gap)) ? Number(value.gap) : Number.isFinite(legacySpacing) ? Math.round(legacySpacing / 5) : 20,
      map: value.map && typeof value.map === "object" ? value.map : {},
      columns: value.columns && typeof value.columns === "object" ? value.columns : {},
    };
  } catch {
    return { gap: 20, map: {}, columns: {} };
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

    function saveUi() {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
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
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
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

    function renderLayoutMap() {
      if (!mapCanvas || !stage) return;
      captureMapFromCanvas(false);
      mapCanvas.innerHTML = "";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
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

    function moveCardFromMap(code, x, y) {
      if (!stage) return;
      const card = cards().find((item) => codeFor(item) === code);
      if (!card) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const left = clamp(x * w - card.offsetWidth / 2, 8, Math.max(8, w - card.offsetWidth - 8));
      const top = clamp(y * h - card.offsetHeight / 2, 8, Math.max(8, h - card.offsetHeight - 8));
      card.style.left = `${left}px`;
      card.style.right = "auto";
      card.style.top = `${top}px`;
    }

    function moveColumnCards(side) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      cards().forEach((card) => {
        const code = codeFor(card);
        const point = ui.map[code];
        if (!point || (point.x <= 0.5 ? "left" : "right") !== side) return;
        const centerX = ui.columns[side] * w;
        const left = clamp(centerX - card.offsetWidth / 2, 8, Math.max(8, w - card.offsetWidth - 8));
        card.style.left = `${left}px`;
        card.style.right = "auto";
        ui.map[code] = { ...point, x: clamp((left + card.offsetWidth / 2) / w, 0.04, 0.96) };
      });
      persistLayout();
      updateConnectors();
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
        moveColumnCards(mapDrag.side);
      } else {
        ui.map[mapDrag.code] = { x, y };
        mapDrag.node.style.left = `${x * 100}%`;
        mapDrag.node.style.top = `${y * 100}%`;
        mapDrag.line?.setAttribute("x1", String(x * 100));
        mapDrag.line?.setAttribute("y1", String(y * 100));
        moveCardFromMap(mapDrag.code, x, y);
        updateConnectors();
      }
    }

    function finishMapDrag(event) {
      if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
      try { mapDrag.node.releasePointerCapture?.(event.pointerId); } catch {}
      mapDrag = null;
      saveUi();
      persistLayout();
      updateConnectors();
    }

    function arrangeExactGap() {
      if (!stage) return;
      captureMapFromCanvas(false);
      const all = cards();
      if (!all.length) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const insetY = Math.max(12, Math.round(h * 0.02));
      const gap = clamp(ui.gap, 0, 120);
      const left = [];
      const right = [];

      all.forEach((card) => {
        const code = codeFor(card);
        const point = ui.map[code] || { x: (card.offsetLeft + card.offsetWidth / 2) / w, y: 0.5 };
        (point.x <= 0.5 ? left : right).push({ card, code, point });
      });
      left.sort((a, b) => a.point.y - b.point.y);
      right.sort((a, b) => a.point.y - b.point.y);

      function place(list, side) {
        if (!list.length) return;
        const heights = list.map(({ card }) => card.offsetHeight || 100);
        const total = heights.reduce((sum, value) => sum + value, 0);
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
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { left: left.length, right: right.length, mode: "preserve-size", gap } }));
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
      installExportMenu();
      document.querySelector(".pf-v2-arrange")?.classList.add("pf-v2-arrange-superseded");

      if (!control?.isConnected) {
        control = document.createElement("div");
        control.className = "pf-card-layout-control";
        control.innerHTML = `
          <details class="pf-layout-map-menu">
            <summary>Arrange</summary>
            <div class="pf-layout-map-popover">
              <header><strong>Arrange cards</strong><small>Quick Arrange preserves every card's current size. Transform controls size; Arrange controls position.</small></header>
              <div class="pf-layout-map-legend"><span><i class="card"></i>Info card</span><span><i class="line"></i>Connector</span><span><i class="anchor"></i>Lot anchor</span></div>
              <div class="pf-layout-map-canvas"></div>
              <footer><button type="button" data-layout-ui="capture">Use current layout</button><button type="button" class="primary" data-layout-ui="tidy">Quick arrange</button></footer>
            </div>
          </details>`;
        mapCanvas = control.querySelector(".pf-layout-map-canvas");
        control.querySelector('[data-layout-ui="tidy"]').addEventListener("click", arrangeExactGap);
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

    function onPrecisionGap(event) {
      const next = Number(event.detail?.gap);
      if (!Number.isFinite(next)) return;
      ui.gap = clamp(next, 0, 120);
      saveUi();
    }

    installWithRetry();
    window.addEventListener("pf-overview-live-units-ready", installWithRetry);
    window.addEventListener("pf-overview-auto-arranged", updateConnectors);
    window.addEventListener("pf-overview-precision-gap", onPrecisionGap);
    window.addEventListener("resize", updateConnectors);

    return () => {
      disposed = true;
      cancelAnimationFrame(retryRaf);
      window.removeEventListener("pf-overview-live-units-ready", installWithRetry);
      window.removeEventListener("pf-overview-auto-arranged", updateConnectors);
      window.removeEventListener("pf-overview-precision-gap", onPrecisionGap);
      window.removeEventListener("resize", updateConnectors);
      control?.remove();
    };
  }, []);

  return null;
}
