import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./WorkspaceController.css";

const MIN_ZOOM = 20;
const MAX_ZOOM = 250;
const ARTWORK_WIDTH = 1080;
const ARTWORK_HEIGHT = 1920;
const PAD_X = 96;
const PAD_Y = 120;

function editableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function findScrollSurface() {
  const candidates = [...document.querySelectorAll(".studio-canvas-scroll")];
  const visible = candidates.filter((node) => {
    if (!node.querySelector(".studio-poster-viewport")) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 40 && rect.height > 40 && style.display !== "none" && style.visibility !== "hidden";
  });
  return visible.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return br.width * br.height - ar.width * ar.height;
  })[0] || document.querySelector(".component-canvas");
}

function findViewport() {
  return findScrollSurface()?.querySelector?.(".studio-poster-viewport") || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function clampZoom(value) {
  return Math.round(clamp(value, MIN_ZOOM, MAX_ZOOM) * 10) / 10;
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function virtualSize(zoom) {
  const scale = clampZoom(zoom) / 100;
  return {
    width: ARTWORK_WIDTH * scale + PAD_X,
    height: ARTWORK_HEIGHT * scale + PAD_Y,
  };
}

function syncPanGeometry(nextZoom) {
  const scroll = findScrollSurface();
  const viewport = findViewport();
  if (!scroll || !viewport) return;
  const scale = clampZoom(nextZoom) / 100;
  const size = virtualSize(nextZoom);
  scroll.style.setProperty("--workspace-content-w", `${Math.round(size.width)}px`);
  scroll.style.setProperty("--workspace-content-h", `${Math.round(size.height)}px`);
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
  const wheelFrameRef = useRef(0);
  const pendingWheelRef = useRef({ x: 0, y: 0 });

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

    const size = virtualSize(zoomRef.current);
    const contentW = Math.max(scroll.clientWidth, size.width);
    const contentH = Math.max(scroll.clientHeight, size.height);
    const maxLeft = Math.max(0, contentW - scroll.clientWidth);
    const maxTop = Math.max(0, contentH - scroll.clientHeight);

    setNavigator({
      left: maxLeft > 0 ? clamp01(scroll.scrollLeft / maxLeft) : 0,
      top: maxTop > 0 ? clamp01(scroll.scrollTop / maxTop) : 0,
      width: clamp01(scroll.clientWidth / Math.max(1, contentW)),
      height: clamp01(scroll.clientHeight / Math.max(1, contentH)),
    });
  }

  useEffect(() => {
    if (!navigatorOpen) return undefined;
    const scroll = findScrollSurface();
    if (!scroll) return undefined;
    const update = () => requestAnimationFrame(refreshNavigator);
    update();
    scroll.addEventListener("scroll", update, { passive: true });
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resizeObserver?.observe(scroll);
    return () => {
      scroll.removeEventListener("scroll", update);
      resizeObserver?.disconnect();
    };
  }, [navigatorOpen]);

  function applyZoom(nextZoom, preservePoint = true, focalPoint = null) {
    const next = clampZoom(nextZoom);
    const scroll = findScrollSurface();
    const viewport = findViewport();
    if (!viewport || !scroll) {
      setZoom(next);
      zoomRef.current = next;
      return;
    }

    const oldSize = virtualSize(zoomRef.current);
    const focalX = focalPoint ? clamp(focalPoint.x, 0, scroll.clientWidth) : scroll.clientWidth / 2;
    const focalY = focalPoint ? clamp(focalPoint.y, 0, scroll.clientHeight) : scroll.clientHeight / 2;
    const contentX = clamp01((scroll.scrollLeft + focalX) / Math.max(1, oldSize.width));
    const contentY = clamp01((scroll.scrollTop + focalY) / Math.max(1, oldSize.height));

    syncPanGeometry(next);
    zoomRef.current = next;
    setZoom(next);

    requestAnimationFrame(() => {
      if (preservePoint) {
        const nextSize = virtualSize(next);
        scroll.scrollLeft = Math.max(0, contentX * nextSize.width - focalX);
        scroll.scrollTop = Math.max(0, contentY * nextSize.height - focalY);
      }
      refreshNavigator();
    });
  }

  function fitArtwork() {
    const scroll = findScrollSurface();
    if (!scroll) return;
    const fitted = Math.floor(Math.min(
      Math.max(1, scroll.clientWidth - 56) / ARTWORK_WIDTH,
      Math.max(1, scroll.clientHeight - 72) / ARTWORK_HEIGHT,
    ) * 100);
    applyZoom(clamp(fitted, MIN_ZOOM, 100), false);
    requestAnimationFrame(() => {
      scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
      scroll.scrollTop = 0;
      refreshNavigator();
    });
  }

  function moveNavigator(event) {
    const scroll = findScrollSurface();
    if (!scroll) return;
    const artwork = event.currentTarget.querySelector?.(".workspace-navigator-artwork") || event.currentTarget.closest?.(".workspace-navigator-map")?.querySelector(".workspace-navigator-artwork");
    const rect = (artwork || event.currentTarget).getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / Math.max(1, rect.width));
    const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height));
    const size = virtualSize(zoomRef.current);
    const maxLeft = Math.max(0, size.width - scroll.clientWidth);
    const maxTop = Math.max(0, size.height - scroll.clientHeight);
    scroll.scrollLeft = maxLeft * x;
    scroll.scrollTop = maxTop * y;
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
      if (!findViewport()) return;
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
      const activeScroll = findScrollSurface();
      const scroll = event.target?.closest?.(".studio-canvas-scroll");
      if (!scroll || scroll !== activeScroll) return;
      const middleMouse = event.button === 1;
      const handActive = event.button === 0 && (tool === "hand" || spaceHeldRef.current);
      if (!middleMouse && !handActive) return;
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
      event.preventDefault();
    }

    function pointerend(event) {
      const drag = dragRef.current;
      if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return;
      try { drag.scroll.releasePointerCapture?.(drag.pointerId); } catch {}
      dragRef.current = null;
      document.body.classList.remove("workspace-grabbing");
      if (navigatorOpenRef.current) refreshNavigator();
    }

    function flushWheel() {
      wheelFrameRef.current = 0;
      const scroll = findScrollSurface();
      if (!scroll) return;
      const { x, y } = pendingWheelRef.current;
      pendingWheelRef.current = { x: 0, y: 0 };
      scroll.scrollLeft += x;
      scroll.scrollTop += y;
      if (navigatorOpenRef.current) refreshNavigator();
    }

    function wheel(event) {
      const activeScroll = findScrollSurface();
      if (!activeScroll || !activeScroll.contains(event.target)) return;

      // Browser pinch gestures normally arrive as Ctrl/Cmd + wheel. Mouse users
      // get the same zoom behavior with Ctrl/Cmd + wheel, including over RDP.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = activeScroll.getBoundingClientRect();
        const focalPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const factor = Math.exp(-event.deltaY * 0.0025);
        applyZoom(zoomRef.current * factor, true, focalPoint);
        return;
      }

      // Hardware-independent pan: wheel/two-finger = vertical, Shift+wheel = horizontal.
      // Precision touchpads that provide deltaX still retain natural diagonal movement.
      event.preventDefault();
      let dx = Number(event.deltaX) || 0;
      let dy = Number(event.deltaY) || 0;
      if (event.shiftKey && Math.abs(dx) < Math.abs(dy)) {
        dx += dy;
        dy = 0;
      }
      pendingWheelRef.current.x += dx;
      pendingWheelRef.current.y += dy;
      if (!wheelFrameRef.current) wheelFrameRef.current = requestAnimationFrame(flushWheel);
    }

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    document.addEventListener("pointerdown", pointerdown, true);
    window.addEventListener("pointermove", pointermove, { passive: false });
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
      cancelAnimationFrame(wheelFrameRef.current);
      document.body.classList.remove("workspace-space-hand", "workspace-grabbing");
    };
  }, [tool]);

  if (!target) return null;

  return createPortal(
    <div className="workspace-controls" aria-label="Artwork workspace controls">
      <div className="workspace-tool-toggle">
        <button type="button" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")} title="Select tool">↖</button>
        <button type="button" className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")} title="Hand tool · kéo artwork · giữ Space hoặc nút giữa chuột để pan">✋</button>
      </div>
      <button type="button" className="workspace-fit" onClick={fitArtwork}>Fit</button>
      <button type="button" className="workspace-zoom-step" onClick={() => applyZoom(zoom - 10)}>−</button>
      <label className="workspace-zoom-field" title="Nhập tỷ lệ zoom artwork">
        <input type="number" min={MIN_ZOOM} max={MAX_ZOOM} value={Math.round(zoom)} onChange={(event) => applyZoom(event.target.value)} />
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
          <div className="workspace-navigator-head"><span>NAVIGATOR</span><strong>{Math.round(zoom)}%</strong></div>
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
                  left: `${navigator.left * (100 - navigator.width * 100)}%`,
                  top: `${navigator.top * (100 - navigator.height * 100)}%`,
                  width: `${navigator.width * 100}%`,
                  height: `${navigator.height * 100}%`,
                }}
              />
            </div>
          </div>
          <small>Wheel: dọc · Shift+Wheel: ngang · Ctrl/Cmd+Wheel: zoom · Hand/Space: pan</small>
        </div>
      )}
    </div>,
    target
  );
}
