import { useEffect } from "react";
import "./OverviewInteractionRuntime.css";

const HIDDEN_KEY = "plotflow-overview-hidden-layers-v1";
const HIGHLIGHT_OWNER_KEY = "plotflow-overview-highlight-owners-v1";
const BADGE_KEY = "plotflow-overview-unit-badges-v1";

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export default function OverviewInteractionRuntime() {
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let attempts = 0;
    let panel = null;
    let stage = null;
    const hidden = readJson(HIDDEN_KEY, {});
    const highlightOwners = readJson(HIGHLIGHT_OWNER_KEY, {});
    let badges = readJson(BADGE_KEY, {});

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    }

    function codes() {
      return cards().map(codeFor).filter(Boolean);
    }

    function unitNodes(code) {
      if (!stage) return {};
      const cardList = cards();
      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor"));
      const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line"));
      return {
        card: cardList.find((node) => codeFor(node) === code) || null,
        connector: lines.find((node) => node.dataset.unitCode === code) || null,
        anchor: anchors.find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code) || null,
      };
    }

    function shapeCenter(shape) {
      try {
        const box = shape.getBBox();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height };
      } catch {
        const points = String(shape.getAttribute("points") || "").split(/\s+/).map((pair) => pair.split(",").map(Number)).filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
        if (!points.length) return null;
        const xs = points.map((point) => point[0]);
        const ys = points.map((point) => point[1]);
        const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
      }
    }

    function associateUnownedHighlights(selectedId = "") {
      if (!stage) return;
      const validCodes = new Set(codes());
      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor"));
      const activeCode = String(stage.dataset.pfActiveAnchor || "");
      let changed = false;
      stage.querySelectorAll(".pf-pen-shape").forEach((shape) => {
        const id = String(shape.dataset.penShapeId || "");
        if (!id || (highlightOwners[id] && validCodes.has(highlightOwners[id]))) return;
        if (id === String(selectedId) && activeCode && validCodes.has(activeCode)) {
          highlightOwners[id] = activeCode;
          changed = true;
          return;
        }
        const center = shapeCenter(shape);
        if (!center || !anchors.length) return;
        let nearest = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        anchors.forEach((anchor) => {
          const code = anchor.dataset.unitCode || anchor.textContent?.trim() || "";
          if (!validCodes.has(code)) return;
          const x = Number.parseFloat(anchor.style.left || "50");
          const y = Number.parseFloat(anchor.style.top || "50");
          const distance = Math.hypot(center.x - x, center.y - y);
          if (distance < nearestDistance) { nearestDistance = distance; nearest = code; }
        });
        if (nearest && nearestDistance <= 28) {
          highlightOwners[id] = nearest;
          changed = true;
        }
      });
      if (changed) saveJson(HIGHLIGHT_OWNER_KEY, highlightOwners);
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

    function pointForNode(code, type) {
      if (!stage) return null;
      const nodes = unitNodes(code);
      if (type === "connector-start" && nodes.connector) return { x: Number(nodes.connector.getAttribute("x1")), y: Number(nodes.connector.getAttribute("y1")) };
      if ((type === "connector-end" || type === "anchor") && nodes.connector) return { x: Number(nodes.connector.getAttribute("x2")), y: Number(nodes.connector.getAttribute("y2")) };
      if (nodes.anchor) return { x: Number.parseFloat(nodes.anchor.style.left || "50"), y: Number.parseFloat(nodes.anchor.style.top || "50") };
      const card = nodes.card;
      if (card) {
        const w = stage.clientWidth || 1; const h = stage.clientHeight || 1;
        return { x: ((card.offsetLeft + card.offsetWidth / 2) / w) * 100, y: ((card.offsetTop + card.offsetHeight / 2) / h) * 100 };
      }
      return null;
    }

    function zoomToUnit(code, type = "anchor") {
      const point = pointForNode(code, type);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", { detail: { code, x: point.x, y: point.y, scale: 58 } }));
    }

    function zoomToHighlight(id) {
      const shape = stage?.querySelector(`[data-pen-shape-id="${CSS.escape(String(id))}"]`);
      const center = shape ? shapeCenter(shape) : null;
      if (!center) return;
      const scale = clamp(70 / Math.max(2, center.width, center.height), 12, 58);
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", { detail: { code: highlightOwners[id] || "", x: center.x, y: center.y, scale } }));
      window.dispatchEvent(new CustomEvent("pf-overview-select-highlight", { detail: { id } }));
    }

    function inspectUnit(code, type) {
      const nodes = unitNodes(code);
      const node = type === "connector-start" || type === "connector-end" ? nodes.connector : nodes[type] || nodes.card || nodes.anchor;
      if (!node) return;
      stage.querySelectorAll(".pf-layer-inspect-active").forEach((item) => item.classList.remove("pf-layer-inspect-active"));
      node.classList.add("pf-layer-inspect-active");
      window.setTimeout(() => node.classList.remove("pf-layer-inspect-active"), 1200);
    }

    function setLayerVisible(code, type, visible) {
      const normalizedType = type === "connector-start" || type === "connector-end" ? "connector" : type;
      hidden[code] ||= {};
      hidden[code][normalizedType] = !visible;
      saveJson(HIDDEN_KEY, hidden);
      applyHidden();
      renderPanel();
    }

    function row(label, type, visible = true, removable = true) {
      return `<div class="pf-layer-row" data-layer-row="${type}">
        <button type="button" class="pf-layer-eye ${visible ? "is-visible" : ""}" data-layer-eye="${type}" title="${visible ? "Hide" : "Show"} ${label}">${visible ? "◉" : "○"}</button>
        <button type="button" class="pf-layer-name" data-layer-focus="${type}">${label}</button>
        ${removable ? `<button type="button" class="pf-layer-remove" data-layer-remove="${type}" title="Remove ${label} from Overview">×</button>` : `<span></span>`}
      </div>`;
    }

    function renderPanel() {
      if (!panel || !stage) return;
      associateUnownedHighlights();
      const unitCodes = codes();
      const validCodes = new Set(unitCodes);
      const shapes = Array.from(stage.querySelectorAll(".pf-pen-shape"));
      const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line"));
      const orphanLines = lines.filter((line, index) => {
        const code = line.dataset.unitCode || "";
        if (!code || !validCodes.has(code)) return true;
        return lines.findIndex((item) => item.dataset.unitCode === code) !== index;
      });
      const orphanShapes = shapes.filter((shape) => !validCodes.has(highlightOwners[shape.dataset.penShapeId || ""]));
      badges = readJson(BADGE_KEY, {});

      panel.innerHTML = `
        <div class="pf-layer-panel-head">
          <div><span>LAYERS</span><strong>Visual objects</strong></div>
          <div class="pf-layer-panel-head-actions"><small>${unitCodes.length} units</small><button type="button" data-layer-action="edit-label">Map label</button></div>
        </div>
        <div class="pf-layer-panel-list"></div>
        <div class="pf-layer-panel-foot"><button type="button" data-layer-action="show-all">Show all</button></div>`;
      const list = panel.querySelector(".pf-layer-panel-list");

      unitCodes.forEach((code) => {
        const unitShapes = shapes.filter((shape) => highlightOwners[shape.dataset.penShapeId || ""] === code);
        const group = document.createElement("details");
        group.className = "pf-layer-unit";
        group.dataset.unitCode = code;
        group.innerHTML = `<summary title="Double-click to zoom ${code}"><span>${code}</span><small>${unitShapes.length ? `${unitShapes.length} highlight` : "card · connector"}</small></summary><div></div>`;
        const body = group.querySelector("div");
        body.insertAdjacentHTML("beforeend", row("Info card", "card", !hidden[code]?.card));
        body.insertAdjacentHTML("beforeend", row("Connector start", "connector-start", !hidden[code]?.connector));
        body.insertAdjacentHTML("beforeend", row("Connector end", "connector-end", !hidden[code]?.connector));
        unitShapes.forEach((shape, index) => {
          const id = shape.dataset.penShapeId || "";
          body.insertAdjacentHTML("beforeend", `<div class="pf-layer-row pf-layer-highlight-row"><span class="pf-layer-shape-dot"></span><button type="button" class="pf-layer-name" data-highlight-focus="${id}">Highlight ${String(index + 1).padStart(2, "0")}</button><button type="button" class="pf-layer-remove" data-highlight-remove="${id}" title="Delete highlight">×</button></div>`);
        });
        body.insertAdjacentHTML("beforeend", `<label class="pf-layer-badge-row"><span>Badge / tab</span><input type="text" data-unit-badge="${code}" value="${String(badges[code] || "").replaceAll('"', '&quot;')}" placeholder="VOS / Về ở sớm"></label>`);
        list.appendChild(group);
      });

      if (orphanLines.length || orphanShapes.length) {
        const exceptions = document.createElement("details");
        exceptions.className = "pf-layer-unit pf-layer-exceptions";
        exceptions.open = true;
        exceptions.innerHTML = `<summary><span>Exceptions</span><small>${orphanLines.length + orphanShapes.length} objects</small></summary><div></div>`;
        const body = exceptions.querySelector("div");
        orphanLines.forEach((line, index) => {
          const label = line.dataset.unitCode ? `Extra connector · ${line.dataset.unitCode}` : `Unassigned connector ${index + 1}`;
          const item = document.createElement("div");
          item.className = "pf-layer-row";
          item.innerHTML = `<span class="pf-layer-warning">!</span><button type="button" class="pf-layer-name" data-exception-line="${index}">${label}</button><button type="button" class="pf-layer-remove" data-exception-remove-line="${index}">×</button>`;
          body.appendChild(item);
        });
        orphanShapes.forEach((shape, index) => {
          const id = shape.dataset.penShapeId || "";
          const item = document.createElement("div");
          item.className = "pf-layer-row";
          item.innerHTML = `<span class="pf-layer-warning">!</span><button type="button" class="pf-layer-name" data-highlight-focus="${id}">Unassigned highlight ${index + 1}</button><button type="button" class="pf-layer-remove" data-highlight-remove="${id}">×</button>`;
          body.appendChild(item);
        });
        list.appendChild(exceptions);
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
      Array.from(overview.querySelectorAll("details[open]")).filter((node) => !node.closest(".pf-overview-layer-panel")).forEach((detail) => {
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
      const group = event.target.closest(".pf-layer-unit[data-unit-code]");
      const code = group?.dataset.unitCode || "";
      const eye = event.target.closest("[data-layer-eye]");
      const focus = event.target.closest("[data-layer-focus]");
      const remove = event.target.closest("[data-layer-remove]");
      const highlightFocus = event.target.closest("[data-highlight-focus]");
      const highlightRemove = event.target.closest("[data-highlight-remove]");
      const exceptionRemove = event.target.closest("[data-exception-remove-line]");
      const action = event.target.closest("[data-layer-action]");

      if (eye && code) {
        const normalized = eye.dataset.layerEye.startsWith("connector-") ? "connector" : eye.dataset.layerEye;
        setLayerVisible(code, normalized, Boolean(hidden[code]?.[normalized]));
      }
      if (focus && code) inspectUnit(code, focus.dataset.layerFocus);
      if (remove && code) {
        const normalized = remove.dataset.layerRemove.startsWith("connector-") ? "connector" : remove.dataset.layerRemove;
        setLayerVisible(code, normalized, false);
      }
      if (highlightFocus) window.dispatchEvent(new CustomEvent("pf-overview-select-highlight", { detail: { id: highlightFocus.dataset.highlightFocus } }));
      if (highlightRemove) window.dispatchEvent(new CustomEvent("pf-overview-delete-highlight", { detail: { id: highlightRemove.dataset.highlightRemove } }));
      if (exceptionRemove) {
        const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line"));
        const line = lines[Number(exceptionRemove.dataset.exceptionRemoveLine)];
        line?.remove();
        renderPanel();
      }
      if (action?.dataset.layerAction === "show-all") {
        Object.keys(hidden).forEach((key) => delete hidden[key]);
        saveJson(HIDDEN_KEY, hidden);
        applyHidden();
        renderPanel();
      }
      if (action?.dataset.layerAction === "edit-label") window.dispatchEvent(new CustomEvent("pf-overview-edit-map-label"));
    }

    function onPanelDoubleClick(event) {
      if (!panel?.contains(event.target)) return;
      const group = event.target.closest(".pf-layer-unit[data-unit-code]");
      const code = group?.dataset.unitCode || "";
      const focus = event.target.closest("[data-layer-focus]");
      const highlight = event.target.closest("[data-highlight-focus]");
      if (highlight) { zoomToHighlight(highlight.dataset.highlightFocus); return; }
      if (code) zoomToUnit(code, focus?.dataset.layerFocus || "anchor");
    }

    function onPanelChange(event) {
      const input = event.target.closest("[data-unit-badge]");
      if (!input) return;
      const code = input.dataset.unitBadge;
      const label = input.value.trim();
      if (label) badges[code] = label; else delete badges[code];
      saveJson(BADGE_KEY, badges);
      window.dispatchEvent(new CustomEvent("pf-overview-unit-badge-set", { detail: { code, label } }));
    }

    function onHighlightsChanged(event) {
      associateUnownedHighlights(event.detail?.selectedId || "");
      requestAnimationFrame(renderPanel);
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
    document.addEventListener("dblclick", onPanelDoubleClick);
    document.addEventListener("change", onPanelChange);
    window.addEventListener("pf-overview-live-units-ready", refreshPanel);
    window.addEventListener("pf-overview-highlights-changed", onHighlightsChanged);
    window.addEventListener("pf-overview-annotations-changed", refreshPanel);
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
      document.removeEventListener("dblclick", onPanelDoubleClick);
      document.removeEventListener("change", onPanelChange);
      window.removeEventListener("pf-overview-live-units-ready", refreshPanel);
      window.removeEventListener("pf-overview-highlights-changed", onHighlightsChanged);
      window.removeEventListener("pf-overview-annotations-changed", refreshPanel);
      window.removeEventListener("pf-overview-group-changed", refreshPanel);
      window.removeEventListener("plotflow-product-view-changed", refreshPanel);
      panel?.remove();
    };
  }, []);

  return null;
}
