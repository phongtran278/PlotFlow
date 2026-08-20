import { useEffect } from "react";
import "./OverviewZoomRuntime.css";

const MIN_SCALE = 0.7;
const MAX_SCALE = 6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

      const toolbar = document.createElement("div");
      toolbar.className = "pf-overview-zoom-toolbar";
      toolbar.innerHTML = `
        <button type="button" data-tool="select" class="active" title="Select (V)">↖</button>
        <button type="button" data-tool="hand" title="Hand (H / Space)">✋</button>
        <button type="button" data-tool="zoom" title="Zoom (Z)">Z</button>
        <span class="pf-overview-zoom-divider"></span>
        <button type="button" data-action="out" title="Zoom out">−</button>
        <output>100%</output>
        <button type="button" data-action="in" title="Zoom in">+</button>
        <button type="button" data-action="fit" title="Fit view">Fit</button>
      `;
      stage.appendChild(toolbar);

      const output = toolbar.querySelector("output");
      const transformTargets = () => Array.from(stage.querySelectorAll(".pf-masterplan-pdf,.pf-callout-layer,.pf-overview-coming"));

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

      function onWheel(event) {
        if (!stage.contains(event.target)) return;
        event.preventDefault();
        const intensity = event.ctrlKey ? 0.005 : 0.0018;
        const factor = Math.exp(-event.deltaY * intensity);
        zoomAt(event.clientX, event.clientY, scale * factor);
      }

      function onPointerDown(event) {
        if (event.button !== 0) return;
        const wantsPan = spaceDown || tool === "hand";
        const wantsZoom = zDown || tool === "zoom";
        if (!wantsPan && !wantsZoom) return;

        event.preventDefault();
        dragging = true;
        dragMode = wantsPan ? "pan" : "zoom";
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
        apply();
      }

      function onPointerMove(event) {
        if (!dragging) return;
        if (dragMode === "pan") {
          tx = startTx + (event.clientX - startX);
          ty = startTy + (event.clientY - startY);
        } else {
          const dx = event.clientX - startX;
          const dy = event.clientY - startY;
          scale = clamp(startScale * Math.exp((dx - dy * 0.35) * 0.008), MIN_SCALE, MAX_SCALE);
          tx = zoomAnchorX - zoomWorldX * scale;
          ty = zoomAnchorY - zoomWorldY * scale;
        }
        apply();
      }

      function onPointerUp(event) {
        if (!dragging) return;
        dragging = false;
        dragMode = "";
        stage.releasePointerCapture?.(event.pointerId);
        apply();
      }

      function onKeyDown(event) {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        if (event.code === "Space") {
          spaceDown = true;
          stage.classList.add("space-hand");
          event.preventDefault();
        }
        if (event.key.toLowerCase() === "z") {
          zDown = true;
          stage.classList.add("key-zoom");
        }
        if (event.key.toLowerCase() === "h") setTool("hand");
        if (event.key.toLowerCase() === "v") setTool("select");
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
        if (button.dataset.action === "in" || button.dataset.action === "out") {
          const rect = stage.getBoundingClientRect();
          const factor = button.dataset.action === "in" ? 1.22 : 1 / 1.22;
          zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * factor);
        }
      }

      stage.addEventListener("wheel", onWheel, { passive: false });
      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("pointercancel", onPointerUp);
      toolbar.addEventListener("click", onToolbarClick);
      window.addEventListener("keydown", onKeyDown, { passive: false });
      window.addEventListener("keyup", onKeyUp);
      apply();

      cleanupStage = () => {
        stage.removeEventListener("wheel", onWheel);
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", onPointerUp);
        stage.removeEventListener("pointercancel", onPointerUp);
        toolbar.removeEventListener("click", onToolbarClick);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        toolbar.remove();
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
