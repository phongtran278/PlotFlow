import { useEffect, useMemo, useRef, useState } from "react";
import PosterCanvas from "./PosterCanvas";
import { detectLotShape } from "../floorplan/autoLotShape";
import {
  calculateCropRect,
  FLOORPLAN_FRAME_ASPECT,
  FLOORPLAN_ZOOM_MAX,
  FLOORPLAN_ZOOM_MIN,
} from "../floorplan/pdfLocator";
import "./UnifiedFloorplanEditor.css";
import "./UnifiedFloorplanEditorV2.css";

export const DEFAULT_FLOORPLAN_VIEW = { zoom: 100, offsetX: 0, offsetY: 0 };

const DEFAULT_STYLE = { fill: "#d91e36", opacity: 0.32, blendMode: "multiply", stroke: "none", strokeWidth: 0 };
const PIN_SCALE_MIN = 0.25;
const PIN_SCALE_MAX = 6;
const RENDER_IDLE_MS = 360;

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const normalizeRotation = (value) => ((Number(value) || 0) % 360 + 360) % 360;

function emptyOverlay(anchor = { x: 0.5, y: 0.5 }) {
  return {
    shape: { type: "polygon", source: "locator", points: [] },
    style: DEFAULT_STYLE,
    pin: { visible: false, x: anchor.x, y: anchor.y, scale: 1, rotation: 0, anchor: "tip" },
    status: "locator",
    stale: false,
  };
}

function pointFromEvent(event, element) {
  const rect = element.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / Math.max(1, rect.width), y: (event.clientY - rect.top) / Math.max(1, rect.height) };
}

const cropPointToPage = (point, crop) => ({ x: crop.x + Number(point.x || 0) * crop.w, y: crop.y + Number(point.y || 0) * crop.h });
const pagePointToCrop = (point, crop) => ({ x: (Number(point.x || 0) - crop.x) / crop.w, y: (Number(point.y || 0) - crop.y) / crop.h });

function overlayToPageSpace(overlay, crop, fallbackAnchor) {
  const base = overlay ? clone(overlay) : emptyOverlay(fallbackAnchor);
  base.style = { ...DEFAULT_STYLE, ...(base.style || {}) };
  base.shape = base.shape || { type: "polygon", source: "locator", points: [] };
  base.pin = { ...emptyOverlay(fallbackAnchor).pin, ...(base.pin || {}) };
  base.stale = false;
  if (!crop) return base;
  base.shape.points = (base.shape.points || []).map((point) => cropPointToPage(point, crop));
  if (base.pin) base.pin = { ...base.pin, ...cropPointToPage(base.pin, crop) };
  return base;
}

function overlayToCropSpace(pageOverlay, crop) {
  const next = clone(pageOverlay);
  next.shape = next.shape || { type: "polygon", source: "locator", points: [] };
  next.shape.points = (next.shape.points || []).map((point) => pagePointToCrop(point, crop));
  if (next.pin) next.pin = { ...next.pin, ...pagePointToCrop(next.pin, crop) };
  next.stale = false;
  return next;
}

function formatDetection(result) {
  if (!result?.accepted) {
    if (result?.reason === "low-confidence") return `Boundary chưa đủ chắc · ${Math.round((result.confidence || 0) * 100)}%`;
    return "Chưa tìm thấy boundary khép kín đủ tin cậy.";
  }
  const kind = result.classification === "rectangle" ? "Rectangle" : `Polygon ${result.vertices} cạnh`;
  return `${kind} · ${Math.round(result.confidence * 100)}%`;
}

export default function UnifiedFloorplanEditorV2({
  unit,
  locatorResult,
  pageRender,
  initialView,
  initialOverlay,
  posterAssets,
  pinSrc,
  onCancel,
  onSave,
  onCandidateChange,
  onRenderVectorPreview,
}) {
  const stageRef = useRef(null);
  const zoomScrubRef = useRef(null);
  const renderSequence = useRef(0);
  const autoRanRef = useRef(false);

  const initialViewValue = useMemo(() => ({ ...DEFAULT_FLOORPLAN_VIEW, ...(initialView || {}) }), [initialView]);
  const initialCrop = useMemo(() => pageRender ? calculateCropRect(pageRender, initialViewValue, FLOORPLAN_FRAME_ASPECT) : null, [pageRender, initialViewValue]);
  const initialAnchor = useMemo(() => {
    if (!pageRender || !initialCrop) return { x: 0.5, y: 0.5 };
    return { x: (pageRender.anchorX - initialCrop.x) / initialCrop.w, y: (pageRender.anchorY - initialCrop.y) / initialCrop.h };
  }, [pageRender, initialCrop]);

  const [view, setView] = useState(initialViewValue);
  const [pageOverlay, setPageOverlay] = useState(() => overlayToPageSpace(initialOverlay, initialCrop, initialAnchor));
  const [tool, setTool] = useState("select");
  const [selectedObject, setSelectedObject] = useState(() => initialOverlay?.shape?.points?.length ? "shape" : initialOverlay?.pin?.visible ? "pin" : null);
  const [drag, setDrag] = useState(null);
  const [dragNode, setDragNode] = useState(null);
  const [rectStart, setRectStart] = useState(null);
  const [pathDraft, setPathDraft] = useState([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [liveCrop, setLiveCrop] = useState(null);
  const [renderState, setRenderState] = useState("idle");
  const [detectState, setDetectState] = useState({ state: "idle", message: "" });
  const [posterOpen, setPosterOpen] = useState(false);

  const crop = useMemo(() => pageRender ? calculateCropRect(pageRender, view, FLOORPLAN_FRAME_ASPECT) : null, [pageRender, view.zoom, view.offsetX, view.offsetY]);
  const overlay = useMemo(() => crop ? overlayToCropSpace(pageOverlay, crop) : emptyOverlay(), [pageOverlay, crop]);
  const autoAnchor = useMemo(() => {
    if (!pageRender || !crop) return { x: 0.5, y: 0.5 };
    return { x: (pageRender.anchorX - crop.x) / crop.w, y: (pageRender.anchorY - crop.y) / crop.h };
  }, [pageRender, crop]);

  useEffect(() => {
    document.body.classList.add("plotflow-floorplan-editing");
    return () => document.body.classList.remove("plotflow-floorplan-editing");
  }, []);

  useEffect(() => {
    if (!pageRender || !onRenderVectorPreview || drag?.type === "pan" || drag?.type === "zoom") return undefined;
    const sequence = ++renderSequence.current;
    setRenderState("preview");
    const timer = window.setTimeout(async () => {
      try {
        setRenderState("rendering");
        const result = await onRenderVectorPreview(view);
        if (sequence !== renderSequence.current || !result) return;
        setLiveCrop(result);
        setRenderState("ready");
      } catch (error) {
        if (sequence !== renderSequence.current) return;
        console.error(error);
        setRenderState("error");
      }
    }, RENDER_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [pageRender, view.zoom, view.offsetX, view.offsetY, drag?.type, onRenderVectorPreview]);

  useEffect(() => {
    if (!liveCrop?.dataUrl || initialOverlay?.shape?.points?.length || autoRanRef.current) return;
    autoRanRef.current = true;
    runAutoDetect();
  }, [liveCrop?.dataUrl]);

  useEffect(() => {
    function keydown(event) {
      const activeTag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
      if (event.code === "Space") { event.preventDefault(); setSpaceDown(true); return; }
      const key = event.key.toLowerCase();
      if (key === "v") setTool("select");
      if (key === "h") setTool("pan");
      if (key === "z") setTool("zoom");
      if (key === "r") setTool("rectangle");
      if (key === "p") setTool("pen");
      if (key === "i") setTool("pin");
      if (event.key === "Enter" && pathDraft.length >= 3) finishPath();
      if (event.key === "Escape") {
        if (pathDraft.length || rectStart) { setPathDraft([]); setRectStart(null); }
        else if (selectedObject) setSelectedObject(null);
        else onCancel?.();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedObject) {
        event.preventDefault();
        if (selectedObject === "shape") clearShape();
        if (selectedObject === "pin") clearPin();
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selectedObject && crop) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        nudgeSelected(event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0, event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0);
      }
    }
    const keyup = (event) => { if (event.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [pathDraft, rectStart, selectedObject, crop, pageOverlay]);

  function patchView(patch) {
    setView((current) => ({
      zoom: clamp(patch.zoom ?? current.zoom, FLOORPLAN_ZOOM_MIN, FLOORPLAN_ZOOM_MAX) || 100,
      offsetX: Number(patch.offsetX ?? current.offsetX) || 0,
      offsetY: Number(patch.offsetY ?? current.offsetY) || 0,
    }));
  }

  function patchStyle(patch) {
    setPageOverlay((current) => ({ ...current, style: { ...DEFAULT_STYLE, ...(current.style || {}), ...patch }, status: "edited", stale: false }));
  }

  function patchPin(patch) {
    setPageOverlay((current) => ({ ...current, pin: { ...(current.pin || {}), ...patch, anchor: "tip" }, status: "edited", stale: false }));
  }

  function setPinScale(value) { patchPin({ scale: clamp(value, PIN_SCALE_MIN, PIN_SCALE_MAX), visible: true }); }
  function setPinRotation(value) { patchPin({ rotation: normalizeRotation(value), visible: true }); }

  function nudgeSelected(dxPosterPixels, dyPosterPixels) {
    if (!crop || !selectedObject) return;
    const dx = dxPosterPixels * crop.w / 506;
    const dy = dyPosterPixels * crop.h / 390;
    setPageOverlay((current) => {
      const next = clone(current);
      if (selectedObject === "shape" && next.shape?.points?.length) next.shape.points = next.shape.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      if (selectedObject === "pin" && next.pin) { next.pin.x += dx; next.pin.y += dy; }
      next.status = "edited"; next.stale = false;
      return next;
    });
  }

  async function runAutoDetect() {
    const src = liveCrop?.dataUrl;
    if (!src || !crop || detectState.state === "scanning") return;
    setDetectState({ state: "scanning", message: "Đang dò shape quanh mã lô…" });
    try {
      const result = await detectLotShape(src, autoAnchor);
      if (result.accepted) {
        const pagePoints = (result.shape?.points || []).map((point) => cropPointToPage(point, crop));
        setPageOverlay((current) => ({ ...current, shape: { ...result.shape, points: pagePoints }, style: { ...DEFAULT_STYLE, ...(current.style || {}) }, status: "auto-detected", autoConfidence: result.confidence, autoClassification: result.classification, stale: false }));
        setSelectedObject("shape"); setTool("select"); setDetectState({ state: "detected", message: formatDetection(result) });
      } else setDetectState({ state: "fallback", message: `${formatDetection(result)} Dùng Rectangle/Pen nếu cần.` });
    } catch (error) { setDetectState({ state: "fallback", message: error.message || "Auto Shape thất bại." }); }
  }

  function beginPan(event) {
    if (!stageRef.current || !crop) return;
    event.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    setDrag({ type: "pan", x: event.clientX, y: event.clientY, offsetX: view.offsetX, offsetY: view.offsetY, sourcePerPixel: crop.w / Math.max(1, rect.width) });
  }

  function beginZoomDrag(event) {
    if (!stageRef.current || !crop) return;
    event.preventDefault();
    setDrag({ type: "zoom", x: event.clientX, y: event.clientY, startZoom: view.zoom });
  }

  function beginShapeDrag(event) {
    if (tool !== "select" || !crop) return;
    event.preventDefault(); event.stopPropagation();
    const start = cropPointToPage(pointFromEvent(event, stageRef.current), crop);
    setSelectedObject("shape"); setDrag({ type: "shape", start, points: clone(pageOverlay.shape?.points || []) });
  }

  function beginPinDrag(event) {
    if (tool !== "select" || !crop) return;
    event.preventDefault(); event.stopPropagation(); setSelectedObject("pin"); setDrag({ type: "pin" });
  }

  function startStage(event) {
    if (!stageRef.current || !crop) return;
    const point = pointFromEvent(event, stageRef.current);
    if (tool === "pan" || spaceDown || event.button === 1) return beginPan(event);
    if (tool === "zoom") return beginZoomDrag(event);
    if (tool === "select") { setSelectedObject(null); return; }
    if (tool === "rectangle") { setRectStart(point); return; }
    if (tool === "pen") {
      if (pathDraft.length >= 3) {
        const first = pathDraft[0];
        const rect = stageRef.current.getBoundingClientRect();
        if (Math.hypot(first.x - point.x, first.y - point.y) <= 14 / Math.max(1, rect.width)) { finishPath(); return; }
      }
      setPathDraft((current) => [...current, point]); return;
    }
    if (tool === "pin") {
      const pagePoint = cropPointToPage(point, crop);
      patchPin({ visible: true, x: pagePoint.x, y: pagePoint.y }); setSelectedObject("pin"); setTool("select");
    }
  }

  function moveStage(event) {
    if (!stageRef.current || !crop) return;
    if (drag?.type === "pan") {
      patchView({ offsetX: Math.round(drag.offsetX - (event.clientX - drag.x) * drag.sourcePerPixel), offsetY: Math.round(drag.offsetY - (event.clientY - drag.y) * drag.sourcePerPixel) }); return;
    }
    if (drag?.type === "zoom") {
      const delta = (event.clientX - drag.x) - (event.clientY - drag.y) * 0.25;
      patchView({ zoom: drag.startZoom * Math.exp(delta * 0.008) }); return;
    }
    const normalized = pointFromEvent(event, stageRef.current);
    const pagePoint = cropPointToPage(normalized, crop);
    if (drag?.type === "shape") {
      const dx = pagePoint.x - drag.start.x; const dy = pagePoint.y - drag.start.y;
      setPageOverlay((current) => ({ ...current, shape: { ...(current.shape || {}), points: drag.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) }, status: "edited", stale: false })); return;
    }
    if (drag?.type === "pin") { patchPin({ visible: true, x: pagePoint.x, y: pagePoint.y }); return; }
    if (dragNode) {
      setPageOverlay((current) => { const next = clone(current); next.shape.points[dragNode.index] = pagePoint; next.status = "edited"; next.stale = false; return next; }); return;
    }
    if (rectStart && tool === "rectangle") {
      const x1 = Math.min(rectStart.x, normalized.x), x2 = Math.max(rectStart.x, normalized.x), y1 = Math.min(rectStart.y, normalized.y), y2 = Math.max(rectStart.y, normalized.y);
      const points = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }].map((point) => cropPointToPage(point, crop));
      setPageOverlay((current) => ({ ...current, shape: { type: "polygon", source: "manual", points }, status: "edited", stale: false }));
    }
  }

  function endStage() {
    if (rectStart && pageOverlay.shape?.points?.length >= 3) { setSelectedObject("shape"); setTool("select"); }
    setDrag(null); setDragNode(null); setRectStart(null);
  }

  function finishPath() {
    if (!crop || pathDraft.length < 3) return;
    const points = pathDraft.map((point) => cropPointToPage(point, crop));
    setPageOverlay((current) => ({ ...current, shape: { type: "polygon", source: "manual", points }, status: "edited", stale: false }));
    setPathDraft([]); setSelectedObject("shape"); setTool("select");
  }

  function clearShape() {
    setPageOverlay((current) => ({ ...current, shape: { type: "polygon", source: "locator", points: [] }, status: current.pin?.visible ? "edited" : "locator", stale: false }));
    setPathDraft([]); setSelectedObject(null);
  }

  function clearPin() {
    setPageOverlay((current) => ({ ...current, pin: { ...(current.pin || {}), visible: false }, status: current.shape?.points?.length ? current.status : "locator", stale: false }));
    setSelectedObject(null);
  }

  function saveAndDone() { if (crop) onSave?.(view, { ...overlayToCropSpace(pageOverlay, crop), stale: false }); }

  function zoomAtClient(clientX, clientY, nextZoom) {
    if (!stageRef.current || !crop) return patchView({ zoom: nextZoom });
    const rect = stageRef.current.getBoundingClientRect();
    const nx = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1), ny = clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    const anchorPage = { x: crop.x + nx * crop.w, y: crop.y + ny * crop.h };
    const targetZoom = clamp(nextZoom, FLOORPLAN_ZOOM_MIN, FLOORPLAN_ZOOM_MAX);
    const probe = calculateCropRect({ ...pageRender, anchorX: anchorPage.x, anchorY: anchorPage.y }, { zoom: targetZoom, offsetX: 0, offsetY: 0 }, FLOORPLAN_FRAME_ASPECT);
    const nextCenter = { x: anchorPage.x - (nx - 0.5) * probe.w, y: anchorPage.y - (ny - 0.5) * probe.h };
    patchView({ zoom: targetZoom, offsetX: nextCenter.x - pageRender.anchorX, offsetY: nextCenter.y - pageRender.anchorY });
  }

  function handleWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.004 : 0.0018));
    zoomAtClient(event.clientX, event.clientY, view.zoom * factor);
  }

  function startZoomScrub(event) {
    event.preventDefault(); zoomScrubRef.current = { x: event.clientX, zoom: view.zoom }; event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveZoomScrub(event) { if (zoomScrubRef.current) patchView({ zoom: zoomScrubRef.current.zoom * Math.exp((event.clientX - zoomScrubRef.current.x) * 0.012) }); }
  function endZoomScrub(event) { zoomScrubRef.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); }

  function navigateTo(event) {
    if (!pageRender) return;
    const p = pointFromEvent(event, event.currentTarget);
    patchView({ offsetX: p.x * pageRender.width - pageRender.anchorX, offsetY: p.y * pageRender.height - pageRender.anchorY });
  }

  if (!locatorResult || !pageRender || !crop) return <div className="unified-floorplan-empty"><strong>Không có floorplan để chỉnh.</strong><button type="button" onClick={onCancel}>Back to Poster</button></div>;

  const shapePoints = overlay.shape?.points || [];
  const hasShape = shapePoints.length >= 3;
  const polygonString = shapePoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
  const draftString = pathDraft.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
  const style = { ...DEFAULT_STYLE, ...(overlay.style || {}) };
  const previewAssets = { ...(posterAssets || {}), floorplanImage: liveCrop?.dataUrl || posterAssets?.floorplanImage || null };
  const fastImageStyle = { width: `${(pageRender.width / crop.w) * 100}%`, height: `${(pageRender.height / crop.h) * 100}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` };
  const navRect = { left: `${clamp(crop.x / pageRender.width, 0, 1) * 100}%`, top: `${clamp(crop.y / pageRender.height, 0, 1) * 100}%`, width: `${clamp(crop.w / pageRender.width, 0.02, 1) * 100}%`, height: `${clamp(crop.h / pageRender.height, 0.02, 1) * 100}%` };
  const navAnchor = { left: `${clamp(pageRender.anchorX / pageRender.width, 0, 1) * 100}%`, top: `${clamp(pageRender.anchorY / pageRender.height, 0, 1) * 100}%` };
  const tools = [["select", "↖", "Select", "V"], ["pan", "✋", "Hand", "H"], ["zoom", "⌕", "Zoom", "Z"], ["rectangle", "▭", "Rectangle", "R"], ["pen", "✒", "Pen", "P"], ["pin", "⌖", "Pin", "I"]];

  return (
    <div className={`unified-floorplan unified-floorplan-v2 ${posterOpen ? "poster-open" : ""}`}>
      <header className="unified-floorplan-topbar">
        <button type="button" className="unified-back" onClick={onCancel}>← Back</button>
        <div><span>EDIT FLOORPLAN</span><strong>{unit?.unitCode}</strong><small>Navigate · Highlight · Pin · Save</small></div>
        <button type="button" className="unified-save" onClick={saveAndDone}>Save & Done</button>
      </header>

      <div className="unified-editor-toolbar">
        <div className="unified-tool-strip">
          {tools.map(([key, icon, label, shortcut]) => (
            <button type="button" key={key} className={tool === key ? "active" : ""} onClick={() => { setTool(key); if (key !== "pen") setPathDraft([]); setRectStart(null); }} title={`${label} · ${shortcut}`}>
              <b>{icon}</b><span>{label}</span><kbd>{shortcut}</kbd>
            </button>
          ))}
        </div>
        <div className="unified-toolbar-actions">
          {!hasShape && <button type="button" className="unified-detect-action" onClick={runAutoDetect} disabled={!liveCrop?.dataUrl || detectState.state === "scanning"}>{detectState.state === "scanning" ? "Detecting…" : "✨ Detect Lot"}</button>}
          {locatorResult.matches.length > 1 && <select className="unified-candidate-select" value={locatorResult.selectedMatchIndex ?? 0} onChange={(event) => onCandidateChange?.(Number(event.target.value))}>{locatorResult.matches.map((match, index) => <option key={`${match.pageNumber}-${index}`} value={index}>Candidate {index + 1} · P{match.pageNumber}</option>)}</select>}
          <button type="button" className={posterOpen ? "active" : ""} onClick={() => setPosterOpen((value) => !value)}>{posterOpen ? "Hide Poster" : "Poster Preview"}</button>
        </div>
      </div>

      <div className="unified-floorplan-workspace">
        <main className="unified-canvas-column">
          <div className="unified-canvas-head"><div><span>MASTERPLAN</span><strong>Wheel to zoom · Space/Hand to pan · Z drag to scrub zoom</strong></div><em className={renderState}>{renderState === "rendering" ? "Refining…" : renderState === "ready" ? "HQ ready" : "Fast preview"}</em></div>
          <div ref={stageRef} className={`unified-floorplan-stage tool-${tool} ${spaceDown ? "space-pan" : ""} ${drag ? "is-interacting" : ""}`} onWheel={handleWheel} onMouseDown={startStage} onMouseMove={moveStage} onMouseUp={endStage} onMouseLeave={endStage}>
            {pageRender.dataUrl ? <img src={pageRender.dataUrl} alt={`PDF page ${pageRender.pageNumber}`} className="unified-fast-image" style={fastImageStyle} draggable="false" /> : <div className="unified-fast-placeholder" />}
            {liveCrop?.dataUrl && !drag && renderState === "ready" && <img src={liveCrop.dataUrl} alt={`Vector crop ${unit?.unitCode}`} className="unified-hq-image" draggable="false" />}
            <svg className="unified-overlay-svg unified-overlay-svg-v2" viewBox="0 0 100 100" preserveAspectRatio="none">
              {hasShape && <polygon className="unified-shape-hit" points={polygonString} fill={style.fill} fillOpacity={style.opacity} stroke={style.stroke === "none" ? "none" : style.stroke} strokeWidth={style.strokeWidth || 0} style={{ mixBlendMode: style.blendMode, pointerEvents: tool === "select" ? "all" : "none" }} onMouseDown={beginShapeDrag} />}
              {selectedObject === "shape" && hasShape && <polygon className="unified-selection-outline" points={polygonString} fill="none" stroke="#2f6bff" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />}
              {pathDraft.length >= 2 && <polyline points={draftString} fill="none" stroke="#2f6bff" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />}
            </svg>
            {!hasShape && <i className="unified-locator-dot" style={{ left: `${autoAnchor.x * 100}%`, top: `${autoAnchor.y * 100}%` }} title="Unit code locator" />}
            {tool === "select" && selectedObject === "shape" && shapePoints.map((point, index) => <button key={index} type="button" className="unified-node" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragNode({ index }); }} title="Drag anchor point" />)}
            {pathDraft.map((point, index) => <i key={`draft-${index}`} className="unified-draft-node" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />)}
            {overlay.pin?.visible && pinSrc && <button type="button" className={`unified-pin ${selectedObject === "pin" ? "selected" : ""}`} style={{ left: `${overlay.pin.x * 100}%`, top: `${overlay.pin.y * 100}%`, pointerEvents: tool === "select" ? "auto" : "none" }} onMouseDown={beginPinDrag}><img src={pinSrc} alt="2D pin" draggable="false" style={{ transform: `rotate(${overlay.pin.rotation || 0}deg) scale(${overlay.pin.scale || 1})` }} /></button>}

            <button type="button" className="unified-navigator" onMouseDown={(event) => { event.stopPropagation(); navigateTo(event); }} title="Click to navigate">
              <span className="unified-navigator-label">NAVIGATOR</span>
              <span className="unified-navigator-page">
                {pageRender.dataUrl && <img src={pageRender.dataUrl} alt="" draggable="false" />}
                <i className="unified-navigator-anchor" style={navAnchor} />
                <i className="unified-navigator-viewport" style={navRect} />
              </span>
            </button>

            <div className="unified-zoom-float" onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => patchView({ zoom: view.zoom / 1.2 })}>−</button>
              <button type="button" className="unified-zoom-scrub" onPointerDown={startZoomScrub} onPointerMove={moveZoomScrub} onPointerUp={endZoomScrub} onPointerCancel={endZoomScrub} title="Drag left/right to zoom">{Math.round(view.zoom)}% <small>↔</small></button>
              <button type="button" onClick={() => patchView({ zoom: view.zoom * 1.2 })}>+</button>
              <button type="button" className="fit" onClick={() => setView(DEFAULT_FLOORPLAN_VIEW)}>Fit</button>
            </div>
          </div>
          <div className="unified-canvas-hint"><span>Wheel Zoom</span><span>Space Pan</span><span>Z Drag Zoom</span><span>R Rectangle</span><span>P Pen</span><span>I Pin</span></div>
        </main>

        <aside className="unified-inspector-panel">
          <div className="unified-inspector-head"><span>INSPECTOR</span><strong>{selectedObject === "shape" ? "Highlight" : selectedObject === "pin" ? "2D Pin" : "Nothing selected"}</strong></div>
          {!selectedObject && <div className="unified-empty-inspector">Chọn Highlight hoặc Pin trực tiếp trên canvas. Các thuộc tính chỉ xuất hiện khi cần.</div>}
          {selectedObject === "shape" && hasShape && <div className="unified-context-panel">
            <label className="unified-style-row"><span>Fill</span><input type="color" value={style.fill} onChange={(event) => patchStyle({ fill: event.target.value })} /></label>
            <label className="unified-style-row"><span>Opacity <b>{Math.round(style.opacity * 100)}%</b></span><input type="range" min="0" max="0.85" step="0.01" value={style.opacity} onChange={(event) => patchStyle({ opacity: Number(event.target.value) })} /></label>
            <label className="unified-style-row"><span>Blend mode</span><select value={style.blendMode} onChange={(event) => patchStyle({ blendMode: event.target.value })}><option value="multiply">Multiply</option><option value="normal">Normal</option><option value="overlay">Overlay</option><option value="screen">Screen</option><option value="darken">Darken</option></select></label>
            <button type="button" className="unified-secondary" onClick={runAutoDetect} disabled={!liveCrop?.dataUrl}>✨ Redetect Lot</button>
            <button type="button" className="unified-secondary danger-soft" onClick={clearShape}>Delete Highlight</button>
          </div>}
          {selectedObject === "pin" && overlay.pin?.visible && <div className="unified-context-panel">
            <label className="unified-style-row"><span>Size <b>{Math.round((overlay.pin.scale || 1) * 100)}%</b></span><input type="range" min={PIN_SCALE_MIN} max={PIN_SCALE_MAX} step="0.05" value={overlay.pin.scale || 1} onChange={(event) => setPinScale(event.target.value)} /></label>
            <label className="unified-style-row"><span>Rotation <b>{Math.round(overlay.pin.rotation || 0)}°</b></span><input type="range" min="0" max="360" step="1" value={overlay.pin.rotation || 0} onChange={(event) => setPinRotation(event.target.value)} /></label>
            <button type="button" className="unified-secondary" onClick={() => setPinRotation(0)}>Reset Rotation</button>
            <button type="button" className="unified-secondary danger-soft" onClick={clearPin}>Remove Pin</button>
          </div>}
          {!!detectState.message && <p className={`unified-detect-status ${detectState.state}`}>{detectState.message}</p>}
        </aside>

        {posterOpen && <aside className="unified-live-panel unified-live-panel-v2">
          <div className="unified-live-head"><span>LIVE POSTER</span><strong>Composition preview</strong></div>
          <div className="unified-poster-frame"><PosterCanvas unit={unit} assets={previewAssets} isEditing={false} lotOverlay={{ ...overlay, stale: false }} preferLotOverlay previewZoom={1} /></div>
          <div className="unified-live-note"><strong>{hasShape ? "Highlight synced" : "Locator only"}</strong><span>Preview chỉ bật khi bạn cần kiểm tra composition.</span></div>
        </aside>}
      </div>
    </div>
  );
}
