import { useEffect, useMemo, useRef, useState } from "react";
import { calculateCropRect, FLOORPLAN_FRAME_ASPECT, FLOORPLAN_ZOOM_MAX, FLOORPLAN_ZOOM_MIN } from "../floorplan/pdfLocator";

export const DEFAULT_FLOORPLAN_VIEW = {
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  highlight: true,
  highlightOpacity: 0.35,
  highlightSize: 48,
};

export default function FloorplanFineTune({
  unit,
  locatorResult,
  pageRender,
  initialView,
  onCancel,
  onSave,
  onCandidateChange,
  onRenderVectorPreview,
}) {
  const [view, setView] = useState({ ...DEFAULT_FLOORPLAN_VIEW, ...initialView });
  const [drag, setDrag] = useState(null);
  const stageRef = useRef(null);
  const renderSequence = useRef(0);
  const [hqPreview, setHqPreview] = useState(null);
  const [hqPreviewKey, setHqPreviewKey] = useState("");
  const [hqState, setHqState] = useState("idle");

  const crop = useMemo(() => {
    if (!pageRender) return null;
    return calculateCropRect(pageRender, view, FLOORPLAN_FRAME_ASPECT);
  }, [pageRender, view]);

  const currentPreviewKey = `${pageRender?.pageNumber || 0}:${Math.round(view.zoom)}:${Math.round(view.offsetX)}:${Math.round(view.offsetY)}`;

  useEffect(() => {
    if (!pageRender || !onRenderVectorPreview || drag) return;

    const sequence = ++renderSequence.current;
    const timer = window.setTimeout(async () => {
      try {
        setHqState("rendering");
        const result = await onRenderVectorPreview(view);
        if (sequence !== renderSequence.current || !result) return;
        setHqPreview(result);
        setHqPreviewKey(currentPreviewKey);
        setHqState("ready");
      } catch (error) {
        if (sequence !== renderSequence.current) return;
        console.error(error);
        setHqState("error");
      }
    }, 170);

    return () => window.clearTimeout(timer);
  }, [pageRender, view.zoom, view.offsetX, view.offsetY, drag, onRenderVectorPreview]);

  const imageStyle = useMemo(() => {
    if (!pageRender || !crop) return {};
    const stageW = 820;
    const scale = stageW / crop.w;
    return {
      width: `${pageRender.width * scale}px`,
      height: `${pageRender.height * scale}px`,
      left: `${-crop.x * scale}px`,
      top: `${-crop.y * scale}px`,
    };
  }, [pageRender, crop]);

  const markerStyle = useMemo(() => {
    if (!pageRender || !crop) return {};
    const stageW = 820;
    const scale = stageW / crop.w;
    return {
      left: `${(pageRender.anchorX - crop.x) * scale}px`,
      top: `${(pageRender.anchorY - crop.y) * scale}px`,
      width: `${view.highlightSize * 2}px`,
      height: `${view.highlightSize * 1.2}px`,
      opacity: view.highlight ? view.highlightOpacity : 0,
    };
  }, [pageRender, crop, view.highlight, view.highlightOpacity, view.highlightSize]);

  function patch(patchValue) {
    setView((prev) => {
      const next = { ...prev, ...patchValue };
      if (Object.prototype.hasOwnProperty.call(patchValue, "zoom")) {
        next.zoom = Math.max(FLOORPLAN_ZOOM_MIN, Math.min(FLOORPLAN_ZOOM_MAX, Number(next.zoom) || 100));
      }
      return next;
    });
  }

  function startDrag(event) {
    if (!crop) return;
    event.preventDefault();
    const stageWidth = stageRef.current?.getBoundingClientRect().width || 820;
    const sourcePerScreenPixel = crop.w / stageWidth;
    setDrag({
      x: event.clientX,
      y: event.clientY,
      offsetX: view.offsetX,
      offsetY: view.offsetY,
      sourcePerScreenPixel,
    });
  }

  function moveDrag(event) {
    if (!drag) return;
    patch({
      offsetX: Math.round(drag.offsetX - (event.clientX - drag.x) * drag.sourcePerScreenPixel),
      offsetY: Math.round(drag.offsetY - (event.clientY - drag.y) * drag.sourcePerScreenPixel),
    });
  }

  function stopDrag() {
    setDrag(null);
  }

  if (!locatorResult || !pageRender) {
    return (
      <div className="floorplan-finetune-empty">
        <strong>Không có floorplan để fine-tune.</strong>
        <button onClick={onCancel}>Back to Poster</button>
      </div>
    );
  }

  return (
    <div className="floorplan-finetune" onMouseMove={moveDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag}>
      <div className="finetune-topbar">
        <button className="finetune-back" onClick={onCancel}>← Back to Poster</button>
        <div>
          <span>EDIT FLOORPLAN VIEW</span>
          <strong>{unit.unitCode}</strong>
        </div>
        <button className="finetune-save" onClick={() => onSave(view)}>Save Override</button>
      </div>

      <div className="finetune-workspace">
        <section className="finetune-canvas-panel">
          <div
            ref={stageRef}
            className={`floorplan-viewport ${drag ? "dragging" : ""}`}
            onMouseDown={startDrag}
          >
            <img
              src={pageRender.dataUrl}
              alt={`PDF page ${pageRender.pageNumber}`}
              className={`floorplan-fast-preview ${hqPreviewKey === currentPreviewKey ? "dimmed" : ""}`}
              style={imageStyle}
              draggable={false}
            />
            {hqPreview?.dataUrl && hqPreviewKey === currentPreviewKey && (
              <img
                src={hqPreview.dataUrl}
                alt={`HQ vector crop ${unit.unitCode}`}
                className="floorplan-hq-preview"
                draggable={false}
              />
            )}
            <div className={`hq-render-badge ${hqState}`}>
              {hqState === "rendering"
                ? "Rendering vector HQ…"
                : hqPreviewKey === currentPreviewKey && hqPreview
                  ? `Vector HQ · ${hqPreview.renderScale.toFixed(1)}×`
                  : "Fast preview"}
            </div>
            <div className="floorplan-target-marker" style={markerStyle}>
              <span>{unit.unitCode}</span>
            </div>
            <div className="viewport-hint">Drag to reposition</div>
          </div>
        </section>

        <aside className="finetune-inspector">
          <div className="finetune-section">
            <span className="finetune-label">SOURCE</span>
            <div className="finetune-stat"><span>Page</span><strong>{pageRender.pageNumber}</strong></div>
            <div className="finetune-stat"><span>Matches</span><strong>{locatorResult.matches.length}</strong></div>
          </div>

          {locatorResult.matches.length > 1 && (
            <div className="finetune-section">
              <span className="finetune-label">CANDIDATE</span>
              <div className="candidate-grid">
                {locatorResult.matches.map((match, index) => (
                  <button
                    key={`${match.pageNumber}-${index}`}
                    className={locatorResult.selectedMatchIndex === index ? "active" : ""}
                    onClick={() => onCandidateChange(index)}
                  >
                    #{index + 1} · Page {match.pageNumber}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="finetune-section">
            <span className="finetune-label">ZOOM · VECTOR</span>
            <div className="zoom-stepper zoom-stepper-wide">
              <button onClick={() => patch({ zoom: view.zoom - 25 })}>−</button>
              <label className="zoom-number-field">
                <input
                  type="number"
                  min={FLOORPLAN_ZOOM_MIN}
                  max={FLOORPLAN_ZOOM_MAX}
                  step="25"
                  value={Math.round(view.zoom)}
                  onChange={(e) => patch({ zoom: Number(e.target.value) })}
                />
                <span>%</span>
              </label>
              <button onClick={() => patch({ zoom: view.zoom + 25 })}>+</button>
            </div>
            <input
              className="finetune-range"
              type="range"
              min={FLOORPLAN_ZOOM_MIN}
              max={FLOORPLAN_ZOOM_MAX}
              step="10"
              value={view.zoom}
              onChange={(e) => patch({ zoom: Number(e.target.value) })}
            />
            <div className="zoom-presets">
              {[100, 250, 500, 1000, 1500, 2000].map((zoom) => (
                <button key={zoom} className={Math.round(view.zoom) === zoom ? "active" : ""} onClick={() => patch({ zoom })}>
                  {zoom}%
                </button>
              ))}
            </div>
            <small className="vector-zoom-note">Pan/zoom dùng preview nhanh; sau khi dừng, PlotFlow render lại trực tiếp từ PDF vector.</small>
          </div>

          <div className="finetune-section">
            <span className="finetune-label">POSITION</span>
            <div className="position-fields">
              <label><span>X</span><input type="number" value={view.offsetX} onChange={(e) => patch({ offsetX: Number(e.target.value) || 0 })} /></label>
              <label><span>Y</span><input type="number" value={view.offsetY} onChange={(e) => patch({ offsetY: Number(e.target.value) || 0 })} /></label>
            </div>
          </div>

          <div className="finetune-section">
            <span className="finetune-label">HIGHLIGHT</span>
            <label className="finetune-toggle"><span>Show target</span><input type="checkbox" checked={view.highlight} onChange={(e) => patch({ highlight: e.target.checked })} /></label>
            <label className="slider-field"><span>Opacity <b>{Math.round(view.highlightOpacity * 100)}%</b></span><input type="range" min="0.1" max="0.7" step="0.05" value={view.highlightOpacity} onChange={(e) => patch({ highlightOpacity: Number(e.target.value) })} /></label>
            <label className="slider-field"><span>Size <b>{view.highlightSize}px</b></span><input type="range" min="24" max="100" step="2" value={view.highlightSize} onChange={(e) => patch({ highlightSize: Number(e.target.value) })} /></label>
          </div>

          <button className="reset-auto-view" onClick={() => setView(DEFAULT_FLOORPLAN_VIEW)}>Reset Auto View</button>
        </aside>
      </div>
    </div>
  );
}
