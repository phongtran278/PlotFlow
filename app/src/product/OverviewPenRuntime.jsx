import { useEffect } from "react";
import "./OverviewPenRuntime.css";

const STORAGE_KEY = "phongflow-overview-pen-shapes-v1";
const STYLE_KEY = "phongflow-overview-pen-style-v4";
const LEGACY_MARKUP_KEY = "phongflow-overview-markup-v2";

const DEFAULT_STYLE = {
  fill: "#ff3b30",
  fillOpacity: 0.7,
  outline: false,
  stroke: "#ff3b30",
  strokeWidth: 0.25,
  strokeOpacity: 0.82,
};

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStyle(value = {}) {
  const rawWidth = safeNumber(value.strokeWidth, DEFAULT_STYLE.strokeWidth);
  const migratedWidth = Math.abs(rawWidth - 1) < 0.001 ? DEFAULT_STYLE.strokeWidth : rawWidth;
  return {
    fill: typeof value.fill === "string" ? value.fill : DEFAULT_STYLE.fill,
    fillOpacity: Math.max(0, Math.min(1, safeNumber(value.fillOpacity, DEFAULT_STYLE.fillOpacity))),
    outline: value.outline === true,
    stroke: typeof value.stroke === "string" ? value.stroke : DEFAULT_STYLE.stroke,
    strokeWidth: Math.max(0.15, Math.min(2, migratedWidth)),
    strokeOpacity: Math.max(0.1, Math.min(1, safeNumber(value.strokeOpacity, DEFAULT_STYLE.strokeOpacity))),
  };
}

function normalizePoint(point = {}) {
  let x = safeNumber(point.x, 0);
  let y = safeNumber(point.y, 0);
  if (Math.abs(x) > 100 || Math.abs(y) > 100) { x /= 10; y /= 10; }
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function readShapes() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((shape) => Array.isArray(shape?.points) && shape.points.length >= 3)
      .map((shape) => ({
        id: shape.id || `${Date.now()}-${Math.random()}`,
        points: shape.points.map(normalizePoint),
        style: normalizeStyle(shape.style),
      }));
  } catch { return []; }
}

function saveShapes(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
function readStyle() {
  try { return normalizeStyle(JSON.parse(localStorage.getItem(STYLE_KEY) || "{}")); }
  catch { return { ...DEFAULT_STYLE }; }
}
function saveStyle(value) { localStorage.setItem(STYLE_KEY, JSON.stringify(normalizeStyle(value))); }

function removeLegacyRectangles() {
  try {
    const items = JSON.parse(localStorage.getItem(LEGACY_MARKUP_KEY) || "[]");
    if (!Array.isArray(items)) return;
    const next = items.filter((item) => item?.type !== "rect");
    if (next.length !== items.length) localStorage.setItem(LEGACY_MARKUP_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export default function OverviewPenRuntime() {
  useEffect(() => {
    let stage = null;
    let layer = null;
    let anchorLayer = null;
    let button = null;
    let styleMenu = null;
    let cursor = null;
    let active = false;
    let draft = [];
    let vertexDrag = null;
    let shapes = readShapes();
    let currentStyle = readStyle();
    let selectedId = shapes.at(-1)?.id || null;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let disposed = false;
    let retryRaf = 0;
    let retryCount = 0;
    let domObserver = null;

    removeLegacyRectangles();
    saveShapes(shapes);

    const escapeAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const pointsAttr = (points) => points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join(" ");
    const pointDistance = (a, b) => (!a || !b) ? Number.POSITIVE_INFINITY : Math.hypot(a.x - b.x, a.y - b.y);

    function emitHighlightsChanged() {
      window.dispatchEvent(new CustomEvent("pf-overview-highlights-changed", { detail: { count: shapes.length, selectedId } }));
    }

    function cleanedDraft() {
      const clean = [];
      draft.forEach((point) => { if (!clean.length || pointDistance(point, clean.at(-1)) > 0.01) clean.push(point); });
      return clean;
    }

    function selectedShape() {
      return shapes.find((shape) => String(shape.id) === String(selectedId)) || null;
    }

    function syncStyleControls() {
      if (!styleMenu) return;
      const style = selectedShape()?.style || currentStyle;
      const set = (name, value) => {
        const input = styleMenu.querySelector(`[data-pen-style="${name}"]`);
        if (input && String(input.value) !== String(value)) input.value = String(value);
      };
      set("fill", style.fill);
      set("fillOpacity", style.fillOpacity);
      set("stroke", style.stroke);
      set("strokeWidth", style.strokeWidth);
      set("strokeOpacity", style.strokeOpacity);
      const outline = styleMenu.querySelector('[data-pen-style="outline"]');
      if (outline) outline.checked = Boolean(style.outline);
      const label = styleMenu.querySelector("[data-pen-selection]");
      if (label) label.textContent = selectedShape() ? "Selected shape" : "New shapes";
      styleMenu.classList.toggle("has-selection", Boolean(selectedShape()));
      styleMenu.classList.toggle("has-outline", Boolean(style.outline));
    }

    function screenPoint(point) {
      if (!stage || !point) return { x: 0, y: 0 };
      const scale = Math.max(camera.scale, 0.0001);
      return {
        x: camera.tx + (point.x / 100) * stage.clientWidth * scale,
        y: camera.ty + (point.y / 100) * stage.clientHeight * scale,
      };
    }

    function worldPoint(event) {
      if (!stage) return null;
      const rect = stage.getBoundingClientRect();
      const scale = Math.max(0.0001, camera.scale);
      const xPx = (event.clientX - rect.left - camera.tx) / scale;
      const yPx = (event.clientY - rect.top - camera.ty) / scale;
      return {
        x: Math.max(0, Math.min(100, (xPx / Math.max(1, stage.clientWidth)) * 100)),
        y: Math.max(0, Math.min(100, (yPx / Math.max(1, stage.clientHeight)) * 100)),
      };
    }

    function updateSelectedVertex(index, point) {
      const shapeIndex = shapes.findIndex((shape) => String(shape.id) === String(selectedId));
      if (shapeIndex < 0 || !point) return;
      const shape = shapes[shapeIndex];
      const points = shape.points.map((current, pointIndex) => pointIndex === index ? normalizePoint(point) : current);
      shapes = shapes.map((item, indexShape) => indexShape === shapeIndex ? { ...shape, points } : item);
      saveShapes(shapes);
      render();
      emitHighlightsChanged();
    }

    function renderAnchors() {
      if (!anchorLayer) return;
      anchorLayer.innerHTML = "";
      if (draft.length) {
        draft.forEach((point, index) => {
          const pos = screenPoint(point);
          const closable = index === 0 && draft.length >= 3;
          const node = document.createElement(closable ? "button" : "i");
          if (closable) node.type = "button";
          node.className = `pf-pen-screen-anchor${index === 0 ? " is-first" : ""}${closable ? " is-closable" : ""}`;
          node.style.left = `${pos.x}px`;
          node.style.top = `${pos.y}px`;
          if (closable) {
            node.title = "Close highlight";
            node.setAttribute("aria-label", "Close highlight at first point");
            node.addEventListener("pointerdown", (event) => {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation?.();
              finish();
            });
          }
          anchorLayer.appendChild(node);
        });
        return;
      }

      const selected = selectedShape();
      if (!selected) return;
      selected.points.forEach((point, index) => {
        const pos = screenPoint(point);
        const node = document.createElement("button");
        node.type = "button";
        node.className = "pf-pen-edit-anchor";
        node.dataset.vertexIndex = String(index);
        node.style.left = `${pos.x}px`;
        node.style.top = `${pos.y}px`;
        node.title = `Anchor ${index + 1} · drag to refine`;
        node.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          vertexDrag = { index, pointerId: event.pointerId, node };
          node.classList.add("is-dragging");
          node.setPointerCapture?.(event.pointerId);
        });
        anchorLayer.appendChild(node);
      });
    }

    function render() {
      if (!layer) return;
      layer.innerHTML = shapes.map((shape) => {
        const style = normalizeStyle(shape.style);
        const selected = String(shape.id) === String(selectedId) ? " is-selected" : "";
        return `<polygon class="pf-pen-shape${selected}" data-pen-shape-id="${escapeAttr(shape.id)}" points="${pointsAttr(shape.points)}" fill="${style.fill}" fill-opacity="${style.fillOpacity}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-opacity="${style.outline ? style.strokeOpacity : 0}" vector-effect="non-scaling-stroke" />`;
      }).join("");
      renderAnchors();
    }

    function applyCamera() {
      if (!layer) return;
      layer.style.transformOrigin = "0 0";
      layer.style.transform = `translate3d(${camera.tx}px,${camera.ty}px,0) scale(${camera.scale})`;
      renderAnchors();
    }

    function finish() {
      const points = cleanedDraft();
      if (points.length >= 3) {
        const shape = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          points: points.map((point) => ({ ...point })),
          style: { ...currentStyle, outline: false },
        };
        shapes = [...shapes, shape];
        selectedId = shape.id;
        saveShapes(shapes);
        emitHighlightsChanged();
      }
      draft = [];
      render();
      syncStyleControls();
    }

    function cancelDraft() {
      draft = [];
      render();
    }

    function setActive(next) {
      active = next;
      button?.classList.toggle("active", active);
      stage?.classList.toggle("pf-pen-active", active);
      cursor?.classList.toggle("active", active);
      styleMenu?.classList.toggle("is-contextual", active || Boolean(selectedShape()));
      if (!active) cancelDraft();
      else renderAnchors();
    }

    function selectShape(id) {
      selectedId = id || null;
      render();
      syncStyleControls();
      styleMenu?.classList.toggle("is-contextual", active || Boolean(selectedShape()));
      emitHighlightsChanged();
    }

    function deleteShape(id) {
      if (!id) return;
      const before = shapes.length;
      shapes = shapes.filter((shape) => String(shape.id) !== String(id));
      if (shapes.length === before) return;
      if (String(selectedId) === String(id)) selectedId = shapes.at(-1)?.id || null;
      saveShapes(shapes);
      render();
      syncStyleControls();
      styleMenu?.classList.toggle("is-contextual", active || Boolean(selectedShape()));
      emitHighlightsChanged();
    }

    function applyStylePatch(patch) {
      const next = normalizeStyle({ ...(selectedShape()?.style || currentStyle), ...patch });
      const index = shapes.findIndex((shape) => String(shape.id) === String(selectedId));
      if (index >= 0) {
        shapes = shapes.map((shape, shapeIndex) => shapeIndex === index ? { ...shape, style: next } : shape);
        saveShapes(shapes);
      } else {
        currentStyle = next;
        saveStyle(currentStyle);
      }
      render();
      syncStyleControls();
      emitHighlightsChanged();
    }

    function onPointerDown(event) {
      if (!active || event.button !== 0 || !stage?.contains(event.target)) return;
      if (event.target.closest?.(".pf-overview-control-rail,.pf-overview-zoom-toolbar,.pf-unit-navigator,.pf-overview-v2-controls,.pf-pen-style-menu,.pf-pen-screen-anchor-layer")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const shapeNode = event.target.closest?.("[data-pen-shape-id]");
      if (shapeNode) {
        selectShape(shapeNode.dataset.penShapeId);
        return;
      }

      const point = worldPoint(event);
      if (!point) return;
      draft.push(point);
      renderAnchors();
    }

    function onDoubleClick(event) {
      if (!active || draft.length < 3) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      finish();
    }

    function onPointerMove(event) {
      if (vertexDrag && event.pointerId === vertexDrag.pointerId) {
        event.preventDefault();
        updateSelectedVertex(vertexDrag.index, worldPoint(event));
        return;
      }
      if (!active || !stage) return;
      if (cursor) {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      }
    }

    function onPointerUp(event) {
      if (!vertexDrag || event.pointerId !== vertexDrag.pointerId) return;
      vertexDrag.node?.classList.remove("is-dragging");
      vertexDrag.node?.releasePointerCapture?.(event.pointerId);
      vertexDrag = null;
      saveShapes(shapes);
      emitHighlightsChanged();
    }

    function onKeyDown(event) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (key === "r" && stage) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }
      if (key === "p") {
        event.preventDefault();
        event.stopPropagation();
        setActive(!active);
        return;
      }
      if (!active) return;
      if (event.key === "Enter") {
        event.preventDefault();
        finish();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelDraft();
        setActive(false);
      }
      if ((event.key === "Backspace" || event.key === "Delete") && draft.length) {
        event.preventDefault();
        draft.pop();
        renderAnchors();
      } else if ((event.key === "Backspace" || event.key === "Delete") && selectedShape()) {
        event.preventDefault();
        deleteShape(selectedId);
      }
    }

    function onCamera(event) {
      const detail = event.detail || {};
      if (Number.isFinite(detail.scale)) camera.scale = detail.scale;
      if (Number.isFinite(detail.tx)) camera.tx = detail.tx;
      if (Number.isFinite(detail.ty)) camera.ty = detail.ty;
      applyCamera();
    }

    function onClearHighlights() {
      shapes = [];
      draft = [];
      selectedId = null;
      saveShapes(shapes);
      render();
      syncStyleControls();
      styleMenu?.classList.toggle("is-contextual", active);
      emitHighlightsChanged();
    }

    function onSelectHighlight(event) {
      const id = event.detail?.id;
      if (!id) return;
      selectShape(id);
      setActive(true);
      styleMenu?.setAttribute("open", "");
    }

    function onDeleteHighlight(event) {
      deleteShape(event.detail?.id);
    }

    function detachStage() {
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("dblclick", onDoubleClick, true);
      stage?.removeEventListener("pointermove", onPointerMove, true);
      stage?.removeEventListener("pointerup", onPointerUp, true);
      stage?.removeEventListener("pointercancel", onPointerUp, true);
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      detachStage();
      stage = nextStage;
      layer?.remove();
      anchorLayer?.remove();
      cursor?.remove();

      layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      layer.setAttribute("class", "pf-overview-pen-layer");
      layer.setAttribute("viewBox", "0 0 100 100");
      layer.setAttribute("preserveAspectRatio", "none");
      layer.setAttribute("aria-label", "Highlight polygon layer");
      stage.appendChild(layer);

      anchorLayer = document.createElement("div");
      anchorLayer.className = "pf-pen-screen-anchor-layer";
      stage.appendChild(anchorLayer);

      applyCamera();
      render();
      emitHighlightsChanged();

      cursor = document.createElement("div");
      cursor.className = "pf-pen-cursor";
      document.body.appendChild(cursor);
      cursor.classList.toggle("active", active);

      stage.addEventListener("pointerdown", onPointerDown, true);
      stage.addEventListener("dblclick", onDoubleClick, true);
      stage.addEventListener("pointermove", onPointerMove, true);
      stage.addEventListener("pointerup", onPointerUp, true);
      stage.addEventListener("pointercancel", onPointerUp, true);
    }

    function installButton() {
      const tools = document.querySelector(".pf-overview-zoom-toolbar .pf-editor-tools");
      if (!tools) return false;
      tools.querySelector('[data-tool="rect"]')?.remove();

      if (!button?.isConnected) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "pf-pen-tool-button";
        button.title = "Highlight area (P) · click corners, then click the first point to close";
        button.setAttribute("aria-label", "Highlight area polygon tool");
        button.innerHTML = `<span>✒</span><b>Highlight</b>`;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setActive(!active);
        });
        const divider = tools.querySelector(".pf-overview-zoom-divider");
        divider?.after(button);
        if (!divider) tools.appendChild(button);
      }

      if (!styleMenu?.isConnected) {
        styleMenu = document.createElement("details");
        styleMenu.className = "pf-pen-style-menu";
        styleMenu.innerHTML = `<summary title="Highlight appearance">Highlight style</summary><div class="pf-pen-style-popover"><header><strong>Highlight style</strong><span data-pen-selection>New shapes</span></header><label><span>Fill</span><input data-pen-style="fill" type="color"></label><label><span>Fill opacity</span><input data-pen-style="fillOpacity" type="range" min="0" max="1" step="0.01"></label><label title="Show an outline around the highlight"><span>Outline</span><input data-pen-style="outline" type="checkbox"></label><label><span>Outline color</span><input data-pen-style="stroke" type="color"></label><label><span>Outline width</span><input data-pen-style="strokeWidth" type="range" min="0.15" max="1" step="0.05"></label><label><span>Outline opacity</span><input data-pen-style="strokeOpacity" type="range" min="0.1" max="1" step="0.05"></label><small>Click any number of corners, then click the first anchor to close the filled shape. Outline stays off until you enable it.</small></div>`;
        styleMenu.addEventListener("input", (event) => {
          const key = event.target?.dataset?.penStyle;
          if (!key) return;
          if (key === "outline") {
            applyStylePatch({ outline: Boolean(event.target.checked) });
            return;
          }
          const numeric = ["fillOpacity", "strokeWidth", "strokeOpacity"].includes(key);
          applyStylePatch({ [key]: numeric ? Number(event.target.value) : event.target.value });
        });
        styleMenu.addEventListener("toggle", () => {
          if (!styleMenu.open) return;
          requestAnimationFrame(() => {
            const summary = styleMenu.querySelector(":scope > summary");
            const popover = styleMenu.querySelector(".pf-pen-style-popover");
            if (!summary || !popover) return;
            const trigger = summary.getBoundingClientRect();
            const panel = popover.getBoundingClientRect();
            const left = Math.max(12, Math.min(window.innerWidth - panel.width - 12, trigger.right - panel.width));
            const top = Math.max(12, Math.min(window.innerHeight - panel.height - 12, trigger.bottom + 8));
            popover.style.setProperty("--pf-pen-popover-left", `${left}px`);
            popover.style.setProperty("--pf-pen-popover-top", `${top}px`);
          });
        });
        button.after(styleMenu);
        syncStyleControls();
        styleMenu.classList.toggle("is-contextual", active || Boolean(selectedShape()));
      }
      return true;
    }

    function sync() {
      if (disposed) return true;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      return Boolean(nextStage && installButton());
    }

    function syncWithRetry() {
      cancelAnimationFrame(retryRaf);
      retryCount = 0;
      const attempt = () => {
        if (disposed || sync()) return;
        retryCount += 1;
        if (retryCount < 60) retryRaf = requestAnimationFrame(attempt);
      };
      attempt();
    }

    syncWithRetry();
    domObserver = new MutationObserver(() => {
      if (!button?.isConnected || !styleMenu?.isConnected || !layer?.isConnected) syncWithRetry();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", syncWithRetry);
    window.addEventListener("pf-overview-group-changed", syncWithRetry);
    window.addEventListener("plotflow-product-view-changed", syncWithRetry);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-clear-highlights", onClearHighlights);
    window.addEventListener("pf-overview-select-highlight", onSelectHighlight);
    window.addEventListener("pf-overview-delete-highlight", onDeleteHighlight);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      disposed = true;
      cancelAnimationFrame(retryRaf);
      domObserver?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", syncWithRetry);
      window.removeEventListener("pf-overview-group-changed", syncWithRetry);
      window.removeEventListener("plotflow-product-view-changed", syncWithRetry);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-clear-highlights", onClearHighlights);
      window.removeEventListener("pf-overview-select-highlight", onSelectHighlight);
      window.removeEventListener("pf-overview-delete-highlight", onDeleteHighlight);
      window.removeEventListener("keydown", onKeyDown, true);
      detachStage();
      layer?.remove();
      anchorLayer?.remove();
      cursor?.remove();
      button?.remove();
      styleMenu?.remove();
    };
  }, []);

  return null;
}
