import { useEffect } from "react";
import "./OverviewArrangeEditorRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code,header strong")?.textContent?.trim() || "";
}

function readLayout() {
  try {
    const value = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export default function OverviewArrangeEditorRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let rail = null;
    let editor = null;
    let canvas = null;
    let drag = null;
    let draft = new Map();
    let retry = 0;
    let frame = 0;

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")) : [];
    const anchors = () => stage ? Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor")) : [];

    function snapshot() {
      if (!stage) return;
      const sw = stage.clientWidth || 1;
      const sh = stage.clientHeight || 1;
      draft = new Map();
      cards().forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        draft.set(code, {
          x: clamp(card.offsetLeft / sw, 0, 1),
          y: clamp(card.offsetTop / sh, 0, 1),
          w: clamp(card.offsetWidth / sw, 0.01, 1),
          h: clamp(card.offsetHeight / sh, 0.01, 1),
        });
      });
      renderMap();
    }

    function anchorMap() {
      return new Map(anchors().map((anchor) => [anchor.dataset.unitCode || anchor.textContent?.trim() || "", {
        x: clamp(Number.parseFloat(anchor.style.left || "50") / 100, 0, 1),
        y: clamp(Number.parseFloat(anchor.style.top || "50") / 100, 0, 1),
      }]));
    }

    function renderMap() {
      if (!canvas) return;
      const anchorsByCode = anchorMap();
      const lines = canvas.querySelector("svg");
      const cardsLayer = canvas.querySelector(".pf-arrange-map-cards");
      if (!lines || !cardsLayer) return;
      lines.innerHTML = "";
      cardsLayer.innerHTML = "";
      draft.forEach((item, code) => {
        const anchor = anchorsByCode.get(code) || { x: .5, y: .5 };
        const startX = item.x + item.w / 2;
        const startY = item.y + item.h / 2;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(startX * 100));
        line.setAttribute("y1", String(startY * 100));
        line.setAttribute("x2", String(anchor.x * 100));
        line.setAttribute("y2", String(anchor.y * 100));
        lines.appendChild(line);

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", String(anchor.x * 100));
        dot.setAttribute("cy", String(anchor.y * 100));
        dot.setAttribute("r", "0.8");
        lines.appendChild(dot);

        const node = document.createElement("button");
        node.type = "button";
        node.className = "pf-arrange-map-card";
        node.dataset.unitCode = code;
        node.textContent = code;
        node.style.left = `${item.x * 100}%`;
        node.style.top = `${item.y * 100}%`;
        node.style.width = `${Math.max(8, item.w * 100)}%`;
        node.style.height = `${Math.max(7, item.h * 100)}%`;
        cardsLayer.appendChild(node);
      });
    }

    function evenlyPlace(list, side) {
      if (!list.length) return;
      const margin = .035;
      const usable = .93;
      list.sort((a, b) => a.anchorY - b.anchorY).forEach((entry, index) => {
        const item = draft.get(entry.code);
        if (!item) return;
        const t = list.length === 1 ? .5 : index / (list.length - 1);
        item.x = side === "left" ? margin : clamp(1 - margin - item.w, 0, 1);
        item.y = clamp(.035 + usable * t - item.h / 2, .02, 1 - item.h - .02);
      });
    }

    function autoLayout(mode) {
      const anchorsByCode = anchorMap();
      const items = Array.from(draft.keys()).map((code) => {
        const anchor = anchorsByCode.get(code) || { x: .5, y: .5 };
        return { code, anchorX: anchor.x, anchorY: anchor.y };
      });
      if (!items.length) return;

      if (mode === "left-right") {
        const sorted = [...items].sort((a, b) => a.anchorX - b.anchorX);
        const split = Math.ceil(sorted.length / 2);
        evenlyPlace(sorted.slice(0, split), "left");
        evenlyPlace(sorted.slice(split), "right");
      } else {
        const left = items.filter((item) => item.anchorX <= .5);
        const right = items.filter((item) => item.anchorX > .5);
        if (!left.length || !right.length) {
          const sorted = [...items].sort((a, b) => a.anchorX - b.anchorX);
          const split = Math.ceil(sorted.length / 2);
          evenlyPlace(sorted.slice(0, split), "left");
          evenlyPlace(sorted.slice(split), "right");
        } else {
          evenlyPlace(left, "left");
          evenlyPlace(right, "right");
        }
      }
      renderMap();
    }

    function applyDraft() {
      if (!stage) return;
      const sw = stage.clientWidth || 1;
      const sh = stage.clientHeight || 1;
      const saved = readLayout();
      cards().forEach((card) => {
        const code = codeFor(card);
        const item = draft.get(code);
        if (!code || !item) return;
        const left = clamp(item.x * sw, 0, Math.max(0, sw - card.offsetWidth));
        const top = clamp(item.y * sh, 0, Math.max(0, sh - card.offsetHeight));
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.right = "auto";
        saved[code] = { left, top, width: card.offsetWidth, height: card.offsetHeight };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { source: "arrange-editor" } }));
      window.dispatchEvent(new CustomEvent("pf-overview-card-size-changed", { detail: { reason: "arrange-editor" } }));
      snapshot();
    }

    function applyCardDimensions() {
      const widthInput = rail?.querySelector('[data-card-dimension="width"]');
      const heightInput = rail?.querySelector('[data-card-dimension="height"]');
      if (!widthInput || !heightInput) return;
      widthInput.dispatchEvent(new Event("change", { bubbles: true }));
      heightInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function install() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      rail = document.querySelector(".pf-overview-control-rail");
      if (!stage || !rail) return false;

      rail.classList.add("pf-overview-control-rail-v3");
      rail.querySelector(".pf-overview-groups")?.classList.add("pf-overview-primary-switcher");

      const dimensions = rail.querySelector(".pf-card-dimensions");
      if (dimensions && !dimensions.querySelector('[data-card-action="apply-dimensions"]')) {
        const apply = document.createElement("button");
        apply.type = "button";
        apply.className = "pf-card-dimension-apply";
        apply.dataset.cardAction = "apply-dimensions";
        apply.textContent = "Apply";
        apply.addEventListener("click", applyCardDimensions);
        dimensions.appendChild(apply);
      }

      const oldButton = rail.querySelector(".pf-auto-arrange-button");
      const oldMini = rail.querySelector(".pf-arrange-minimap");
      if (oldButton) oldButton.style.display = "none";
      if (oldMini) oldMini.style.display = "none";

      if (!editor?.isConnected) {
        editor = document.createElement("details");
        editor.className = "pf-arrange-editor";
        editor.innerHTML = `
          <summary>Arrange map</summary>
          <div class="pf-arrange-editor-popover">
            <header><div><span>LAYOUT MAP</span><strong>Cards & connectors</strong></div><button type="button" data-arrange-action="close">×</button></header>
            <div class="pf-arrange-editor-modes">
              <button type="button" data-arrange-mode="balanced">Auto · Balanced</button>
              <button type="button" data-arrange-mode="left-right">Auto · Left / Right</button>
              <span>Manual · drag cards below</span>
            </div>
            <div class="pf-arrange-editor-canvas">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
              <div class="pf-arrange-map-cards"></div>
            </div>
            <footer><button type="button" data-arrange-action="reset">Reset preview</button><button type="button" class="primary" data-arrange-action="apply">Apply layout</button></footer>
          </div>`;
        rail.appendChild(editor);
        canvas = editor.querySelector(".pf-arrange-editor-canvas");

        editor.addEventListener("toggle", () => { if (editor.open) snapshot(); });
        editor.addEventListener("click", (event) => {
          const mode = event.target.closest("[data-arrange-mode]")?.dataset?.arrangeMode;
          if (mode) { autoLayout(mode); return; }
          const action = event.target.closest("[data-arrange-action]")?.dataset?.arrangeAction;
          if (action === "close") editor.removeAttribute("open");
          if (action === "reset") snapshot();
          if (action === "apply") applyDraft();
        });

        canvas.addEventListener("pointerdown", (event) => {
          const card = event.target.closest(".pf-arrange-map-card");
          if (!card) return;
          const code = card.dataset.unitCode;
          const item = draft.get(code);
          if (!item) return;
          event.preventDefault();
          card.setPointerCapture?.(event.pointerId);
          drag = { code, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y };
          card.classList.add("is-dragging");
        });
        canvas.addEventListener("pointermove", (event) => {
          if (!drag || event.pointerId !== drag.pointerId) return;
          const rect = canvas.getBoundingClientRect();
          const item = draft.get(drag.code);
          if (!item) return;
          item.x = clamp(drag.x + (event.clientX - drag.startX) / Math.max(1, rect.width), 0, 1 - item.w);
          item.y = clamp(drag.y + (event.clientY - drag.startY) / Math.max(1, rect.height), 0, 1 - item.h);
          renderMap();
        });
        const endDrag = (event) => {
          if (!drag || event.pointerId !== drag.pointerId) return;
          canvas.querySelector(`[data-unit-code="${CSS.escape(drag.code)}"]`)?.classList.remove("is-dragging");
          drag = null;
        };
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
      }
      snapshot();
      return true;
    }

    function installWithRetry() {
      cancelAnimationFrame(frame);
      retry = 0;
      const run = () => {
        if (disposed || install()) return;
        retry += 1;
        if (retry < 60) frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    }

    const onUnits = () => requestAnimationFrame(snapshot);
    const onGroup = () => window.setTimeout(() => { install(); snapshot(); }, 0);
    const onArrange = () => requestAnimationFrame(snapshot);
    installWithRetry();
    window.addEventListener("pf-overview-live-units-ready", onUnits);
    window.addEventListener("pf-overview-group-changed", onGroup);
    window.addEventListener("pf-overview-auto-arranged", onArrange);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("pf-overview-live-units-ready", onUnits);
      window.removeEventListener("pf-overview-group-changed", onGroup);
      window.removeEventListener("pf-overview-auto-arranged", onArrange);
      editor?.remove();
    };
  }, []);

  return null;
}
