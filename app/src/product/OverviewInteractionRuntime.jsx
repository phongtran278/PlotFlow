import { useEffect } from "react";
import "./OverviewInteractionRuntime.css";

const HIDDEN_KEY = "plotflow-overview-hidden-layers-v1";

function readHidden() {
  try {
    const value = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveHidden(value) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(value));
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

export default function OverviewInteractionRuntime() {
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let attempts = 0;
    let panel = null;
    let stage = null;
    const hidden = readHidden();

    function unitNodes(code) {
      if (!stage) return {};
      const cards = Array.from(stage.querySelectorAll(".pf-live-sales-callout"));
      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor"));
      const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line"));
      return {
        card: cards.find((node) => codeFor(node) === code) || null,
        connector: lines.find((node) => node.dataset.unitCode === code) || null,
        anchor: anchors.find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code) || null,
      };
    }

    function applyHidden() {
      if (!stage) return;
      Object.entries(hidden).forEach(([code, types]) => {
        const nodes = unitNodes(code);
        ["card", "connector", "anchor"].forEach((type) => {
          if (!nodes[type]) return;
          nodes[type].style.display = types?.[type] ? "none" : "";
        });
      });
    }

    function focusUnit(code, type) {
      const nodes = unitNodes(code);
      const node = nodes[type] || nodes.card || nodes.anchor;
      if (!node) return;
      stage.querySelectorAll(".pf-layer-inspect-active").forEach((item) => item.classList.remove("pf-layer-inspect-active"));
      node.classList.add("pf-layer-inspect-active");
      node.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      window.setTimeout(() => node.classList.remove("pf-layer-inspect-active"), 1400);
    }

    function setLayerVisible(code, type, visible) {
      hidden[code] ||= {};
      hidden[code][type] = !visible;
      saveHidden(hidden);
      applyHidden();
      renderPanel();
    }

    function removeVisual(code, type) {
      hidden[code] ||= {};
      hidden[code][type] = true;
      saveHidden(hidden);
      applyHidden();
      renderPanel();
    }

    function renderPanel() {
      if (!panel || !stage) return;
      const cards = Array.from(stage.querySelectorAll(".pf-live-sales-callout"));
      const codes = cards.map(codeFor).filter(Boolean);
      const shapes = Array.from(stage.querySelectorAll(".pf-pen-shape"));
      panel.innerHTML = `
        <div class="pf-layer-panel-head">
          <div><span>LAYERS</span><strong>Visual objects</strong></div>
          <small>${codes.length} units · ${shapes.length} highlights</small>
        </div>
        <div class="pf-layer-panel-list"></div>
        <div class="pf-layer-panel-foot">
          <button type="button" data-layer-action="show-all">Show all</button>
          <button type="button" data-layer-action="clear-highlights">Clear highlights</button>
        </div>`;
      const list = panel.querySelector(".pf-layer-panel-list");

      codes.forEach((code) => {
        const group = document.createElement("details");
        group.className = "pf-layer-unit";
        group.innerHTML = `<summary><span>${code}</span><small>card · connector · anchor</small></summary><div></div>`;
        const body = group.querySelector("div");
        [
          ["card", "Info card"],
          ["connector", "Connector"],
          ["anchor", "Lot anchor"],
        ].forEach(([type, label]) => {
          const isVisible = !hidden[code]?.[type];
          const row = document.createElement("div");
          row.className = "pf-layer-row";
          row.innerHTML = `
            <button type="button" class="pf-layer-eye ${isVisible ? "is-visible" : ""}" data-layer-eye="${type}" title="${isVisible ? "Hide" : "Show"} ${label}">${isVisible ? "◉" : "○"}</button>
            <button type="button" class="pf-layer-name" data-layer-focus="${type}">${label}</button>
            <button type="button" class="pf-layer-remove" data-layer-remove="${type}" title="Remove ${label} from Overview">×</button>`;
          body.appendChild(row);
        });
        list.appendChild(group);
      });

      if (shapes.length) {
        const highlight = document.createElement("details");
        highlight.className = "pf-layer-unit pf-layer-highlights";
        highlight.open = true;
        highlight.innerHTML = `<summary><span>Highlights</span><small>${shapes.length} shapes</small></summary><div></div>`;
        const body = highlight.querySelector("div");
        shapes.forEach((shape, index) => {
          const row = document.createElement("div");
          row.className = "pf-layer-row";
          row.innerHTML = `<span class="pf-layer-shape-dot"></span><button type="button" class="pf-layer-name" data-highlight-focus="${shape.dataset.penShapeId || ""}">Highlight ${String(index + 1).padStart(2, "0")}</button><button type="button" class="pf-layer-remove" data-highlight-remove="${shape.dataset.penShapeId || ""}" title="Delete highlight">×</button>`;
          body.appendChild(row);
        });
        list.appendChild(highlight);
      }
    }

    function installPanel() {
      const side = document.querySelector(".pf-overview-side");
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!side || !stage) return false;
      if (!panel?.isConnected) {
        panel = document.createElement("section");
        panel.className = "pf-overview-layer-panel pf-overview-context-card";
        side.prepend(panel);
      }
      applyHidden();
      renderPanel();
      return true;
    }

    function scheduleInstall() {
      cancelAnimationFrame(frame);
      attempts = 0;
      const run = () => {
        if (disposed || installPanel()) return;
        attempts += 1;
        if (attempts < 12) frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    }

    function closeOtherDetails(current) {
      document.querySelectorAll(".pf-overview details[open]").forEach((node) => {
        if (node !== current && !node.closest(".pf-overview-layer-panel")) node.removeAttribute("open");
      });
    }

    function onToggle(event) {
      const detail = event.target;
      if (!(detail instanceof HTMLDetailsElement) || !detail.open || !detail.closest(".pf-overview")) return;
      if (detail.closest(".pf-overview-layer-panel")) return;
      closeOtherDetails(detail);
    }

    function onPointerDown(event) {
      const overview = document.querySelector(".pf-overview");
      if (!overview) return;
      const openDetails = Array.from(overview.querySelectorAll("details[open]")).filter((node) => !node.closest(".pf-overview-layer-panel"));
      openDetails.forEach((detail) => {
        if (!detail.contains(event.target)) detail.removeAttribute("open");
      });
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".pf-overview details[open]").forEach((node) => {
        if (!node.closest(".pf-overview-layer-panel")) node.removeAttribute("open");
      });
    }

    function onPanelClick(event) {
      if (!panel?.contains(event.target)) return;
      const eye = event.target.closest("[data-layer-eye]");
      const focus = event.target.closest("[data-layer-focus]");
      const remove = event.target.closest("[data-layer-remove]");
      const highlightFocus = event.target.closest("[data-highlight-focus]");
      const highlightRemove = event.target.closest("[data-highlight-remove]");
      const action = event.target.closest("[data-layer-action]");
      const group = event.target.closest(".pf-layer-unit");
      const code = group?.querySelector("summary span")?.textContent?.trim() || "";

      if (eye && code) setLayerVisible(code, eye.dataset.layerEye, Boolean(hidden[code]?.[eye.dataset.layerEye]));
      if (focus && code) focusUnit(code, focus.dataset.layerFocus);
      if (remove && code) removeVisual(code, remove.dataset.layerRemove);
      if (highlightFocus) window.dispatchEvent(new CustomEvent("pf-overview-select-highlight", { detail: { id: highlightFocus.dataset.highlightFocus } }));
      if (highlightRemove) window.dispatchEvent(new CustomEvent("pf-overview-delete-highlight", { detail: { id: highlightRemove.dataset.highlightRemove } }));
      if (action?.dataset.layerAction === "show-all") {
        Object.keys(hidden).forEach((key) => delete hidden[key]);
        saveHidden(hidden);
        applyHidden();
        renderPanel();
      }
      if (action?.dataset.layerAction === "clear-highlights") window.dispatchEvent(new CustomEvent("pf-overview-clear-highlights"));
    }

    function refreshPanel() {
      requestAnimationFrame(() => {
        if (!installPanel()) scheduleInstall();
        else renderPanel();
      });
    }

    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onPanelClick);
    window.addEventListener("pf-overview-live-units-ready", refreshPanel);
    window.addEventListener("pf-overview-highlights-changed", refreshPanel);
    window.addEventListener("pf-overview-group-changed", refreshPanel);
    window.addEventListener("plotflow-product-view-changed", refreshPanel);
    scheduleInstall();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onPanelClick);
      window.removeEventListener("pf-overview-live-units-ready", refreshPanel);
      window.removeEventListener("pf-overview-highlights-changed", refreshPanel);
      window.removeEventListener("pf-overview-group-changed", refreshPanel);
      window.removeEventListener("plotflow-product-view-changed", refreshPanel);
      panel?.remove();
    };
  }, []);

  return null;
}
