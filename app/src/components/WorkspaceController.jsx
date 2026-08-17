import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./WorkspaceController.css";

const MIN_ZOOM = 20;
const MAX_ZOOM = 250;

function editableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function findScrollSurface() {
  return document.querySelector(".studio-canvas-scroll") || document.querySelector(".component-canvas");
}

function findViewport() {
  return document.querySelector(".studio-poster-viewport");
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Number(value) || 0)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
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

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

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
    const observer = new MutationObserver(syncTarget);
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
    const scroll = findScrollSurface();
    if (!scroll) return;
    const scrollWidth = Math.max(1, scroll.scrollWidth);
    const scrollHeight = Math.max(1, scroll.scrollHeight);
    setNavigator({
      left: clamp01(scroll.scrollLeft / scrollWidth),
      top: clamp01(scroll.scrollTop / scrollHeight),
      width: clamp01(scroll.clientWidth / scrollWidth),
      height: clamp01(scroll.clientHeight / scrollHeight),
    });
  }

  useEffect(() => {
    if (!navigatorOpen) return undefined;
    const scroll = findScrollSurface();
    if (!scroll) return undefined;

    refreshNavigator();
    const onScroll = () => refreshNavigator();
    scroll.addEventListener("scroll", onScroll, { passive: true });

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refreshNavigator) : null;
    observer?.observe(scroll);
    const viewport = findViewport();
    if (viewport) observer?.observe(viewport);

    const timer = window.setInterval(refreshNavigator, 450);
    return () => {
      scroll.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [navigatorOpen]);

  function applyZoom(nextZoom, preserveCenter = true) {
    const next = clampZoom(nextZoom);
    const viewport = findViewport();
    const scroll = findScrollSurface();
    if (!viewport) {
      setZoom(next);
      return;
    }

    const old = zoomRef.current || next;
    const centerX = scroll ? (scroll.scrollLeft + scroll.clientWidth / 2) / Math.max(1, scroll.scrollWidth) : 0.5;
    const centerY = scroll ? (scroll.scrollTop + scroll.clientHeight / 2) / Math.max(1, scroll.scrollHeight) : 0.5;

    viewport.style.setProperty("--studio-zoom", String(next / 100));
    viewport.dataset.workspaceZoom = String(next);
    setZoom(next);
    zoomRef.current = next;

    if (preserveCenter && scroll && old !== next) {
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
    const availableW = Math.max(260, (stage?.clientWidth || canvas.clientWidth) - 42);
    const availableH = Math.max(360, canvas.clientHeight - 54);
    const fitted = Math.floor(Math.min(availableW / 1080, availableH / 1920) * 100);
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
      if (viewport.dataset.workspaceZoom !== String(zoomRef.current)) {
        viewport.style.setProperty("--studio-zoom", String(zoomRef.current / 100));
        viewport.dataset.workspaceZoom = String(zoomRef.current);
      }
    }
    reapply();
    const timer = window.setInterval(reapply, 350);
    return () => window.clearInterval(timer);
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

    function mousedown(event) {
      if (event.button !== 0) return;
      const canvas = event.target?.closest?.(".component-canvas");
      if (!canvas) return;
      const handActive = tool === "hand" || spaceHeldRef.current;
      if (!handActive) return;
      if (event.target?.closest?.("button,input,label,select,textarea")) return;
      const scroll = findScrollSurface();
      if (!scroll) return;
      event.preventDefault();
      dragRef.current = {
        scroll,
        x: event.clientX,
        y: event.clientY,
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
      };
      document.body.classList.add("workspace-grabbing");
    }

    function mousemove(event) {
      const drag = dragRef.current;
      if (!drag) return;
      drag.scroll.scrollLeft = drag.left - (event.clientX - drag.x);
      drag.scroll.scrollTop = drag.top - (event.clientY - drag.y);
      refreshNavigator();
    }

    function mouseup() {
      dragRef.current = null;
      document.body.classList.remove("workspace-grabbing");
    }

    function wheel(event) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (!event.target?.closest?.(".component-canvas")) return;
      event.preventDefault();
      applyZoom(zoomRef.current + (event.deltaY < 0 ? 10 : -10));
    }

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("mousemove", mousemove);
    window.addEventListener("mouseup", mouseup);
    document.addEventListener("mousedown", mousedown, true);
    document.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("mouseup", mouseup);
      document.removeEventListener("mousedown", mousedown, true);
      document.removeEventListener("wheel", wheel, true);
      document.body.classList.remove("workspace-space-hand", "workspace-grabbing");
    };
  }, [tool]);

  if (!target) return null;

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
                  left: `${navigator.left * 100}%`,
                  top: `${navigator.top * 100}%`,
                  width: `${navigator.width * 100}%`,
                  height: `${navigator.height * 100}%`,
                }}
              />
            </div>
          </div>
          <small>Kéo khung để đi nhanh · Hand/Space để pan trực tiếp</small>
        </div>
      )}
    </div>,
    target
  );
}
