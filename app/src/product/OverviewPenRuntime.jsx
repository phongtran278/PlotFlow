import { useEffect } from "react";
import "./OverviewPenRuntime.css";

const STORAGE_KEY = "phongflow-overview-pen-shapes-v1";
const LEGACY_MARKUP_KEY = "phongflow-overview-markup-v2";

function readShapes() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveShapes(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
    let cursor = null;
    let active = false;
    let draft = [];
    let hover = null;
    let shapes = readShapes();
    let camera = { scale: 1, tx: 0, ty: 0 };
    let disposed = false;
    let retryRaf = 0;
    let retryCount = 0;

    removeLegacyRectangles();

    function pointsAttr(points) {
      return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" ");
    }

    function pointDistance(a, b) {
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function closeTolerance() {
      if (!stage) return 12;
      const rect = stage.getBoundingClientRect();
      return Math.max(5, (14 / Math.max(1, rect.width * Math.max(camera.scale, 0.0001))) * 1000);
    }

    function cleanedDraft() {
      const tolerance = closeTolerance() * 0.45;
      const clean = [];
      draft.forEach((point) => {
        if (!clean.length || pointDistance(point, clean.at(-1)) > tolerance) clean.push(point);
      });
      if (clean.length > 3 && pointDistance(clean[0], clean.at(-1)) <= closeTolerance()) clean.pop();
      return clean;
    }

    function render() {
      if (!layer) return;
      const committed = shapes.map((shape) => `<polygon points="${pointsAttr(shape.points)}" vector-effect="non-scaling-stroke" />`).join("");
      const previewPoints = draft.length ? [...draft, ...(hover ? [hover] : [])] : [];
      const preview = previewPoints.length >= 2 ? `<polyline class="pf-pen-draft" points="${pointsAttr(previewPoints)}" vector-effect="non-scaling-stroke" />` : "";
      const nodes = draft.map((point, index) => `<circle class="pf-pen-node${index === 0 ? " is-first" : ""}" cx="${point.x}" cy="${point.y}" r="${index === 0 ? 4.4 : 3.4}" vector-effect="non-scaling-stroke" />`).join("");
      layer.innerHTML = committed + preview + nodes;
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
        x: Math.max(0, Math.min(1000, (xPx / Math.max(1, rect.width)) * 1000)),
        y: Math.max(0, Math.min(1000, (yPx / Math.max(1, rect.height)) * 1000)),
      };
    }

    function finish() {
      const points = cleanedDraft();
      if (points.length >= 3) {
        shapes = [...shapes, { id: Date.now(), points: points.map((point) => ({ ...point })) }];
        saveShapes(shapes);
      }
      draft = [];
      hover = null;
      render();
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

    function onPointerDown(event) {
      if (!active || event.button !== 0 || !stage?.contains(event.target)) return;
      if (event.target.closest?.(".pf-overview-control-rail,.pf-overview-zoom-toolbar,.pf-unit-navigator,.pf-overview-v2-controls")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const point = worldPoint(event);
      if (!point) return;

      // Illustrator-like close: once there are 3+ points, click the first point to close the polygon.
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
      const point = worldPoint(event);
      if (draft.length) {
        hover = point;
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

      // Rectangle is retired. Block the old R shortcut before OverviewZoomRuntime sees it.
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
      if (event.key === "Backspace" && draft.length) { event.preventDefault(); draft.pop(); hover = draft.at(-1) || null; render(); }
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
      saveShapes(shapes);
      render();
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
      layer.setAttribute("viewBox", "0 0 1000 1000");
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

      // Remove the legacy rectangle UI completely.
      tools.querySelector('[data-tool="rect"]')?.remove();

      if (!button?.isConnected) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "pf-pen-tool-button";
        button.title = "Highlight Pen (P) · click points · click first point / double-click / Enter to close";
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
    };
  }, []);

  return null;
}
