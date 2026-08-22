import { useEffect } from "react";
import "./OverviewPenRuntime.css";

const STORAGE_KEY = "phongflow-overview-pen-shapes-v1";
const STYLE_KEY = "phongflow-overview-pen-style-v2";
const LEGACY_MARKUP_KEY = "phongflow-overview-markup-v2";

const DEFAULT_STYLE = {
  fill: "#ff3b30",
  fillOpacity: 0.12,
  stroke: "#ff3b30",
  strokeWidth: 1,
  strokeOpacity: 0.92,
};

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStyle(value = {}) {
  return {
    fill: typeof value.fill === "string" ? value.fill : DEFAULT_STYLE.fill,
    fillOpacity: Math.max(0, Math.min(0.8, safeNumber(value.fillOpacity, DEFAULT_STYLE.fillOpacity))),
    stroke: typeof value.stroke === "string" ? value.stroke : DEFAULT_STYLE.stroke,
    strokeWidth: Math.max(0.5, Math.min(4, safeNumber(value.strokeWidth, DEFAULT_STYLE.strokeWidth))),
    strokeOpacity: Math.max(0.1, Math.min(1, safeNumber(value.strokeOpacity, DEFAULT_STYLE.strokeOpacity))),
  };
}

function normalizePoint(point = {}) {
  let x = safeNumber(point.x, 0);
  let y = safeNumber(point.y, 0);
  // Migrate old 0..1000 coordinates to the new 0..100 percentage model.
  if (Math.abs(x) > 100 || Math.abs(y) > 100) {
    x /= 10;
    y /= 10;
  }
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
  } catch {
    return [];
  }
}

function saveShapes(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function readStyle() {
  try {
    return normalizeStyle(JSON.parse(localStorage.getItem(STYLE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

function saveStyle(value) {
  localStorage.setItem(STYLE_KEY, JSON.stringify(normalizeStyle(value)));
}

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
    let button = null;
    let styleMenu = null;
    let cursor = null;
    let active = false;
    let draft = [];
    let hover = null;
    let shapes = readShapes();
    let currentStyle = readStyle();
    let selectedId = shapes.at(-1)?.id || null;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let disposed = false;
    let retryRaf = 0;
    let retryCount = 0;

    removeLegacyRectangles();
    saveShapes(shapes);

    function escapeAttr(value) {
      return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    }

    function pointsAttr(points) {
      return points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join(" ");
    }

    function pointDistance(a, b) {
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function closeTolerance() {
      if (!stage) return 1.6;
      const rect = stage.getBoundingClientRect();
      const screenWidth = Math.max(1, rect.width * Math.max(camera.scale, 0.0001));
      return Math.max(0.75, Math.min(2.6, (14 / screenWidth) * 100));
    }

    function cleanedDraft() {
      const tolerance = closeTolerance() * 0.35;
      const clean = [];
      draft.forEach((point) => {
        if (!clean.length || pointDistance(point, clean.at(-1)) > tolerance) clean.push(point);
      });
      if (clean.length > 3 && pointDistance(clean[0], clean.at(-1)) <= closeTolerance()) clean.pop();
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
      const label = styleMenu.querySelector("[data-pen-selection]");
      if (label) label.textContent = selectedShape() ? "Selected shape" : "New shapes";
    }

    function render() {
      if (!layer) return;
      const committed = shapes.map((shape) => {
        const style = normalizeStyle(shape.style);
        const selected = String(shape.id) === String(selectedId) ? " is-selected" : "";
        return `<polygon class="pf-pen-shape${selected}" data-pen-shape-id="${escapeAttr(shape.id)}" points="${pointsAttr(shape.points)}" fill="${style.fill}" fill-opacity="${style.fillOpacity}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-opacity="${style.strokeOpacity}" vector-effect="non-scaling-stroke" />`;
      }).join("");

      // Draft is deliberately stroke-only. Fill appears only after the path is closed.
      const fixed = draft.length >= 2
        ? `<polyline class="pf-pen-draft-fixed" points="${pointsAttr(draft)}" vector-effect="non-scaling-stroke" />`
        : "";
      const live = draft.length && hover
        ? `<line class="pf-pen-draft-live" x1="${draft.at(-1).x}" y1="${draft.at(-1).y}" x2="${hover.x}" y2="${hover.y}" vector-effect="non-scaling-stroke" />`
        : "";
      const nodes = draft.map((point, index) => `<circle class="pf-pen-node${index === 0 ? " is-first" : ""}" cx="${point.x}" cy="${point.y}" r="${index === 0 ? 0.72 : 0.55}" vector-effect="non-scaling-stroke" />`).join("");
      layer.innerHTML = committed + fixed + live + nodes;
    }

    function applyCamera() {
      if (!layer) return;
      layer.style.transformOrigin = "0 0";
      layer.style.transform = `translate3d(${camera.tx}px,${camera.ty}px,0) scale(${camera.scale})`;
    }

    function worldPoint(event) {
      if (!stage) return null;
      const rect = stage.getBoundingClientRect();
      const scale = Math.max(0.0001, camera.scale);
      const xPx = (event.clientX - rect.left - camera.tx) / scale;
      const yPx = (event.clientY - rect.top - camera.ty) / scale;
      return {
        x: Math.max(0, Math.min(100, (xPx / Math.max(1, rect.width)) * 100)),
        y: Math.max(0, Math.min(100, (yPx / Math.max(1, rect.height)) * 100)),
      };
    }

    function finish() {
      const points = cleanedDraft();
      if (points.length >= 3) {
        const shape = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          points: points.map((point) => ({ ...point })),
          style: { ...currentStyle },
        };
        shapes = [...shapes, shape];
        selectedId = shape.id;
        saveShapes(shapes);
      }
      draft = [];
      hover = null;
      render();
      syncStyleControls();
    }

    function cancelDraft() {
      draft = [];
      hover = null;
      render();
    }

    function setActive(next) {
      active = next;
      button?.classList.toggle("active", active);
      stage?.classList.toggle("pf-pen-active", active);
      cursor?.classList.toggle("active", active);
      if (!active) cancelDraft();
    }

    function selectShape(id) {
      selectedId = id || null;
      render();
      syncStyleControls();
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
    }

    function onPointerDown(event) {
      if (!active || event.button !== 0 || !stage?.contains(event.target)) return;
      if (event.target.closest?.(".pf-overview-control-rail,.pf-overview-zoom-toolbar,.pf-unit-navigator,.pf-overview-v2-controls,.pf-pen-style-menu")) return;
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
      if (draft.length >= 3 && pointDistance(point, draft[0]) <= closeTolerance()) {
        finish();
        return;
      }
      draft.push(point);
      hover = point;
      render();
    }

    function onDoubleClick(event) {
      if (!active || draft.length < 3) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      finish();
    }

    function onPointerMove(event) {
      if (!active || !stage) return;
      if (draft.length) {
        hover = worldPoint(event);
        render();
      }
      if (cursor) {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      }
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
      if (event.key === "Enter") { event.preventDefault(); finish(); }
      if (event.key === "Escape") { event.preventDefault(); cancelDraft(); setActive(false); }
      if ((event.key === "Backspace" || event.key === "Delete") && draft.length) {
        event.preventDefault();
        draft.pop();
        hover = draft.at(-1) || null;
        render();
      } else if ((event.key === "Backspace" || event.key === "Delete") && selectedShape()) {
        event.preventDefault();
        shapes = shapes.filter((shape) => String(shape.id) !== String(selectedId));
        selectedId = shapes.at(-1)?.id || null;
        saveShapes(shapes);
        render();
        syncStyleControls();
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
      hover = null;
      selectedId = null;
      saveShapes(shapes);
      render();
      syncStyleControls();
    }

    function detachStage() {
      stage?.removeEventListener("pointerdown", onPointerDown, true);
      stage?.removeEventListener("dblclick", onDoubleClick, true);
      stage?.removeEventListener("pointermove", onPointerMove, true);
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      detachStage();
      stage = nextStage;
      layer?.remove();
      cursor?.remove();

      layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      layer.setAttribute("class", "pf-overview-pen-layer");
      layer.setAttribute("viewBox", "0 0 100 100");
      layer.setAttribute("preserveAspectRatio", "none");
      layer.setAttribute("aria-label", "Highlight polygon layer");
      stage.appendChild(layer);
      applyCamera();
      render();

      cursor = document.createElement("div");
      cursor.className = "pf-pen-cursor";
      document.body.appendChild(cursor);
      cursor.classList.toggle("active", active);

      stage.addEventListener("pointerdown", onPointerDown, true);
      stage.addEventListener("dblclick", onDoubleClick, true);
      stage.addEventListener("pointermove", onPointerMove, true);
    }

    function installButton() {
      const tools = document.querySelector(".pf-overview-zoom-toolbar .pf-editor-tools");
      if (!tools) return false;
      tools.querySelector('[data-tool="rect"]')?.remove();

      if (!button?.isConnected) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "pf-pen-tool-button";
        button.title = "Highlight Pen (P) · click anchor points · click first point / double-click / Enter to close";
        button.setAttribute("aria-label", "Highlight Pen polygon tool");
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
        styleMenu.innerHTML = `
          <summary title="Highlight appearance">Style</summary>
          <div class="pf-pen-style-popover">
            <header><strong>Highlight style</strong><span data-pen-selection>New shapes</span></header>
            <label><span>Fill</span><input data-pen-style="fill" type="color"></label>
            <label><span>Fill opacity</span><input data-pen-style="fillOpacity" type="range" min="0" max="0.8" step="0.02"></label>
            <label><span>Stroke</span><input data-pen-style="stroke" type="color"></label>
            <label><span>Stroke width</span><input data-pen-style="strokeWidth" type="range" min="0.5" max="4" step="0.25"></label>
            <label><span>Stroke opacity</span><input data-pen-style="strokeOpacity" type="range" min="0.1" max="1" step="0.05"></label>
            <small>Pen style is independent from Connector.</small>
          </div>`;
        styleMenu.addEventListener("input", (event) => {
          const key = event.target?.dataset?.penStyle;
          if (!key) return;
          const numeric = ["fillOpacity", "strokeWidth", "strokeOpacity"].includes(key);
          applyStylePatch({ [key]: numeric ? Number(event.target.value) : event.target.value });
        });
        button.after(styleMenu);
      }
      syncStyleControls();
      return true;
    }

    function sync() {
      if (disposed) return true;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      const hasButton = installButton();
      return Boolean(nextStage && hasButton);
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
    window.addEventListener("pf-overview-live-units-ready", syncWithRetry);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-clear-highlights", onClearHighlights);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      disposed = true;
      cancelAnimationFrame(retryRaf);
      window.removeEventListener("pf-overview-live-units-ready", syncWithRetry);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-clear-highlights", onClearHighlights);
      window.removeEventListener("keydown", onKeyDown, true);
      detachStage();
      layer?.remove();
      cursor?.remove();
      button?.remove();
      styleMenu?.remove();
    };
  }, []);

  return null;
}
