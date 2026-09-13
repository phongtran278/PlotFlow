import { useEffect } from "react";

const ARTWORK_WIDTH = 1080;
const ARTWORK_HEIGHT = 1920;
const PAD_X = 96;
const PAD_Y = 120;
const STYLE_ID = "plotflow-workspace-real-scroll-style";

function findScroller() {
  return document.querySelector(
    ".component-stage:not(.layout-studio-mode):not(.finetune-mode) .round1-canvas .studio-canvas-scroll"
  );
}

function readScale(scroller) {
  const viewport = scroller?.querySelector(".studio-poster-viewport");
  const datasetZoom = Number(viewport?.dataset?.workspaceZoom);
  if (Number.isFinite(datasetZoom) && datasetZoom > 0) return datasetZoom / 100;

  const cssScale = Number.parseFloat(
    viewport ? getComputedStyle(viewport).getPropertyValue("--studio-zoom") : ""
  );
  return Number.isFinite(cssScale) && cssScale > 0 ? cssScale : 0.38;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .component-stage:not(.layout-studio-mode):not(.finetune-mode)
    .studio-canvas-scroll[data-workspace-real-spacer="true"]::before {
      content: none !important;
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    .component-stage:not(.layout-studio-mode):not(.finetune-mode)
    .studio-canvas-scroll > .workspace-real-scroll-spacer {
      position: relative !important;
      display: block !important;
      flex: 0 0 auto !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

function syncScroller() {
  const scroller = findScroller();
  if (!scroller) return;

  const scale = readScale(scroller);
  const width = Math.max(1, Math.round(ARTWORK_WIDTH * scale + PAD_X));
  const height = Math.max(1, Math.round(ARTWORK_HEIGHT * scale + PAD_Y));

  let spacer = scroller.querySelector(":scope > .workspace-real-scroll-spacer");
  if (!spacer) {
    spacer = document.createElement("div");
    spacer.className = "workspace-real-scroll-spacer";
    spacer.setAttribute("aria-hidden", "true");
    scroller.prepend(spacer);
  }

  spacer.style.width = `${width}px`;
  spacer.style.minWidth = `${width}px`;
  spacer.style.height = `${height}px`;
  spacer.style.minHeight = `${height}px`;
  spacer.style.flexBasis = `${width}px`;
  spacer.style.flexShrink = "0";

  scroller.dataset.workspaceRealSpacer = "true";

  // Force layout now so Navigator reads the actual physical scroll dimensions.
  void scroller.offsetHeight;
  scroller.dispatchEvent(new Event("scroll"));
}

export default function WorkspaceScrollSurfaceFix() {
  useEffect(() => {
    ensureStyle();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncScroller);
    };

    schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-workspace-zoom", "style", "class"],
    });

    const onResize = () => schedule();
    window.addEventListener("resize", onResize, { passive: true });

    function onWheel(event) {
      if (event.ctrlKey || event.metaKey) return;
      const scroller = findScroller();
      if (!scroller || !scroller.contains(event.target)) return;

      let dx = Number(event.deltaX) || 0;
      let dy = Number(event.deltaY) || 0;
      if (event.shiftKey && Math.abs(dx) < Math.abs(dy)) {
        dx += dy;
        dy = 0;
      }

      const maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const nextLeft = Math.max(0, Math.min(maxX, scroller.scrollLeft + dx));
      const nextTop = Math.max(0, Math.min(maxY, scroller.scrollTop + dy));

      if (nextLeft === scroller.scrollLeft && nextTop === scroller.scrollTop) return;

      event.preventDefault();
      event.stopPropagation();
      scroller.scrollLeft = nextLeft;
      scroller.scrollTop = nextTop;
      scroller.dispatchEvent(new Event("scroll"));
    }

    document.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("wheel", onWheel, true);
      document.querySelectorAll(".workspace-real-scroll-spacer").forEach((node) => node.remove());
      document.querySelectorAll('[data-workspace-real-spacer="true"]').forEach((node) => {
        delete node.dataset.workspaceRealSpacer;
      });
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
