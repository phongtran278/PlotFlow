import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./WorkspaceController.css";

const MIN_ZOOM = 20;
const MAX_ZOOM = 250;
const ARTWORK_WIDTH = 1080;
const ARTWORK_HEIGHT = 1920;

function editableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function findScrollSurface() {
  return document.querySelector(
    ".component-stage:not(.layout-studio-mode):not(.finetune-mode) .round1-canvas .studio-canvas-scroll"
  ) || document.querySelector(".component-canvas");
}

function findViewport() {
  const scroll = findScrollSurface();
  return scroll?.querySelector(".studio-poster-viewport") || null;
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Number(value) || 0)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function syncPanGeometry(nextZoom) {
  const scroll = findScrollSurface();
  const viewport = findViewport();
  if (!scroll || !viewport) return;
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(nextZoom) || 38)) / 100;
  scroll.style.setProperty("--workspace-content-w", `${Math.round(ARTWORK_WIDTH * scale + 96)}px`);
  scroll.style.setProperty("--workspace-content-h", `${Math.round(ARTWORK_HEIGHT * scale + 120)}px`);
  scroll.dataset.workspacePanSurface = "true";
  viewport.style.setProperty("--studio-zoom", String(scale));
  viewport.dataset.workspaceZoom = String(Math.round(scale * 100));
}

export default function WorkspaceController() {
  const [target, setTarget] = useState(null);
  const [zoom, setZoom] = useState(38);
  const [tool, setTool] = useState("select");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigator, setNavigator] = useState({ left: 0, top: 0, width: 1, height: 1 });
  const spaceHeldRef = useRef(false);
  const dragRef = useRef(null);
  const navigatorDragRef = useRef(false);
  const zoomRef = useRef(38);
  const navigatorOpenRef = useRef(false);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { navigatorOpenRef.current = navigatorOpen; }, [navigatorOpen]);

  useEffect(() => {
    function syncTarget() {
      const actions = document.querySelector(".stage-actions");
      if (!actions) {
        setTarget(null);
        return;
      }
      let host = actions.querySelector(".workspace-controls-host");
      if (!host) {
        host = document.createElement("div");
        host.className = "workspace-controls-host";
        actions.prepend(host);
      }
      setTarget((current) => current === host ? current : host);
    }

    syncTarget();
    const observer = new MutationObserver(() => requestAnimationFrame(syncTarget));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("workspace-panel-collapsed", panelCollapsed);
    return () => document.body.classList.remove("workspace-panel-collapsed");
  }, [panelCollapsed]);

  useEffect(() => {
    document.body.classList.toggle("workspace-hand-tool", tool === "hand");
    return () => document.body.classList.remove("workspace-hand-tool");
  }, [tool]);

  function refreshNavigator() {
    if (!navigatorOpenRef.current) return;
    const scroll = findScrollSurface();
    if (!scroll) return;

    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoomRef.current) || 38)) / 100;
    const artworkWidth = ARTWORK_WIDTH * scale;
    const artworkHeight = ARTWORK_HEIGHT * scale;
    const viewportWidth = clamp01(scroll.clientWidth / Math.max(1, artworkWidth));
    const viewportHeight = clamp01(scroll.clientHeight / Math.max(1, artworkHeight));
    const maxLeft = Math.max(1, scroll.scrollWidth - scroll.clientWidth);
    const maxTop = Math.max(1, scroll.scrollHeight - scroll.clientHeight);

    setNavigator({
      left: clamp01(scroll.scrollLeft / maxLeft),
      top: clamp01(scroll.scrollTop / maxTop),
      width: viewportWidth,
      height: viewportHeight,
    });
  }

  useEffect(() => {
    if (!navigatorOpen) return undefined;
    const scroll = findScrollSurface();
    if (!scroll) return undefined;

    requestAnimationFrame(refreshNavigator);
    const onScroll = () => requestAnimationFrame(refreshNavigator);
    scroll.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => requestAnimationFrame(refreshNavigator)) : null;
    resizeObserver?.observe(scroll);
    const viewport = findViewport();
    if (viewport) resizeObserver?.observe(viewport);

    return () => {
      scroll.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
    };
  }, [navigatorOpen]);

  function applyZoom(nextZoom, preserveCenter = true) {
    const next = clampZoom(nextZoom);
    const viewport = findViewport();
    const scroll = findScrollSurface();
    if (!viewport) {
      setZoom(next);
      zoomRef.current = next;
      return;
    }

    const old = zoomRef.current || next;
    const maxOldLeft = scroll ? Math.max(1, scroll.scrollWidth - scroll.clientWidth) : 1;
    const maxOldTop = scroll ? Math.max(1, scroll.scrollHeight - scroll.clientHeight) : 1;
    const centerX = scroll ? clamp01((scroll.scrollLeft + scroll.clientWidth / 2) / Math.max(1, scroll.scrollWidth)) : 0.5;
    const centerY = scroll ? clamp01((scroll.scrollTop + scroll.clientHeight / 2) / Math.max(1, scroll.scrollHeight)) : 0.5;

    syncPanGeometry(next);
    setZoom(next);
    zoomRef.current = next;

    if (preserveCenter && scroll && old !== next && (maxOldLeft > 1 || maxOldTop > 1)) {
      requestAnimationFrame(() => {
        scroll.scrollLeft = Math.max(0, centerX * scroll.scrollWidth - scroll.clientWidth / 2);
        scroll.scrollTop = Math.max(0, centerY * scroll.scrollHeight - scroll.clientHeight / 2);
        refreshNavigator();
      });
    } else {
      requestAnimationFrame(refreshNavigator);
    }
  }

  function fitArtwork() {
    const canvas = document.querySelector(".component-canvas");
    const stage = document.querySelector(".layout-studio") || document.querySelector(".studio-center");
    if (!canvas) return;
    const availableW = Math.max(260, (stage?.clientWidth || canvas.clientWidth) - 56);
    const availableH = Math.max(360, canvas.clientHeight - 72);
    const fitted = Math.floor(Math.min(availableW / ARTWORK_WIDTH, availableH / ARTWORK_HEIGHT) * 100);
    applyZoom(Math.max(MIN_ZOOM, Math.min(100, fitted)), false);
    const scroll = findScrollSurface();
    requestAnimationFrame(() => {
      if (!scroll) return;
      scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
      scroll.scrollTop = 0;
      refreshNavigator();
    });
  }

  function moveNavigator(event) {
    const scroll = findScrollSurface();
    if (!scroll) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / Math.max(1, rect.width));
    const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height));
    scroll.scrollLeft = Math.max(0, x * scroll.scrollWidth - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, y * scroll.scrollHeight - scroll.clientHeight / 2);
    refreshNavigator();
  }

  function navigatorPointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    navigatorDragRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveNavigator(event);
  }

  function navigatorPointerMove(event) {
    if (!navigatorDragRef.current) return;
    event.preventDefault();
    moveNavigator(event);
  }

  function navigatorPointerEnd(event) {
    navigatorDragRef.current = false;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch {}
  }

  useEffect(() => {
    function reapply() {
      const viewport = findViewport();
      if (!viewport) return;
      syncPanGeometry(zoomRef.current);
    }

    reapply();
    const observer = new MutationObserver(() => requestAnimationFrame(reapply));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function keydown(event) {
      if (editableTarget(event.target)) return;
      if (event.code === "Space") {
        spaceHeldRef.current = true;
        document.body.classList.add("workspace-space-hand");
        event.preventDefault();
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        applyZoom(zoomRef.current + 10);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "-") {
        event.preventDefault();
        applyZoom(zoomRef.current - 10);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "0") {
        event.preventDefault();
        fitArtwork();
      }
    }

    function keyup(event) {
      if (event.code === "Space") {
        spaceHeldRef.current = false;
        document.body.classList.remove("workspace-space-hand");
      }
    }

    function pointerdown(event) {
      if (event.button !== 0) return;
      const activeScroll = findScrollSurface();
      const scroll = event.target?.closest?.(".studio-canvas-scroll");
      if (!scroll || scroll !== activeScroll) return;
      const handActive = tool === "hand" || spaceHeldRef.current;
      if (!handActive) return;
      if (event.target?.closest?.("button,input,label,select,textarea")) return;
      event.preventDefault();
      dragRef.current = {
        scroll,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
      };
      scroll.setPointerCapture?.(event.pointerId);
      document.body.classList.add("workspace-grabbing");
    }

    function pointermove(event) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.scroll.scrollLeft = drag.left - (event.clientX - drag.x);
      drag.scroll.scrollTop = drag.top - (event.clientY - drag.y);
      if (navigatorOpenRef.current) refreshNavigator();
    }

    function pointerend(event) {
      const drag = dragRef.current;
      if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return;
      try { drag.scroll.releasePointerCapture?.(drag.pointerId); } catch {}
      dragRef.current = null;
      document.body.classList.remove("workspace-grabbing");
      if (navigatorOpenRef.current) refreshNavigator();
    }

    function wheel(event) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const activeScroll = findScrollSurface();
      if (!activeScroll || !activeScroll.contains(event.target)) return;
      event.preventDefault();
      applyZoom(zoomRef.current + (event.deltaY < 0 ? 10 : -10));
    }

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    document.addEventListener("pointerdown", pointerdown, true);
    window.addEventListener("pointermove", pointermove);
    window.addEventListener("pointerup", pointerend);
    window.addEventListener("pointercancel", pointerend);
    document.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      document.removeEventListener("pointerdown", pointerdown, true);
      window.removeEventListener("pointermove", pointermove);
      window.removeEventListener("pointerup", pointerend);
      window.removeEventListener("pointercancel", pointerend);
      document.removeEventListener("wheel", wheel, true);
      document.body.classList.remove("workspace-space-hand", "workspace-grabbing");
    };
  }, [tool]);

  if (!target) return null;

  const navWidth = clamp01(90 / Math.max(1, zoom));
  const navHeight = clamp01(48 / Math.max(1, zoom));
  const navLeft = navigator.left * (1 - navWidth);
  const navTop = navigator.top * (1 - navHeight);

  return createPortal(
    <div className="workspace-controls" aria-label="Artwork workspace controls">
      <div className="workspace-tool-toggle">
        <button type="button" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")} title="Select tool">↖</button>
        <button type="button" className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")} title="Hand tool · kéo toàn bộ artwork · giữ Space để dùng tạm">✋</button>
      </div>
      <button type="button" className="workspace-fit" onClick={fitArtwork}>Fit</button>
      <button type="button" className="workspace-zoom-step" onClick={() => applyZoom(zoom - 10)}>−</button>
      <label className="workspace-zoom-field" title="Nhập tỷ lệ zoom artwork">
        <input type="number" min={MIN_ZOOM} max={MAX_ZOOM} value={zoom} onChange={(event) => applyZoom(event.target.value)} />
        <span>%</span>
      </label>
      <button type="button" className="workspace-zoom-step" onClick={() => applyZoom(zoom + 10)}>+</button>
      <button type="button" className="workspace-100" onClick={() => applyZoom(100)}>100%</button>
      <button type="button" className={`workspace-map-toggle ${navigatorOpen ? "active" : ""}`} onClick={() => setNavigatorOpen((value) => !value)} title="Navigator · xem vị trí hiện tại trên toàn artwork">▣ Map</button>
      <button type="button" className={`workspace-panel-toggle ${panelCollapsed ? "active" : ""}`} onClick={() => setPanelCollapsed((value) => !value)} title="Thu gọn Design Assignment">
        {panelCollapsed ? "› Design" : "‹ Design"}
      </button>

      {navigatorOpen && (
        <div className="workspace-navigator-popover">
          <div className="workspace-navigator-head"><span>NAVIGATOR</span><strong>{zoom}%</strong></div>
          <div
            className="workspace-navigator-map"
            onPointerDown={navigatorPointerDown}
            onPointerMove={navigatorPointerMove}
            onPointerUp={navigatorPointerEnd}
            onPointerCancel={navigatorPointerEnd}
            title="Click hoặc kéo để di chuyển tới vị trí khác"
          >
            <div className="workspace-navigator-artwork">
              <div
                className="workspace-navigator-viewport"
                style={{
                  left: `${navLeft * 100}%`,
                  top: `${navTop * 100}%`,
                  width: `${navWidth * 100}%`,
                  height: `${navHeight * 100}%`,
                }}
              />
            </div>
          </div>
          <small>Kéo trên map để đi nhanh · Hand/Space để pan trực tiếp</small>
        </div>
      )}
    </div>,
    target
  );
}
