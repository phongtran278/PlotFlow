import { useEffect } from "react";
import "./OverviewLayoutPresetRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const UI_KEY = "phongflow-overview-layout-ui-v1";

function readUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
    return {
      size: Number(value.size) || 88,
      split: value.split || "keep",
    };
  } catch {
    return { size: 88, split: "keep" };
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
  return Math.max(min, Math.min(max, value));
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

    function nearestCardEdge(card, anchorX, anchorY) {
      const left = card.offsetLeft;
      const top = card.offsetTop;
      const right = left + card.offsetWidth;
      const bottom = top + card.offsetHeight;
      const cx = left + card.offsetWidth / 2;
      const cy = top + card.offsetHeight / 2;
      const candidates = [
        { x: left, y: cy },
        { x: right, y: cy },
        { x: cx, y: top },
        { x: cx, y: bottom },
      ];
      return candidates.reduce((best, point) => {
        const distance = (point.x - anchorX) ** 2 + (point.y - anchorY) ** 2;
        return !best || distance < best.distance ? { ...point, distance } : best;
      }, null);
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
        const anchorPctX = Number.parseFloat(anchor.style.left || "50");
        const anchorPctY = Number.parseFloat(anchor.style.top || "50");
        const anchorX = (anchorPctX / 100) * w;
        const anchorY = (anchorPctY / 100) * h;
        const edge = nearestCardEdge(card, anchorX, anchorY);
        line.setAttribute("x1", String((edge.x / w) * 100));
        line.setAttribute("y1", String((edge.y / h) * 100));
        line.setAttribute("x2", String(anchorPctX));
        line.setAttribute("y2", String(anchorPctY));
      });
    }

    function itemsForLayout() {
      return cards().map((card) => {
        const code = codeFor(card);
        const anchor = anchorFor(stage, code);
        return {
          card,
          code,
          anchor,
          x: Number.parseFloat(anchor?.style.left || "50"),
          y: Number.parseFloat(anchor?.style.top || "50"),
          currentX: card.offsetLeft + card.offsetWidth / 2,
        };
      });
    }

    function splitItems(items) {
      const w = stage?.clientWidth || 1;
      if (ui.split === "keep") {
        let left = items.filter((item) => item.currentX < w / 2);
        let right = items.filter((item) => item.currentX >= w / 2);
        if (!left.length || !right.length) {
          const half = Math.ceil(items.length / 2);
          const ordered = [...items].sort((a, b) => a.x - b.x);
          left = ordered.slice(0, half);
          right = ordered.slice(half);
        }
        return { left, right };
      }

      if (ui.split === "auto") {
        const left = items.filter((item) => item.x <= 50);
        const right = items.filter((item) => item.x > 50);
        if (left.length && right.length) return { left, right };
      }

      const requested = Number(ui.split);
      const leftCount = Number.isFinite(requested)
        ? clamp(Math.round(requested), 1, Math.max(1, items.length - 1))
        : Math.ceil(items.length / 2);
      const ordered = [...items].sort((a, b) => a.x - b.x);
      return { left: ordered.slice(0, leftCount), right: ordered.slice(leftCount) };
    }

    function tidy() {
      if (!stage) return;
      applySize();
      const all = cards();
      if (!all.length) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const items = itemsForLayout();
      let { left, right } = splitItems(items);
      left = [...left].sort((a, b) => a.y - b.y);
      right = [...right].sort((a, b) => a.y - b.y);

      const insetX = Math.max(36, Math.round(w * 0.06));
      const insetY = Math.max(18, Math.round(h * 0.035));

      function place(list, side) {
        if (!list.length) return;
        const heights = list.map(({ card }) => card.offsetHeight || 160);
        const totalHeight = heights.reduce((sum, value) => sum + value, 0);
        const available = Math.max(0, h - insetY * 2 - totalHeight);
        const gap = list.length > 1 ? Math.max(6, available / (list.length - 1)) : 0;
        let top = list.length === 1 ? (h - heights[0]) / 2 : insetY;

        list.forEach(({ card }, index) => {
          const cardW = card.offsetWidth || 180;
          const x = side === "left" ? insetX : Math.max(insetX, w - insetX - cardW);
          card.style.left = `${x}px`;
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
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", {
        detail: { left: left.length, right: right.length, mode: "tidy", split: ui.split },
      }));
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

    function syncSplitOptions(select) {
      if (!select || !stage) return;
      const count = cards().length;
      const previous = ui.split;
      select.innerHTML = `<option value="keep">Keep sides</option><option value="auto">Auto by lot</option>`;
      for (let left = 1; left < count; left += 1) {
        const option = document.createElement("option");
        option.value = String(left);
        option.textContent = `${left}L / ${count - left}R`;
        select.appendChild(option);
      }
      const valid = Array.from(select.options).some((option) => option.value === String(previous));
      if (!valid) ui.split = "keep";
      select.value = String(ui.split);
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
          <label class="pf-card-size-field"><span>Card size</span><input data-layout-ui="size" type="range" min="45" max="115" step="1"><output></output></label>
          <div class="pf-layout-tidy-control">
            <span>Layout</span>
            <select data-layout-ui="split" title="Choose how cards are divided left and right"></select>
            <button type="button" data-layout-ui="tidy" title="Keep your left/right choice, then align and distribute cards">Tidy</button>
          </div>`;
        const input = control.querySelector('[data-layout-ui="size"]');
        const output = control.querySelector("output");
        const split = control.querySelector('[data-layout-ui="split"]');
        input.value = String(Math.max(45, Math.min(115, ui.size)));
        output.textContent = `${input.value}%`;
        syncSplitOptions(split);

        input.addEventListener("input", () => {
          ui.size = Number(input.value) || 88;
          output.textContent = `${ui.size}%`;
          applySize();
          updateConnectors();
          localStorage.setItem(UI_KEY, JSON.stringify(ui));
        });
        input.addEventListener("change", persistLayout);
        split.addEventListener("change", () => {
          ui.split = split.value;
          localStorage.setItem(UI_KEY, JSON.stringify(ui));
        });
        control.querySelector('[data-layout-ui="tidy"]').addEventListener("click", tidy);
        rail.appendChild(control);
      } else {
        syncSplitOptions(control.querySelector('[data-layout-ui="split"]'));
        updateConnectors();
      }
    }

    install();
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", install);
    window.addEventListener("pf-overview-auto-arranged", updateConnectors);
    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", install);
      window.removeEventListener("pf-overview-auto-arranged", updateConnectors);
      control?.remove();
    };
  }, []);

  return null;
}
