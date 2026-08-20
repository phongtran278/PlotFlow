import { useEffect } from "react";
import "./OverviewZoomRuntime.css";

const MIN_SCALE = 0.7;
const MAX_SCALE = 32;
const STORAGE_KEY = "phongflow-overview-markup-v1";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadMarkup() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function OverviewZoomRuntime() {
  useEffect(() => {
    let cleanupStage = null;

    function attach(stage) {
      if (!stage || stage.dataset.pfOverviewZoomReady === "1") return;
      stage.dataset.pfOverviewZoomReady = "1";

      let scale = 1;
      let tx = 0;
      let ty = 0;
      let tool = "select";
      let stroke = 3;
      let spaceDown = false;
      let zDown = false;
      let dragging = false;
      let dragMode = "";
      let startX = 0;
      let startY = 0;
      let startTx = 0;
      let startTy = 0;
      let startScale = 1;
      let zoomAnchorX = 0;
      let zoomAnchorY = 0;
      let zoomWorldX = 0;
      let zoomWorldY = 0;
      let drawStart = null;
      let markup = loadMarkup();

      const toolbar = document.createElement("div");
      toolbar.className = "pf-overview-zoom-toolbar pf-overview-editor-toolbar";
      toolbar.innerHTML = `
        <div class="pf-editor-tools">
          <button type="button" data-tool="select" class="active" title="Select (V)">↖</button>
          <button type="button" data-tool="hand" title="Hand (H / Space)">✋</button>
          <button type="button" data-tool="zoom" title="Zoom (Z)">Z</button>
          <span class="pf-overview-zoom-divider"></span>
          <button type="button" data-tool="line" title="Line (L)">╱</button>
          <button type="button" data-tool="rect" title="Rectangle (R)">▭</button>
          <label class="pf-stroke-control" title="Stroke width"><span>Stroke</span><select><option>1</option><option>2</option><option selected>3</option><option>4</option><option>6</option><option>8</option><option>12</option></select></label>
          <button type="button" data-action="undo" title="Undo drawing">↶</button>
          <button type="button" data-action="clear" title="Clear drawings">Clear</button>
        </div>
        <div class="pf-editor-view-tools">
          <button type="button" data-action="out" title="Zoom out">−</button>
          <output>100%</output>
          <button type="button" data-action="in" title="Zoom in">+</button>
          <button type="button" data-action="fit" title="Fit view">Fit</button>
        </div>
      `;
      stage.appendChild(toolbar);

      const markupLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      markupLayer.setAttribute("class", "pf-overview-markup-layer");
      markupLayer.setAttribute("viewBox", "0 0 1000 1000");
      markupLayer.setAttribute("preserveAspectRatio", "none");
      stage.appendChild(markupLayer);

      const output = toolbar.querySelector("output");
      const strokeSelect = toolbar.querySelector("select");
      const transformTargets = () => Array.from(stage.querySelectorAll(".pf-masterplan-pdf,.pf-callout-layer,.pf-overview-coming,.pf-overview-markup-layer"));

      function renderMarkup(draft = null) {
        const items = draft ? [...markup, draft] : markup;
        markupLayer.innerHTML = items.map((item) => {
          if (item.type === "line") {
            return `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="#ff3b30" stroke-width="${item.stroke}" stroke-linecap="round" />`;
          }
          return `<rect x="${Math.min(item.x1, item.x2)}" y="${Math.min(item.y1, item.y2)}" width="${Math.abs(item.x2 - item.x1)}" height="${Math.abs(item.y2 - item.y1)}" rx="5" ry="5" fill="rgba(255,59,48,.08)" stroke="#ff3b30" stroke-width="${item.stroke}" />`;
        }).join("");
      }

      function saveMarkup() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(markup));
      }

      function apply() {
        const transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
        transformTargets().forEach((node) => {
          node.style.transformOrigin = "0 0";
          node.style.transform = transform;
          node.style.willChange = dragging ? "transform" : "auto";
        });
        output.textContent = `${Math.round(scale * 100)}%`;
        stage.style.setProperty("--pf-overview-zoom", scale);
        stage.classList.toggle("is-panning", dragMode === "pan");
        stage.classList.toggle("is-zooming", dragMode === "zoom");
        stage.classList.toggle("is-drawing", dragMode === "draw");
      }

      function setTool(next) {
        tool = next;
        toolbar.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
        stage.dataset.overviewTool = tool;
      }

      function zoomAt(clientX, clientY, nextScale) {
        const rect = stage.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const worldX = (px - tx) / scale;
        const worldY = (py - ty) / scale;
        const resolved = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        tx = px - worldX * resolved;
        ty = py - worldY * resolved;
        scale = resolved;
        apply();
      }

      function fit() {
        scale = 1;
        tx = 0;
        ty = 0;
        apply();
      }

      function pointInWorld(event) {
        const rect = stage.getBoundingClientRect();
        return {
          x: clamp((((event.clientX - rect.left) - tx) / scale / rect.width) * 1000, -5000, 5000),
          y: clamp((((event.clientY - rect.top) - ty) / scale / rect.height) * 1000, -5000, 5000),
        };
      }

      function onWheel(event) {
        if (!stage.contains(event.target)) return;
        event.preventDefault();
        const intensity = event.ctrlKey ? 0.005 : 0.0018;
        const factor = Math.exp(-event.deltaY * intensity);
        zoomAt(event.clientX, event.clientY, scale * factor);
      }

      function onPointerDown(event) {
        if (event.button !== 0 || toolbar.contains(event.target)) return;
        const wantsPan = spaceDown || tool === "hand";
        const wantsZoom = zDown || tool === "zoom";
        const wantsDraw = tool === "line" || tool === "rect";
        if (!wantsPan && !wantsZoom && !wantsDraw) return;

        event.preventDefault();
        dragging = true;
        dragMode = wantsPan ? "pan" : wantsZoom ? "zoom" : "draw";
        startX = event.clientX;
        startY = event.clientY;
        startTx = tx;
        startTy = ty;
        startScale = scale;
        stage.setPointerCapture?.(event.pointerId);

        if (dragMode === "zoom") {
          const rect = stage.getBoundingClientRect();
          zoomAnchorX = event.clientX - rect.left;
          zoomAnchorY = event.clientY - rect.top;
          zoomWorldX = (zoomAnchorX - tx) / scale;
          zoomWorldY = (zoomAnchorY - ty) / scale;
        }
        if (dragMode === "draw") drawStart = pointInWorld(event);
        apply();
      }

      function onPointerMove(event) {
        if (!dragging) return;
        if (dragMode === "pan") {
          tx = startTx + (event.clientX - startX);
          ty = startTy + (event.clientY - startY);
        } else if (dragMode === "zoom") {
          const dx = event.clientX - startX;
          const dy = event.clientY - startY;
          scale = clamp(startScale * Math.exp((dx - dy * 0.35) * 0.008), MIN_SCALE, MAX_SCALE);
          tx = zoomAnchorX - zoomWorldX * scale;
          ty = zoomAnchorY - zoomWorldY * scale;
        } else if (drawStart) {
          const end = pointInWorld(event);
          renderMarkup({ type: tool, x1: drawStart.x, y1: drawStart.y, x2: end.x, y2: end.y, stroke });
        }
        apply();
      }

      function onPointerUp(event) {
        if (!dragging) return;
        if (dragMode === "draw" && drawStart) {
          const end = pointInWorld(event);
          const distance = Math.hypot(end.x - drawStart.x, end.y - drawStart.y);
          if (distance > 2) {
            markup.push({ type: tool, x1: drawStart.x, y1: drawStart.y, x2: end.x, y2: end.y, stroke });
            saveMarkup();
          }
          drawStart = null;
          renderMarkup();
        }
        dragging = false;
        dragMode = "";
        stage.releasePointerCapture?.(event.pointerId);
        apply();
      }

      function onKeyDown(event) {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
        if (event.code === "Space") {
          spaceDown = true;
          stage.classList.add("space-hand");
          event.preventDefault();
        }
        const key = event.key.toLowerCase();
        if (key === "z") {
          zDown = true;
          stage.classList.add("key-zoom");
        }
        if (key === "h") setTool("hand");
        if (key === "v") setTool("select");
        if (key === "l") setTool("line");
        if (key === "r") setTool("rect");
        if ((event.metaKey || event.ctrlKey) && key === "z" && markup.length) {
          event.preventDefault();
          markup.pop();
          saveMarkup();
          renderMarkup();
        }
      }

      function onKeyUp(event) {
        if (event.code === "Space") {
          spaceDown = false;
          stage.classList.remove("space-hand");
        }
        if (event.key.toLowerCase() === "z") {
          zDown = false;
          stage.classList.remove("key-zoom");
        }
      }

      function onToolbarClick(event) {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.tool) setTool(button.dataset.tool);
        if (button.dataset.action === "fit") fit();
        if (button.dataset.action === "undo" && markup.length) {
          markup.pop();
          saveMarkup();
          renderMarkup();
        }
        if (button.dataset.action === "clear") {
          markup = [];
          saveMarkup();
          renderMarkup();
        }
        if (button.dataset.action === "in" || button.dataset.action === "out") {
          const rect = stage.getBoundingClientRect();
          const factor = button.dataset.action === "in" ? 1.35 : 1 / 1.35;
          zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * factor);
        }
      }

      function onStrokeChange() {
        stroke = Number(strokeSelect.value) || 3;
      }

      stage.addEventListener("wheel", onWheel, { passive: false });
      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("pointercancel", onPointerUp);
      toolbar.addEventListener("click", onToolbarClick);
      strokeSelect.addEventListener("change", onStrokeChange);
      window.addEventListener("keydown", onKeyDown, { passive: false });
      window.addEventListener("keyup", onKeyUp);
      renderMarkup();
      apply();

      cleanupStage = () => {
        stage.removeEventListener("wheel", onWheel);
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", onPointerUp);
        stage.removeEventListener("pointercancel", onPointerUp);
        toolbar.removeEventListener("click", onToolbarClick);
        strokeSelect.removeEventListener("change", onStrokeChange);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        toolbar.remove();
        markupLayer.remove();
        delete stage.dataset.pfOverviewZoomReady;
      };
    }

    function sync() {
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (stage && stage.dataset.pfOverviewZoomReady !== "1") attach(stage);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      cleanupStage?.();
    };
  }, []);

  return null;
}
