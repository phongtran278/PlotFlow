import { useEffect } from "react";
import "./WorkspaceGeometryFix.css";

const ARTWORK_WIDTH = 1080;
const ARTWORK_HEIGHT = 1920;
const EDGE_PAD = 40;

function findScroller() {
  return document.querySelector(
    ".component-stage:not(.layout-studio-mode):not(.finetune-mode) .round1-canvas .studio-canvas-scroll"
  );
}

function readScale(viewport) {
  const datasetZoom = Number(viewport?.dataset?.workspaceZoom);
  if (Number.isFinite(datasetZoom) && datasetZoom > 0) return datasetZoom / 100;
  const cssZoom = Number.parseFloat(viewport ? getComputedStyle(viewport).getPropertyValue("--studio-zoom") : "");
  return Number.isFinite(cssZoom) && cssZoom > 0 ? cssZoom : 0.38;
}

function ensureSpacer(scroller) {
  let spacer = scroller.querySelector(":scope > .workspace-real-spacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.className = "workspace-real-spacer";
    spacer.setAttribute("aria-hidden", "true");
    scroller.prepend(spacer);
  }
  return spacer;
}

function syncGeometry() {
  const scroller = findScroller();
  const viewport = scroller?.querySelector(":scope > .studio-poster-viewport");
  if (!scroller || !viewport) return;

  const spacer = ensureSpacer(scroller);
  const scale = readScale(viewport);
  const artworkW = Math.round(ARTWORK_WIDTH * scale);
  const artworkH = Math.round(ARTWORK_HEIGHT * scale);

  // Use a real layout box instead of a pseudo-element. Chromium on Windows,
  // especially through display scaling / remote sessions, reports real DOM
  // scroll geometry much more consistently.
  const contentW = Math.max(scroller.clientWidth, artworkW + EDGE_PAD * 2);
  const contentH = Math.max(scroller.clientHeight, artworkH + EDGE_PAD * 2);
  spacer.style.width = `${contentW}px`;
  spacer.style.height = `${contentH}px`;

  const left = artworkW + EDGE_PAD * 2 <= scroller.clientWidth
    ? Math.round((scroller.clientWidth - artworkW) / 2)
    : EDGE_PAD;
  const top = artworkH + EDGE_PAD * 2 <= scroller.clientHeight
    ? Math.round((scroller.clientHeight - artworkH) / 2)
    : EDGE_PAD;

  viewport.style.setProperty("left", `${Math.max(0, left)}px`, "important");
  viewport.style.setProperty("top", `${Math.max(0, top)}px`, "important");
  viewport.style.setProperty("width", `${artworkW}px`, "important");
  viewport.style.setProperty("min-width", `${artworkW}px`, "important");
  viewport.style.setProperty("height", `${artworkH}px`, "important");
  viewport.style.setProperty("min-height", `${artworkH}px`, "important");
  scroller.dataset.workspaceRealGeometry = "true";

  // scrollWidth/scrollHeight are final after layout; notify existing Navigator.
  requestAnimationFrame(() => scroller.dispatchEvent(new Event("scroll")));
}

export default function WorkspaceGeometryFix() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncGeometry);
    };

    schedule();

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-workspace-zoom", "style", "class"],
    });

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(schedule)
      : null;
    const observeCurrent = () => {
      const scroller = findScroller();
      if (scroller) resizeObserver?.observe(scroller);
    };
    observeCurrent();
    window.addEventListener("resize", schedule, { passive: true });

    // Remote desktop software often converts precision-touchpad gestures into
    // ordinary wheel events. Handle both axes explicitly before document-level
    // listeners so vertical/horizontal panning remains deterministic.
    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey) return;
      const scroller = findScroller();
      if (!scroller || !scroller.contains(event.target)) return;
      const maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      if (!maxX && !maxY) return;

      const beforeX = scroller.scrollLeft;
      const beforeY = scroller.scrollTop;
      scroller.scrollLeft = Math.max(0, Math.min(maxX, beforeX + event.deltaX));
      scroller.scrollTop = Math.max(0, Math.min(maxY, beforeY + event.deltaY));
      if (scroller.scrollLeft !== beforeX || scroller.scrollTop !== beforeY) {
        event.preventDefault();
        event.stopPropagation();
        scroller.dispatchEvent(new Event("scroll"));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", onWheel, true);
      document.querySelectorAll(".workspace-real-spacer").forEach((node) => node.remove());
    };
  }, []);

  return null;
}
