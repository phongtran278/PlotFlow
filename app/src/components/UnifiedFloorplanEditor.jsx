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

export const DEFAULT_FLOORPLAN_VIEW = {
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_STYLE = {
  fill: "#d91e36",
  opacity: 0.32,
  blendMode: "multiply",
  stroke: "none",
  strokeWidth: 0,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyOverlay() {
  return {
    shape: { type: "polygon", source: "locator", points: [] },
    style: DEFAULT_STYLE,
    pin: { visible: false, x: 0.5, y: 0.5, scale: 1, rotation: 0, anchor: "tip" },
    status: "locator",
  };
}

function pointFromEvent(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function sameCrop(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) < 0.01
    && Math.abs(a.y - b.y) < 0.01
    && Math.abs(a.w - b.w) < 0.01
    && Math.abs(a.h - b.h) < 0.01;
}

function remapPoint(point, fromCrop, toCrop) {
  const pageX = fromCrop.x + Number(point.x || 0) * fromCrop.w;
  const pageY = fromCrop.y + Number(point.y || 0) * fromCrop.h;
  return {
    x: (pageX - toCrop.x) / toCrop.w,
    y: (pageY - toCrop.y) / toCrop.h,
  };
}

function remapOverlay(overlay, fromCrop, toCrop) {
  if (!overlay || !fromCrop || !toCrop || sameCrop(fromCrop, toCrop)) return overlay;
  const next = clone(overlay);
  if (next.shape?.points?.length) {
    next.shape.points = next.shape.points.map((point) => remapPoint(point, fromCrop, toCrop));
  }
  if (next.pin) {
    const pinPoint = remapPoint(next.pin, fromCrop, toCrop);
    next.pin = { ...next.pin, ...pinPoint };
  }
  return next;
}

function formatDetection(result) {
  if (!result?.accepted) {
    if (result?.reason === "low-confidence") {
      return `Boundary chưa đủ chắc · ${Math.round((result.confidence || 0) * 100)}%`;
    }
    return "Chưa tìm thấy boundary khép kín đủ tin cậy.";
  }
  const kind = result.classification === "rectangle" ? "Rectangle" : `Polygon ${result.vertices} cạnh`;
  return `${kind} · ${Math.round(result.confidence * 100)}%`;
}

export default function UnifiedFloorplanEditor({
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
  const renderSequence = useRef(0);
  const previousCropRef = useRef(null);
  const autoRanRef = useRef(false);

  const [view, setView] = useState({ ...DEFAULT_FLOORPLAN_VIEW, ...(initialView || {}) });
  const [overlay, setOverlay] = useState(() => {
    const base = initialOverlay ? clone(initialOverlay) : emptyOverlay();
    base.style = { ...DEFAULT_STYLE, ...(base.style || {}) };
    base.shape = base.shape || { type: "polygon", source: "locator", points: [] };
    base.pin = { ...emptyOverlay().pin, ...(base.pin || {}) };
    base.stale = false;
    return base;
  });
  const [tool, setTool] = useState("pan");
  const [drag, setDrag] = useState(null);
  const [rectStart, setRectStart] = useState(null);
  const [polygonDraft, setPolygonDraft] = useState([]);
  const [dragNode, setDragNode] = useState(null);
  const [dragPin, setDragPin] = useState(false);
  const [liveCrop, setLiveCrop] = useState(null);
  const [renderState, setRenderState] = useState("idle");
  const [detectState, setDetectState] = useState({ state: "idle", message: "" });

  const crop = useMemo(() => {
    if (!pageRender) return null;
    return calculateCropRect(pageRender, view, FLOORPLAN_FRAME_ASPECT);
  }, [pageRender, view.zoom, view.offsetX, view.offsetY]);

  const autoAnchor = useMemo(() => {
    if (!pageRender || !crop) return { x: 0.5, y: 0.5 };
    return {
      x: (pageRender.anchorX - crop.x) / crop.w,
      y: (pageRender.anchorY - crop.y) / crop.h,
    };
  }, [pageRender, crop]);

  useEffect(() => {
    if (!crop) return;
    const previous = previousCropRef.current;
    if (previous && !sameCrop(previous, crop)) {
      setOverlay((current) => remapOverlay(current, previous, crop));
    }
    previousCropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    if (!pageRender || !onRenderVectorPreview || drag?.type === "pan") return undefined;
    const sequence = ++renderSequence.current;
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
    }, 120);
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
      if (event.key === "Escape") {
        if (polygonDraft.length || rectStart) {
          setPolygonDraft([]);
          setRectStart(null);
        } else {
          onCancel?.();
        }
      }
      if (event.key === "Enter" && polygonDraft.length >= 3) finishPolygon();
      if (event.key.toLowerCase() === "v") setTool("pan");
      if (event.key.toLowerCase() === "r") setTool("rectangle");
      if (event.key.toLowerCase() === "p") setTool("polygon");
      if (event.key.toLowerCase() === "i") setTool("pin");
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [polygonDraft, rectStart]);

  function patchView(patch) {
    setView((current) => {
      const next = { ...current, ...patch };
      next.zoom = Math.max(
        FLOORPLAN_ZOOM_MIN,
        Math.min(FLOORPLAN_ZOOM_MAX, Number(next.zoom) || 100)
      );
      next.offsetX = Number(next.offsetX) || 0;
      next.offsetY = Number(next.offsetY) || 0;
      return next;
    });
  }

  async function runAutoDetect() {
    const src = liveCrop?.dataUrl;
    if (!src || detectState.state === "scanning") return;
    setDetectState({ state: "scanning", message: "Đang dò shape quanh mã lô…" });
    try {
      const result = await detectLotShape(src, autoAnchor);
      if (result.accepted) {
        setOverlay((current) => ({
          ...current,
          shape: result.shape,
          style: { ...DEFAULT_STYLE, ...(current.style || {}) },
          status: "auto-detected",
          autoConfidence: result.confidence,
          autoClassification: result.classification,
          stale: false,
        }));
        setTool("direct");
        setDetectState({ state: "detected", message: formatDetection(result) });
      } else {
        setDetectState({ state: "fallback", message: `${formatDetection(result)} Dùng Rectangle/Polygon nếu cần.` });
      }
    } catch (error) {
      setDetectState({ state: "fallback", message: error.message || "Auto Shape thất bại." });
    }
  }

  function startStage(event) {
    if (!stageRef.current || !crop) return;
    const point = pointFromEvent(event, stageRef.current);

    if (tool === "pan") {
      event.preventDefault();
      const rect = stageRef.current.getBoundingClientRect();
      setDrag({
        type: "pan",
        x: event.clientX,
        y: event.clientY,
        offsetX: view.offsetX,
        offsetY: view.offsetY,
        sourcePerPixel: crop.w / rect.width,
      });
      return;
    }

    if (tool === "rectangle") {
      setRectStart(point);
      return;
    }

    if (tool === "polygon") {
      setPolygonDraft((current) => [...current, point]);
      return;
    }

    if (tool === "pin") {
      setOverlay((current) => ({
        ...current,
        pin: { ...(current.pin || {}), visible: true, x: point.x, y: point.y, anchor: "tip" },
        status: current.shape?.points?.length ? current.status : "edited",
        stale: false,
      }));
      setTool("direct");
    }
  }

  function moveStage(event) {
    if (!stageRef.current) return;

    if (drag?.type === "pan") {
      patchView({
        offsetX: Math.round(drag.offsetX - (event.clientX - drag.x) * drag.sourcePerPixel),
        offsetY: Math.round(drag.offsetY - (event.clientY - drag.y) * drag.sourcePerPixel),
      });
      return;
    }

    const point = pointFromEvent(event, stageRef.current);

    if (dragNode) {
      setOverlay((current) => {
        const next = clone(current);
        next.shape.points[dragNode.index] = point;
        next.status = "edited";
        next.stale = false;
        return next;
      });
      return;
    }

    if (dragPin) {
      setOverlay((current) => ({
        ...current,
        pin: { ...(current.pin || {}), visible: true, x: point.x, y: point.y, anchor: "tip" },
        status: "edited",
        stale: false,
      }));
      return;
    }

    if (rectStart && tool === "rectangle") {
      const x1 = Math.min(rectStart.x, point.x);
      const x2 = Math.max(rectStart.x, point.x);
      const y1 = Math.min(rectStart.y, point.y);
      const y2 = Math.max(rectStart.y, point.y);
      setOverlay((current) => ({
        ...current,
        shape: {
          type: "polygon",
          source: "manual",
          points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }],
        },
        status: "edited",
        stale: false,
      }));
    }
  }

  function endStage() {
    setDrag(null);
    setRectStart(null);
    setDragNode(null);
    setDragPin(false);
    if (tool === "rectangle" && overlay.shape?.points?.length >= 3) setTool("direct");
  }

  function finishPolygon() {
    if (polygonDraft.length < 3) return;
    setOverlay((current) => ({
      ...current,
      shape: { type: "polygon", source: "manual", points: polygonDraft },
      status: "edited",
      stale: false,
    }));
    setPolygonDraft([]);
    setTool("direct");
  }

  function clearShape() {
    setOverlay((current) => ({
      ...current,
      shape: { type: "polygon", source: "locator", points: [] },
      status: "locator",
      stale: false,
    }));
    setPolygonDraft([]);
    setTool("pan");
  }

  function clearPin() {
    setOverlay((current) => ({
      ...current,
      pin: { ...(current.pin || {}), visible: false },
      stale: false,
    }));
  }

  if (!locatorResult || !pageRender) {
    return (
      <div className="unified-floorplan-empty">
        <strong>Không có floorplan để chỉnh.</strong>
        <button type="button" onClick={onCancel}>Back to Poster</button>
      </div>
    );
  }

  const shapePoints = overlay.shape?.points || [];
  const polygonString = shapePoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
  const draftString = polygonDraft.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");
  const style = { ...DEFAULT_STYLE, ...(overlay.style || {}) };
  const hasShape = shapePoints.length >= 3;
  const previewAssets = {
    ...(posterAssets || {}),
    floorplanImage: liveCrop?.dataUrl || posterAssets?.floorplanImage || null,
  };

  const fastImageStyle = crop ? {
    width: `${(pageRender.width / crop.w) * 100}%`,
    height: `${(pageRender.height / crop.h) * 100}%`,
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
  } : {};

  return (
    <div className="unified-floorplan">
      <header className="unified-floorplan-topbar">
        <button type="button" className="unified-back" onClick={onCancel}>← Back</button>
        <div>
          <span>EDIT FLOORPLAN</span>
          <strong>{unit?.unitCode}</strong>
          <small>View · Highlight · 2D Pin</small>
        </div>
        <button type="button" className="unified-save" onClick={() => onSave?.(view, { ...overlay, stale: false })}>
          Save & Done
        </button>
      </header>

      <div className="unified-floorplan-workspace">
        <aside className="unified-tools">
          <div className="unified-section">
            <span className="unified-label">TOOLS</span>
            <div className="unified-tool-grid">
              {[
                ["pan", "✋", "Pan"],
                ["direct", "◈", "Select"],
                ["rectangle", "▭", "Rectangle"],
                ["polygon", "⬠", "Polygon"],
                ["pin", "⌖", "2D Pin"],
              ].map(([key, icon, label]) => (
                <button
                  type="button"
                  key={key}
                  className={tool === key ? "active" : ""}
                  onClick={() => {
                    setTool(key);
                    if (key !== "polygon") setPolygonDraft([]);
                    setRectStart(null);
                  }}
                >
                  <b>{icon}</b><span>{label}</span>
                </button>
              ))}
            </div>
            {polygonDraft.length >= 3 && (
              <button type="button" className="unified-finish-path" onClick={finishPolygon}>
                Finish Polygon · {polygonDraft.length} points
              </button>
            )}
          </div>

          <div className="unified-section">
            <span className="unified-label">AUTO</span>
            <button type="button" className="unified-auto" onClick={runAutoDetect} disabled={!liveCrop?.dataUrl || detectState.state === "scanning"}>
              {detectState.state === "scanning" ? "… Detecting Shape" : "✨ Auto Detect Shape"}
            </button>
            <p className={`unified-detect-status ${detectState.state}`}>{detectState.message || "Tự dò rectangle hoặc polygon quanh mã lô."}</p>
          </div>

          <div className="unified-section">
            <span className="unified-label">ZOOM / VIEW</span>
            <div className="unified-zoom-row">
              <button type="button" onClick={() => patchView({ zoom: view.zoom - 25 })}>−</button>
              <label><input type="number" min={FLOORPLAN_ZOOM_MIN} max={FLOORPLAN_ZOOM_MAX} step="25" value={Math.round(view.zoom)} onChange={(event) => patchView({ zoom: event.target.value })} /><span>%</span></label>
              <button type="button" onClick={() => patchView({ zoom: view.zoom + 25 })}>+</button>
            </div>
            <input className="unified-range" type="range" min={FLOORPLAN_ZOOM_MIN} max={FLOORPLAN_ZOOM_MAX} step="10" value={view.zoom} onChange={(event) => patchView({ zoom: event.target.value })} />
            <div className="unified-presets">
              {[100, 250, 500, 1000, 1500, 2000].map((zoom) => (
                <button type="button" key={zoom} className={Math.round(view.zoom) === zoom ? "active" : ""} onClick={() => patchView({ zoom })}>{zoom}%</button>
              ))}
            </div>
            <div className="unified-position">
              <label><span>X</span><input type="number" value={Math.round(view.offsetX)} onChange={(event) => patchView({ offsetX: event.target.value })} /></label>
              <label><span>Y</span><input type="number" value={Math.round(view.offsetY)} onChange={(event) => patchView({ offsetY: event.target.value })} /></label>
            </div>
            <button type="button" className="unified-reset-view" onClick={() => patchView(DEFAULT_FLOORPLAN_VIEW)}>Reset View</button>
          </div>

          <div className="unified-section">
            <span className="unified-label">HIGHLIGHT</span>
            <label className="unified-style-row">
              <span>Fill</span>
              <input type="color" value={style.fill} onChange={(event) => setOverlay((current) => ({ ...current, style: { ...style, fill: event.target.value }, status: "edited" }))} />
            </label>
            <label className="unified-style-row">
              <span>Opacity <b>{Math.round(style.opacity * 100)}%</b></span>
              <input type="range" min="0.08" max="0.65" step="0.01" value={style.opacity} onChange={(event) => setOverlay((current) => ({ ...current, style: { ...style, opacity: Number(event.target.value) }, status: "edited" }))} />
            </label>
            <button type="button" className="unified-secondary" onClick={clearShape}>Clear Highlight</button>
          </div>

          <div className="unified-section">
            <span className="unified-label">2D PIN</span>
            <label className="unified-style-row">
              <span>Size <b>{Math.round((overlay.pin?.scale || 1) * 100)}%</b></span>
              <input type="range" min="0.4" max="2.5" step="0.05" value={overlay.pin?.scale || 1} onChange={(event) => setOverlay((current) => ({ ...current, pin: { ...(current.pin || {}), scale: Number(event.target.value) }, status: "edited" }))} />
            </label>
            <button type="button" className="unified-secondary" onClick={clearPin}>Remove Pin</button>
          </div>

          {locatorResult.matches.length > 1 && (
            <div className="unified-section">
              <span className="unified-label">PDF CANDIDATE</span>
              <div className="unified-candidates">
                {locatorResult.matches.map((match, index) => (
                  <button
                    type="button"
                    key={`${match.pageNumber}-${index}`}
                    className={locatorResult.selectedMatchIndex === index ? "active" : ""}
                    onClick={() => onCandidateChange?.(index)}
                  >
                    #{index + 1} · P{match.pageNumber}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="unified-canvas-column">
          <div className="unified-canvas-head">
            <div><span>MASTERPLAN CROP</span><strong>Drag / Zoom / Draw in one place</strong></div>
            <em className={renderState}>{renderState === "rendering" ? "Rendering vector…" : renderState === "ready" ? "Vector HQ" : "Fast preview"}</em>
          </div>
          <div
            ref={stageRef}
            className={`unified-floorplan-stage tool-${tool} ${drag?.type === "pan" ? "dragging" : ""}`}
            onMouseDown={startStage}
            onMouseMove={moveStage}
            onMouseUp={endStage}
            onMouseLeave={endStage}
          >
            <img src={pageRender.dataUrl} alt={`PDF page ${pageRender.pageNumber}`} className="unified-fast-image" style={fastImageStyle} draggable="false" />
            {liveCrop?.dataUrl && <img src={liveCrop.dataUrl} alt={`Vector crop ${unit?.unitCode}`} className="unified-hq-image" draggable="false" />}

            <svg className="unified-overlay-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              {hasShape && (
                <polygon
                  points={polygonString}
                  fill={style.fill}
                  fillOpacity={style.opacity}
                  stroke={style.stroke === "none" ? "none" : style.stroke}
                  strokeWidth={style.strokeWidth || 0}
                  style={{ mixBlendMode: style.blendMode }}
                />
              )}
              {polygonDraft.length >= 2 && <polyline points={draftString} fill="none" stroke="#4f7cff" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />}
            </svg>

            {!hasShape && (
              <i className="unified-locator-dot" style={{ left: `${autoAnchor.x * 100}%`, top: `${autoAnchor.y * 100}%` }} title="Unit code locator" />
            )}

            {tool === "direct" && shapePoints.map((point, index) => (
              <button
                key={index}
                type="button"
                className="unified-node"
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragNode({ index }); }}
                title="Drag point"
              />
            ))}

            {polygonDraft.map((point, index) => (
              <i key={`draft-${index}`} className="unified-draft-node" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
            ))}

            {overlay.pin?.visible && pinSrc && (
              <button
                type="button"
                className="unified-pin"
                style={{ left: `${overlay.pin.x * 100}%`, top: `${overlay.pin.y * 100}%` }}
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragPin(true); }}
                title="Drag 2D pin"
              >
                <img src={pinSrc} alt="2D pin" draggable="false" style={{ transform: `rotate(${overlay.pin.rotation || 0}deg) scale(${overlay.pin.scale || 1})` }} />
              </button>
            )}
          </div>
          <div className="unified-canvas-hint">
            <span>V Pan</span><span>R Rectangle</span><span>P Polygon</span><span>I Pin</span><span>Enter Finish Polygon</span>
          </div>
        </main>

        <aside className="unified-live-panel">
          <div className="unified-live-head">
            <span>LIVE POSTER</span>
            <strong>Thấy kết quả ngay khi chỉnh</strong>
          </div>
          <div className="unified-poster-frame">
            <PosterCanvas
              unit={unit}
              assets={previewAssets}
              isEditing={false}
              lotOverlay={{ ...overlay, stale: false }}
              previewZoom={0.27}
            />
          </div>
          <div className="unified-live-note">
            <strong>{hasShape ? "Highlight synced" : "Locator only"}</strong>
            <span>Zoom, crop, polygon và pin dùng chung một composition.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
