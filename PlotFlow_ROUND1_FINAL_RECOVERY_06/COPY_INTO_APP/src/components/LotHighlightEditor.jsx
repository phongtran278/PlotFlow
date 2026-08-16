import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_STYLE = {
  fill: "#d91e36",
  opacity: 0.32,
  blendMode: "multiply",
  stroke: "none",
  strokeWidth: 0,
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function makeAutoShape(anchor = { x: 0.5, y: 0.5 }) {
  const w = 0.15;
  const h = 0.16;
  return {
    type: "polygon",
    source: "auto",
    points: [
      { x: clamp01(anchor.x - w / 2), y: clamp01(anchor.y - h / 2) },
      { x: clamp01(anchor.x + w / 2), y: clamp01(anchor.y - h / 2) },
      { x: clamp01(anchor.x + w / 2), y: clamp01(anchor.y + h / 2) },
      { x: clamp01(anchor.x - w / 2), y: clamp01(anchor.y + h / 2) },
    ],
  };
}

function pointFromEvent(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01((event.clientY - rect.top) / rect.height),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function LotHighlightEditor({
  unit,
  imageSrc,
  initialOverlay,
  autoAnchor = { x: 0.5, y: 0.5 },
  pinSrc,
  viewSignature = "",
  onCancel,
  onSave,
}) {
  const stageRef = useRef(null);
  const initial = useMemo(() => initialOverlay || {
    shape: makeAutoShape(autoAnchor),
    style: DEFAULT_STYLE,
    pin: { visible: true, x: autoAnchor.x, y: Math.max(0.05, autoAnchor.y - 0.08), scale: 1 },
    viewSignature,
    status: "auto",
  }, [initialOverlay, autoAnchor.x, autoAnchor.y, viewSignature]);

  const [overlay, setOverlay] = useState(() => clone(initial));
  const [tool, setTool] = useState("direct");
  const [draft, setDraft] = useState([]);
  const [rectStart, setRectStart] = useState(null);
  const [dragNode, setDragNode] = useState(null);
  const [dragPin, setDragPin] = useState(false);
  const [history, setHistory] = useState([clone(initial)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  function commit(next) {
    setOverlay(next);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const result = [...trimmed, clone(next)].slice(-60);
      setHistoryIndex(result.length - 1);
      return result;
    });
  }

  function patch(mutator, shouldCommit = false) {
    setOverlay((prev) => {
      const next = mutator(clone(prev));
      if (shouldCommit) {
        setTimeout(() => commit(next), 0);
        return prev;
      }
      return next;
    });
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setOverlay(clone(history[nextIndex]));
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setOverlay(clone(history[nextIndex]));
  }

  useEffect(() => {
    function keydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (event.key === "Escape") {
        if (draft.length || rectStart) {
          setDraft([]);
          setRectStart(null);
        } else {
          onCancel?.();
        }
      }
      if (event.key === "Enter" && draft.length >= 3) finishPolygon();
      if ((event.key === "Backspace" || event.key === "Delete") && tool === "direct" && dragNode?.index != null) {
        event.preventDefault();
        deleteNode(dragNode.index);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [historyIndex, history, draft, rectStart, dragNode, tool]);

  function resetAuto() {
    const next = {
      shape: makeAutoShape(autoAnchor),
      style: { ...DEFAULT_STYLE, ...(overlay.style || {}) },
      pin: { visible: true, x: autoAnchor.x, y: Math.max(0.05, autoAnchor.y - 0.08), scale: overlay.pin?.scale || 1 },
      viewSignature,
      status: "auto",
    };
    commit(next);
    setDraft([]);
    setTool("direct");
  }

  function startStage(event) {
    if (!stageRef.current) return;
    if (tool === "polygon" || tool === "pen") {
      const point = pointFromEvent(event, stageRef.current);
      if (draft.length >= 3) {
        const first = draft[0];
        const dx = first.x - point.x;
        const dy = first.y - point.y;
        if (Math.hypot(dx, dy) < 0.025) {
          finishPolygon();
          return;
        }
      }
      setDraft((prev) => [...prev, point]);
      return;
    }
    if (tool === "rectangle") {
      setRectStart(pointFromEvent(event, stageRef.current));
    }
  }

  function moveStage(event) {
    if (!stageRef.current) return;
    const point = pointFromEvent(event, stageRef.current);

    if (dragNode) {
      setOverlay((prev) => {
        const next = clone(prev);
        next.shape.points[dragNode.index] = point;
        next.status = "edited";
        return next;
      });
      return;
    }

    if (dragPin) {
      setOverlay((prev) => ({
        ...prev,
        pin: { ...(prev.pin || {}), visible: true, x: point.x, y: point.y },
        status: "edited",
      }));
      return;
    }

    if (rectStart && tool === "rectangle") {
      const x1 = Math.min(rectStart.x, point.x);
      const x2 = Math.max(rectStart.x, point.x);
      const y1 = Math.min(rectStart.y, point.y);
      const y2 = Math.max(rectStart.y, point.y);
      setOverlay((prev) => ({
        ...prev,
        shape: {
          type: "polygon",
          source: "manual",
          points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }],
        },
        status: "edited",
      }));
    }
  }

  function endStage() {
    if (dragNode || dragPin || rectStart) commit({ ...overlay, status: "edited", viewSignature });
    setDragNode(null);
    setDragPin(false);
    setRectStart(null);
  }

  function finishPolygon() {
    if (draft.length < 3) return;
    const next = {
      ...overlay,
      shape: { type: "polygon", source: "manual", points: draft },
      status: "edited",
      viewSignature,
    };
    commit(next);
    setDraft([]);
    setTool("direct");
  }

  function addNodeAfter(index) {
    const points = overlay.shape?.points || [];
    if (points.length < 2) return;
    const current = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const point = { x: (current.x + nextPoint.x) / 2, y: (current.y + nextPoint.y) / 2 };
    const next = clone(overlay);
    next.shape.points.splice(index + 1, 0, point);
    next.status = "edited";
    next.viewSignature = viewSignature;
    commit(next);
  }

  function deleteNode(index) {
    const points = overlay.shape?.points || [];
    if (points.length <= 3) return;
    const next = clone(overlay);
    next.shape.points.splice(index, 1);
    next.status = "edited";
    next.viewSignature = viewSignature;
    commit(next);
    setDragNode(null);
  }

  function setStyle(field, value) {
    const next = {
      ...overlay,
      style: { ...DEFAULT_STYLE, ...(overlay.style || {}), [field]: value },
      status: "edited",
      viewSignature,
    };
    commit(next);
  }

  const shapePoints = overlay.shape?.points || [];
  const polygonString = shapePoints.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
  const draftString = draft.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
  const style = { ...DEFAULT_STYLE, ...(overlay.style || {}) };

  return (
    <div className="lot-editor-shell">
      <header className="lot-editor-header">
        <div>
          <span>EDIT LOT HIGHLIGHT</span>
          <h2>{unit?.unitCode || "Floorplan"}</h2>
        </div>
        <div className="lot-editor-actions">
          <button type="button" onClick={undo} disabled={historyIndex <= 0}>↶</button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1}>↷</button>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" onClick={() => onSave?.({ ...overlay, viewSignature })}>Save Override</button>
        </div>
      </header>

      <div className="lot-editor-layout">
        <aside className="lot-tools">
          <span className="section-label">TOOLS</span>
          {[
            ["direct", "◈ Direct Select"],
            ["rectangle", "▭ Rectangle"],
            ["polygon", "⬠ Polygon"],
            ["pen", "✒ Pen / Path"],
          ].map(([key, label]) => (
            <button type="button" key={key} className={tool === key ? "active" : ""} onClick={() => { setTool(key); setDraft([]); setRectStart(null); }}>{label}</button>
          ))}
          <button type="button" onClick={() => setOverlay((prev) => ({ ...prev, pin: { ...(prev.pin || {}), visible: !prev.pin?.visible } }))}>⌖ {overlay.pin?.visible ? "Hide Pin" : "Show Pin"}</button>
          <button type="button" className="auto-tool" onClick={resetAuto}>✨ Reset to Auto</button>
          <p>Polygon/Pen: click từng đỉnh, click lại điểm đầu hoặc Enter để đóng path.</p>
        </aside>

        <main className="lot-canvas-wrap">
          <div
            ref={stageRef}
            className={`lot-canvas tool-${tool}`}
            onMouseDown={startStage}
            onMouseMove={moveStage}
            onMouseUp={endStage}
            onMouseLeave={endStage}
          >
            {imageSrc ? <img src={imageSrc} alt="Floorplan crop" draggable="false" /> : <div className="lot-empty">Floorplan chưa được render.</div>}
            <svg className="lot-overlay-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              {shapePoints.length >= 3 && (
                <polygon
                  points={polygonString}
                  fill={style.fill}
                  fillOpacity={style.opacity}
                  stroke={style.stroke === "none" ? "none" : style.stroke}
                  strokeWidth={style.strokeWidth || 0}
                  style={{ mixBlendMode: style.blendMode }}
                />
              )}
              {draft.length >= 2 && <polyline points={draftString} fill="none" stroke="#4f7cff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />}
            </svg>

            {tool === "direct" && shapePoints.map((point, index) => (
              <button
                key={index}
                type="button"
                className="lot-node"
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragNode({ index }); }}
                onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); addNodeAfter(index); }}
                onContextMenu={(event) => { event.preventDefault(); deleteNode(index); }}
                title="Drag · Double-click add point · Right-click delete"
              />
            ))}

            {draft.map((point, index) => (
              <i key={`draft-${index}`} className="lot-draft-node" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
            ))}

            {overlay.pin?.visible && pinSrc && (
              <button
                type="button"
                className="lot-pin"
                style={{
                  left: `${clamp01(overlay.pin.x) * 100}%`,
                  top: `${clamp01(overlay.pin.y) * 100}%`,
                  transform: `translate(-50%, -92%) scale(${overlay.pin.scale || 1})`,
                }}
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragPin(true); }}
                title="Drag 2D pin"
              >
                <img src={pinSrc} alt="2D pin" draggable="false" />
              </button>
            )}
          </div>
        </main>

        <aside className="lot-style-panel">
          <span className="section-label">STYLE</span>
          <label><span>Fill</span><input type="color" value={style.fill} onChange={(e) => setStyle("fill", e.target.value)} /></label>
          <label><span>Opacity</span><input type="range" min="0" max="0.8" step="0.01" value={style.opacity} onChange={(e) => setStyle("opacity", Number(e.target.value))} /><b>{Math.round(style.opacity * 100)}%</b></label>
          <label><span>Blend</span><select value={style.blendMode} onChange={(e) => setStyle("blendMode", e.target.value)}><option value="multiply">Multiply</option><option value="normal">Normal</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select></label>
          <label><span>Pin scale</span><input type="range" min="0.4" max="2" step="0.05" value={overlay.pin?.scale || 1} onChange={(e) => setOverlay((prev) => ({ ...prev, pin: { ...(prev.pin || {}), scale: Number(e.target.value) } }))} /><b>{Math.round((overlay.pin?.scale || 1) * 100)}%</b></label>
          <div className={`lot-status ${overlay.status || "auto"}`}><strong>{overlay.status === "edited" ? "✎ Manual Override" : "✨ Auto Suggestion"}</strong><span>{overlay.status === "edited" ? "Designer path được ưu tiên khi export." : "Điểm khởi đầu tự động quanh mã căn. Sửa node nếu chưa đúng."}</span></div>
        </aside>
      </div>
    </div>
  );
}
