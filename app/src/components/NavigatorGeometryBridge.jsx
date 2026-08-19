import { useEffect } from "react";

const ARTWORK_WIDTH = 1080;
const ARTWORK_HEIGHT = 1920;
const EDGE_PAD = 40;

function activeNavigatorStage() {
  const map = document.querySelector(".workspace-navigator-map");
  return map?.closest?.(".component-stage") || document.querySelector(".component-stage:not(.layout-studio-mode):not(.finetune-mode)");
}

function findScroller() {
  const stage = activeNavigatorStage();
  const scoped = stage?.querySelector?.(".studio-canvas-scroll .studio-poster-viewport")?.closest?.(".studio-canvas-scroll");
  if (scoped) return scoped;

  const candidates = [...document.querySelectorAll(".studio-canvas-scroll")]
    .filter((node) => node.querySelector(".studio-poster-viewport"))
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 20 && rect.height > 20 && style.display !== "none" && style.visibility !== "hidden";
    });

  return candidates.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (br.width * br.height) - (ar.width * ar.height);
  })[0] || null;
}

function readZoom() {
  const scroller = findScroller();
  const viewport = scroller?.querySelector(".studio-poster-viewport");
  const fromDataset = Number(viewport?.dataset?.workspaceZoom);
  if (Number.isFinite(fromDataset) && fromDataset > 0) return fromDataset;
  const fromCss = Number.parseFloat(viewport ? getComputedStyle(viewport).getPropertyValue("--studio-zoom") : "");
  return Number.isFinite(fromCss) && fromCss > 0 ? fromCss * 100 : 38;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function setImportant(node, property, value) {
  node.style.setProperty(property, value, "important");
}

function syncNavigator() {
  const scroller = findScroller();
  const map = document.querySelector(".workspace-navigator-artwork");
  const box = document.querySelector(".workspace-navigator-viewport");
  if (!scroller || !map || !box) return;

  const zoom = readZoom();
  const scale = Math.max(0.2, Math.min(2.5, zoom / 100));
  const artworkW = ARTWORK_WIDTH * scale;
  const artworkH = ARTWORK_HEIGHT * scale;

  const visibleW = Math.min(artworkW, Math.max(1, scroller.clientWidth));
  const visibleH = Math.min(artworkH, Math.max(1, scroller.clientHeight));
  const viewW = clamp01(visibleW / Math.max(1, artworkW));
  const viewH = clamp01(visibleH / Math.max(1, artworkH));

  const maxArtworkX = Math.max(1, artworkW - visibleW);
  const maxArtworkY = Math.max(1, artworkH - visibleH);
  const artworkScrollX = Math.max(0, scroller.scrollLeft - EDGE_PAD);
  const artworkScrollY = Math.max(0, scroller.scrollTop - EDGE_PAD);
  const left = clamp01(artworkScrollX / maxArtworkX);
  const top = clamp01(artworkScrollY / maxArtworkY);

  setImportant(box, "width", `${viewW * 100}%`);
  setImportant(box, "height", `${viewH * 100}%`);
  setImportant(box, "left", `${left * (100 - viewW * 100)}%`);
  setImportant(box, "top", `${top * (100 - viewH * 100)}%`);
  box.dataset.navigatorGeometry = "active-stage";
  box.dataset.navigatorZoom = String(Math.round(zoom));
  box.dataset.navigatorClient = `${scroller.clientWidth}x${scroller.clientHeight}`;
}

function moveFromMap(event) {
  const scroller = findScroller();
  const map = document.querySelector(".workspace-navigator-artwork");
  if (!scroller || !map) return;

  const zoom = readZoom();
  const scale = Math.max(0.2, Math.min(2.5, zoom / 100));
  const artworkW = ARTWORK_WIDTH * scale;
  const artworkH = ARTWORK_HEIGHT * scale;
  const rect = map.getBoundingClientRect();
  const x = clamp01((event.clientX - rect.left) / Math.max(1, rect.width));
  const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height));
  const visibleW = Math.min(artworkW, Math.max(1, scroller.clientWidth));
  const visibleH = Math.min(artworkH, Math.max(1, scroller.clientHeight));

  scroller.scrollLeft = Math.max(0, EDGE_PAD + x * artworkW - visibleW / 2);
  scroller.scrollTop = Math.max(0, EDGE_PAD + y * artworkH - visibleH / 2);
  requestAnimationFrame(syncNavigator);
}

export default function NavigatorGeometryBridge() {
  useEffect(() => {
    let frame = 0;
    let dragging = false;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncNavigator);
    };

    const onScroll = () => schedule();
    const onPointerDown = (event) => {
      if (!event.target?.closest?.(".workspace-navigator-map")) return;
      dragging = true;
      event.preventDefault();
      event.stopPropagation();
      moveFromMap(event);
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      moveFromMap(event);
    };
    const onPointerUp = () => { dragging = false; };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-workspace-zoom"],
    });

    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("resize", schedule, { passive: true });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return null;
}
