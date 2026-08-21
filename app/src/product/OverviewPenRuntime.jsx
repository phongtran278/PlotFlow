import { useEffect } from "react";
import "./OverviewPenRuntime.css";

const STORAGE_KEY = "phongflow-overview-pen-shapes-v1";

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

export default function OverviewPenRuntime() {
  useEffect(() => {
    let stage = null;
    let layer = null;
    let button = null;
    let cursor = null;
    let observer = null;
    let active = false;
    let draft = [];
    let hover = null;
    let shapes = readShapes();
    let camera = { scale: 1, tx: 0, ty: 0 };

    function pointsAttr(points) {
      return points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" ");
    }

    function render() {
      if (!layer) return;
      const committed = shapes.map((shape) => `<polygon points="${pointsAttr(shape.points)}" vector-effect="non-scaling-stroke" />`).join("");
      const previewPoints = draft.length ? [...draft, ...(hover ? [hover] : [])] : [];
      const preview = previewPoints.length >= 2 ? `<polyline class="pf-pen-draft" points="${pointsAttr(previewPoints)}" vector-effect="non-scaling-stroke" />` : "";
      const nodes = draft.map((point) => `<circle class="pf-pen-node" cx="${point.x}" cy="${point.y}" r="3.5" vector-effect="non-scaling-stroke" />`).join("");
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
      if (draft.length >= 3) {
        shapes = [...shapes, { id: Date.now(), points: draft.map((point) => ({ ...point })) }];
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
      draft.push(point);
      hover = point;
      render();
    }

    function onDoubleClick(event) {
      if (!active) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (draft.length > 3) draft.pop();
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
      if (event.key.toLowerCase() === "p") { event.preventDefault(); setActive(!active); return; }
      if (!active) return;
      if (event.key === "Enter") { event.preventDefault(); finish(); }
      if (event.key === "Escape") { event.preventDefault(); cancelDraft(); setActive(false); }
      if (event.key === "Backspace" && draft.length) { event.preventDefault(); draft.pop(); render(); }
    }

    function onCamera(event) {
      const detail = event.detail || {};
      if (Number.isFinite(detail.scale)) camera.scale = detail.scale;
      if (Number.isFinite(detail.tx)) camera.tx = detail.tx;
      if (Number.isFinite(detail.ty)) camera.ty = detail.ty;
      applyCamera();
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
      if (!tools || button?.isConnected) return;
      button = document.createElement("button");
      button.type = "button";
      button.className = "pf-pen-tool-button";
      button.title = "Pen / Polygon (P) · click points, Enter or double-click to finish";
      button.setAttribute("aria-label", "Pen polygon tool");
      button.textContent = "✒";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActive(!active);
      });
      const rectButton = tools.querySelector('[data-tool="rect"]');
      rectButton?.after(button);
      if (!rectButton) tools.appendChild(button);
    }

    function sync() {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      installButton();
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("keydown", onKeyDown, true);
      detachStage();
      layer?.remove();
      cursor?.remove();
      button?.remove();
    };
  }, []);

  return null;
}
