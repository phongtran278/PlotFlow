import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./WorkspaceController.css";

const MIN_ZOOM = 20;
const MAX_ZOOM = 250;
const ARTBOARD_WIDTH = 1080;
const ARTBOARD_HEIGHT = 1920;

function editableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function findCameraSurface() {
  return document.querySelector(
    ".component-stage:not(.layout-studio-mode):not(.finetune-mode) .studio-canvas-scroll"
  );
}

function findViewport() {
  return document.querySelector(
    ".component-stage:not(.layout-studio-mode):not(.finetune-mode) .studio-poster-viewport"
  );
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Number(value) || 0)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const navigatorOpenRef = useRef(false);
  const navigatorRafRef = useRef(null);
  const zoomRef = useRef(38);
  const panRef = useRef({ x: 0, y: 0 });

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

  function applyCamera() {
    const viewport = findViewport();
    if (!viewport) return;
    viewport.dataset.workspaceCamera = "true";
    viewport.style.setProperty("--workspace-zoom", String(zoomRef.current / 100));
    viewport.style.setProperty("--workspace-pan-x", `${panRef.current.x}px`);
    viewport.style.setProperty("--workspace-pan-y", `${panRef.current.y}px`);
  }

  function refreshNavigatorNow() {
    if (!navigatorOpenRef.current) return;
    const surface = findCameraSurface();
    if (!surface) return;

    const scale = zoomRef.current / 100;
    const artworkWidth = ARTBOARD_WIDTH * scale;
    const artworkHeight = ARTBOARD_HEIGHT * scale;
    const surfaceWidth = Math.max(1, surface.clientWidth);
    const surfaceHeight = Math.max(1, surface.clientHeight);
    const artworkLeft = (surfaceWidth - artworkWidth) / 2 + panRef.current.x;
    const artworkTop = (surfaceHeight - artworkHeight) / 2 + panRef.current.y;

    const width = artworkWidth <= surfaceWidth ? 1 : clamp(surfaceWidth / artworkWidth, 0.04, 1);
    const height = artworkHeight <= surfaceHeight ? 1 : clamp(surfaceHeight / artworkHeight, 0.04, 1);
    const left = width === 1 ? 0 : clamp(-artworkLeft / artworkWidth, 0, 1 - width);
    const top = height === 1 ? 0 : clamp(-artworkTop / artworkHeight, 0, 1 - height);

    setNavigator({ left, top, width, height });
  }

  function scheduleNavigatorRefresh() {
    if (!navigatorOpenRef.current || navigatorRafRef.current != null) return;
    navigatorRafRef.current = requestAnimationFrame(() => {
      navigatorRafRef.current = null;
      refreshNavigatorNow();
    });
  }

  function setPan(x, y) {
    panRef.current = { x, y };
    applyCamera();
    scheduleNavigatorRefresh();
  }

  function applyZoom(nextZoom, preservePosition = true) {
    const next = clampZoom(nextZoom);
    const old = Math.max(0.01, zoomRef.current / 100);
    const nextScale = next / 100;

    if (preservePosition && old !== nextScale) {
      const ratio = nextScale / old;
      panRef.current = {
        x: panRef.current.x * ratio,
        y: panRef.current.y * ratio,
      };
    }

    zoomRef.current = next;
    setZoom(next);
    applyCamera();
    scheduleNavigatorRefresh();
  }

  function fitArtwork() {
    const surface = findCameraSurface();
    if (!surface) return;
    const availableW = Math.max(260, surface.clientWidth - 72);
    const availableH = Math.max(360, surface.clientHeight - 72);
    const fitted = Math.floor(Math.min(availableW / ARTBOARD_WIDTH, availableH / ARTBOARD_HEIGHT) * 100);
    panRef.current = { x: 0, y: 0 };
    applyZoom(Math.max(MIN_ZOOM, Math.min(100, fitted)), false);
  }

  function moveNavigator(event) {
    const surface = findCameraSurface();
    const artwork = event.currentTarget.querySelector(".workspace-navigator-artwork");
    if (!surface || !artwork) return;

    const rect = artwork.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    const scale = zoomRef.current / 100;

    setPan(
      (0.5 - x) * ARTBOARD_WIDTH * scale,
      (0.5 - y) * ARTBOARD_HEIGHT * scale
    );
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
    if (!navigatorOpen) return undefined;
    navigatorOpenRef.current = true;
    requestAnimationFrame(refreshNavigatorNow);
    const surface = findCameraSurface();
    const resizeObserver = surface && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleNavigatorRefresh)
      : null;
    if (surface) resizeObserver?.observe(surface);
    return () => {
      navigatorOpenRef.current = false;
      resizeObserver?.disconnect();
      if (navigatorRafRef.current != null) cancelAnimationFrame(navigatorRafRef.current);
      navigatorRafRef.current = null;
    };
  }, [navigatorOpen]);

  useEffect(() => {
    function ensureCamera() {
      const viewport = findViewport();
      if (!viewport) return;
      if (viewport.dataset.workspaceCamera !== "true") applyCamera();
    }

    ensureCamera();
    const observer = new MutationObserver(() => requestAnimationFrame(ensureCamera));
    observer.observe(document.body, { childList: true, subtree: true });

    const onResize = () => {
      applyCamera();
      scheduleNavigatorRefresh();
    };
    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
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
      const surface = event.target?.closest?.(".studio-canvas-scroll");
      if (!surface || surface !== findCameraSurface()) return;
      const handActive = tool === "hand" || spaceHeldRef.current;
      if (!handActive) return;
      if (event.target?.closest?.("button,input,label,select,textarea")) return;

      event.preventDefault();
      dragRef.current = {
        surface,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      surface.setPointerCapture?.(event.pointerId);
      document.body.classList.add("workspace-grabbing");
    }

    function pointermove(event) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPan(
        drag.panX + (event.clientX - drag.startX),
        drag.panY + (event.clientY - drag.startY)
      );
    }

    function pointerend(event) {
      const drag = dragRef.current;
      if (!drag || (event.pointerId != null && drag.pointerId !== event.pointerId)) return;
      try { drag.surface.releasePointerCapture?.(drag.pointerId); } catch {}
      dragRef.current = null;
      document.body.classList.remove("workspace-grabbing");
      scheduleNavigatorRefresh();
    }

    function wheel(event) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const surface = event.target?.closest?.(".studio-canvas-scroll");
      if (!surface || surface !== findCameraSurface()) return;
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

  return createPortal(
    <div className="workspace-controls" aria-label="Artwork workspace controls">
      <div className="workspace-tool-toggle">
        <button type="button" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")} title="Select tool">↖</button>
        <button type="button" className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")} title="Hand tool · kéo artwork tự do · giữ Space để dùng tạm">✋</button>
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
            title="Click hoặc kéo để đưa điểm này vào giữa màn hình"
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
          <small>Hand: kéo artwork tự do · Map: nhảy nhanh tới vùng cần xem</small>
        </div>
      )}
    </div>,
    target
  );
}
