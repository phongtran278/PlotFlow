import { useEffect, useMemo, useRef, useState } from "react";
import { detectLotShape } from "../floorplan/autoLotShape";

const DEFAULT_STYLE = {
  fill: "#d91e36",
  opacity: 0.32,
  blendMode: "multiply",
  stroke: "none",
  strokeWidth: 0,
};

const VIEW_ZOOM_MIN = 100;
const VIEW_ZOOM_MAX = 2000;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyShape(source = "locator") {
  return { type: "polygon", source, points: [] };
}

function pointFromEvent(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01((event.clientY - rect.top) / rect.height),
  };
}

function detectionCopy(result) {
  if (!result?.accepted) {
    if (result?.reason === "low-confidence") return `Chưa đủ chắc chắn · ${Math.round((result.confidence || 0) * 100)}%`;
    return "Không tìm thấy boundary khép kín đủ tin cậy.";
  }
  const kind = result.classification === "rectangle" ? "Rectangle" : `Polygon ${result.vertices} cạnh`;
  return `${kind} · ${Math.round(result.confidence * 100)}% confidence`;
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
  const viewportRef = useRef(null);
  const sceneRef = useRef(null);

  const initial = useMemo(() => {
    if (initialOverlay) {
      const migrated = clone(initialOverlay);
      migrated.shape = migrated.shape || emptyShape();
      migrated.style = { ...DEFAULT_STYLE, ...(migrated.style || {}) };
      migrated.pin = { ...(migrated.pin || {}), visible: migrated.pin?.visible !== false };
      if (migrated.pin.anchor !== "tip") {
        const scale = migrated.pin.scale || 1;
        migrated.pin.y = clamp01((migrated.pin.y ?? autoAnchor.y) + 0.0865 * scale);
        migrated.pin.anchor = "tip";
      }
      migrated.pin.rotation = migrated.pin.rotation || 0;
      return migrated;
    }

    return {
      shape: emptyShape(),
      style: DEFAULT_STYLE,
      pin: { visible: false, x: autoAnchor.x, y: autoAnchor.y, scale: 1, rotation: 0, anchor: "tip" },
      viewSignature,
      status: "locator",
      autoConfidence: 0,
    };
  }, [initialOverlay, autoAnchor.x, autoAnchor.y, viewSignature]);

  const [overlay, setOverlay] = useState(() => clone(initial));
  const [tool, setTool] = useState("direct");
  const [draft, setDraft] = useState([]);
  const [rectStart, setRectStart] = useState(null);
  const [dragNode, setDragNode] = useState(null);
  const [dragPin, setDragPin] = useState(false);
  const [history, setHistory] = useState([clone(initial)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [autoDetectState, setAutoDetectState] = useState({ state: "idle", message: "" });

  // View-only camera. Shape coordinates remain normalized to the canonical crop.
  const [viewZoom, setViewZoom] = useState(100);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [cameraDrag, setCameraDrag] = useState(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const legacyAutoOverlay = Boolean(
    initialOverlay
      && initialOverlay.status === "auto"
      && initialOverlay.shape?.source === "auto"
  );
  const shouldAutoDetectOnOpen = !initialOverlay || legacyAutoOverlay;

  function replaceBaseline(next) {
    const normalized = { ...next, viewSignature };
    setOverlay(normalized);
    setHistory([clone(normalized)]);
    setHistoryIndex(0);
  }

  function commit(next) {
    const normalized = { ...next, viewSignature };
    setOverlay(normalized);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const result = [...trimmed, clone(normalized)].slice(-60);
      setHistoryIndex(result.length - 1);
      return result;
    });
  }

  useEffect(() => {
    if (!imageSrc || !shouldAutoDetectOnOpen) return undefined;
    let cancelled = false;
    setAutoDetectState({ state: "scanning", message: "Đang dò boundary quanh mã lô…" });

    detectLotShape(imageSrc, autoAnchor)
      .then((result) => {
        if (cancelled) return;
        if (result.accepted) {
          replaceBaseline({
            ...initial,
            shape: result.shape,
            status: "auto-detected",
            autoConfidence: result.confidence,
            autoClassification: result.classification,
            pin: { ...(initial.pin || {}), visible: false, anchor: "tip" },
          });
          setAutoDetectState({ state: "detected", message: detectionCopy(result) });
        } else {
          replaceBaseline({
            ...initial,
            shape: emptyShape(),
            status: "locator",
            autoConfidence: result.confidence || 0,
            pin: { ...(initial.pin || {}), visible: false, anchor: "tip" },
          });
          setAutoDetectState({ state: "fallback", message: detectionCopy(result) });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        replaceBaseline({ ...initial, shape: emptyShape(), status: "locator" });
        setAutoDetectState({ state: "fallback", message: error.message || "Auto Detect thất bại." });
      });

    return () => { cancelled = true; };
  }, [imageSrc, shouldAutoDetectOnOpen, autoAnchor.x, autoAnchor.y, viewSignature]);

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

  function fitView() {
    setViewZoom(100);
    setViewPan({ x: 0, y: 0 });
  }

  function patchViewZoom(value) {
    setViewZoom(clamp(value, VIEW_ZOOM_MIN, VIEW_ZOOM_MAX));
  }

  useEffect(() => {
    function keydown(event) {
      if (event.code === "Space" && !event.repeat) {
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
          event.preventDefault();
          setSpaceDown(true);
        }
      }
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
    }
    function keyup(event) {
      if (event.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
  }, [historyIndex, history, draft, rectStart]);

  async function runAutoDetect() {
    if (!imageSrc || autoDetectState.state === "scanning") return;
    setAutoDetectState({ state: "scanning", message: "Đang dò boundary quanh mã lô…" });
    try {
      const result = await detectLotShape(imageSrc, autoAnchor);
      if (result.accepted) {
        commit({
          ...overlay,
          shape: result.shape,
          status: "auto-detected",
          autoConfidence: result.confidence,
          autoClassification: result.classification,
        });
        setDraft([]);
        setTool("direct");
        setAutoDetectState({ state: "detected", message: detectionCopy(result) });
      } else {
        setAutoDetectState({ state: "fallback", message: `${detectionCopy(result)} Giữ shape hiện tại; bạn có thể vẽ Rectangle/Polygon.` });
      }
    } catch (error) {
      setAutoDetectState({ state: "fallback", message: error.message || "Auto Detect thất bại." });
    }
  }

  function beginCameraDrag(event) {
    event.preventDefault();
    setCameraDrag({ clientX: event.clientX, clientY: event.clientY, panX: viewPan.x, panY: viewPan.y });
  }

  function startStage(event) {
    if (!sceneRef.current) return;
    if (tool === "hand" || spaceDown || event.button === 1) {
      beginCameraDrag(event);
      return;
    }

    if (tool === "polygon" || tool === "pen") {
      const point = pointFromEvent(event, sceneRef.current);
      if (draft.length >= 3) {
        const first = draft[0];
        const tolerance = 18 / Math.max(1, sceneRef.current.getBoundingClientRect().width);
        if (Math.hypot(first.x - point.x, first.y - point.y) < tolerance) {
          finishPolygon();
          return;
        }
      }
      setDraft((prev) => [...prev, point]);
      return;
    }

    if (tool === "rectangle") setRectStart(pointFromEvent(event, sceneRef.current));
  }

  function moveStage(event) {
    if (cameraDrag) {
      setViewPan({
        x: cameraDrag.panX + (event.clientX - cameraDrag.clientX),
        y: cameraDrag.panY + (event.clientY - cameraDrag.clientY),
      });
      return;
    }
    if (!sceneRef.current) return;
    const point = pointFromEvent(event, sceneRef.current);

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
        pin: { ...(prev.pin || {}), visible: true, x: point.x, y: point.y, anchor: "tip" },
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
    if (cameraDrag) {
      setCameraDrag(null);
      return;
    }
    if (dragNode || dragPin || rectStart) commit({ ...overlay, status: "edited", viewSignature });
    setDragNode(null);
    setDragPin(false);
    setRectStart(null);
  }

  function finishPolygon() {
    if (draft.length < 3) return;
    commit({
      ...overlay,
      shape: { type: "polygon", source: "manual", points: draft },
      status: "edited",
      viewSignature,
    });
    setDraft([]);
    setTool("direct");
  }

  function addNodeAfter(index) {
    const points = overlay.shape?.points || [];
    if (points.length < 2) return;
    const current = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const next = clone(overlay);
    next.shape.points.splice(index + 1, 0, { x: (current.x + nextPoint.x) / 2, y: (current.y + nextPoint.y) / 2 });
    next.status = "edited";
    commit(next);
  }

  function deleteNode(index) {
    const points = overlay.shape?.points || [];
    if (points.length <= 3) return;
    const next = clone(overlay);
    next.shape.points.splice(index, 1);
    next.status = "edited";
    commit(next);
    setDragNode(null);
  }

  function setStyle(field, value) {
    commit({
      ...overlay,
      style: { ...DEFAULT_STYLE, ...(overlay.style || {}), [field]: value },
      status: "edited",
    });
  }

  function setPinScale(value, shouldCommit = true) {
    const scale = clamp(value, 0.25, 4);
    const next = {
      ...overlay,
      pin: { ...(overlay.pin || {}), visible: true, scale, anchor: "tip" },
      status: "edited",
    };
    if (shouldCommit) commit(next); else setOverlay(next);
  }

  function normalizeRotation(value) {
    const number = Number(value) || 0;
    return ((number % 360) + 360) % 360;
  }

  function setPinRotation(value, shouldCommit = true) {
    const rotation = normalizeRotation(value);
    const next = {
      ...overlay,
      pin: { ...(overlay.pin || {}), visible: true, rotation, anchor: "tip" },
      status: "edited",
    };
    if (shouldCommit) commit(next); else setOverlay(next);
  }

  const shapePoints = overlay.shape?.points || [];
  const polygonString = shapePoints.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
  const draftString = draft.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
  const style = { ...DEFAULT_STYLE, ...(overlay.style || {}) };
  const cameraScale = viewZoom / 100;
  const hasShape = shapePoints.length >= 3;
  const statusTitle = overlay.status === "edited"
    ? "✎ Manual Override"
    : overlay.status === "auto-detected"
      ? `✨ Auto Shape · ${Math.round((overlay.autoConfidence || 0) * 100)}%`
      : "• Locator Only";
  const statusBody = overlay.status === "edited"
    ? "Designer path được ưu tiên khi export."
    : overlay.status === "auto-detected"
      ? `${overlay.autoClassification === "rectangle" ? "Rectangle" : `Polygon ${shapePoints.length} cạnh`} được dò từ boundary quanh mã lô. Bạn vẫn có thể chỉnh từng node.`
      : "Chưa đủ chắc chắn để tự tô shape. Dot nhỏ chỉ vị trí mã lô; dùng Rectangle/Polygon để vẽ đè.";

  return (
    <div className="lot-editor-shell">
      <header className="lot-editor-header">
        <div>
          <span>EDIT LOT HIGHLIGHT</span>
          <h2>{unit?.unitCode || "Floorplan"}</h2>
        </div>

        <div className="lot-view-controls" aria-label="Lot editor view zoom">
          <button type="button" onClick={fitView}>Fit</button>
          <button type="button" onClick={() => patchViewZoom(viewZoom - 50)}>−</button>
          <label>
            <input type="number" min={VIEW_ZOOM_MIN} max={VIEW_ZOOM_MAX} step="25" value={Math.round(viewZoom)} onChange={(e) => patchViewZoom(e.target.value)} />
            <span>%</span>
          </label>
          <button type="button" onClick={() => patchViewZoom(viewZoom + 50)}>+</button>
          {[250, 500, 1000].map((z) => <button key={z} type="button" className={viewZoom === z ? "active" : ""} onClick={() => patchViewZoom(z)}>{z}%</button>)}
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
            ["hand", "✋ Pan View"],
            ["direct", "◈ Direct Select"],
            ["rectangle", "▭ Rectangle"],
            ["polygon", "⬠ Polygon"],
            ["pen", "✒ Pen / Path"],
          ].map(([key, label]) => (
            <button type="button" key={key} className={tool === key ? "active" : ""} onClick={() => { setTool(key); setDraft([]); setRectStart(null); }}>{label}</button>
          ))}
          <button type="button" onClick={() => setOverlay((prev) => ({ ...prev, pin: { ...(prev.pin || {}), visible: !prev.pin?.visible } }))}>⌖ {overlay.pin?.visible ? "Hide Pin" : "Show Pin"}</button>
          <button type="button" className="auto-tool" onClick={runAutoDetect} disabled={autoDetectState.state === "scanning"}>{autoDetectState.state === "scanning" ? "… Detecting Shape" : "✨ Auto Detect Shape"}</button>
          <p><b>Auto Shape:</b> tìm boundary khép kín gần mã lô. Confidence thấp sẽ không tự tô.</p>
          <p><b>View only:</b> zoom/pan ở editor không đổi shape đã lưu. Giữ Space + drag để pan.</p>
          <p>Polygon/Pen: click từng đỉnh, click lại điểm đầu hoặc Enter để đóng path.</p>
          {autoDetectState.message && <p><b>Detector:</b> {autoDetectState.message}</p>}
        </aside>

        <main className="lot-canvas-wrap">
          <div
            ref={viewportRef}
            className={`lot-canvas-viewport tool-${tool} ${cameraDrag ? "panning" : ""} ${spaceDown ? "space-pan" : ""}`}
            onMouseDown={startStage}
            onMouseMove={moveStage}
            onMouseUp={endStage}
            onMouseLeave={endStage}
          >
            <div
              ref={sceneRef}
              className="lot-canvas-scene"
              style={{ transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${cameraScale})` }}
            >
              {imageSrc ? <img src={imageSrc} alt="Floorplan crop" draggable="false" /> : <div className="lot-empty">Floorplan chưa được render.</div>}

              <svg className="lot-overlay-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
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
                {draft.length >= 2 && <polyline points={draftString} fill="none" stroke="#4f7cff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />}
              </svg>

              {!hasShape && (
                <i
                  aria-hidden="true"
                  title="Unit locator"
                  style={{
                    position: "absolute",
                    left: `${clamp01(autoAnchor.x) * 100}%`,
                    top: `${clamp01(autoAnchor.y) * 100}%`,
                    width: 9,
                    height: 9,
                    zIndex: 18,
                    borderRadius: "50%",
                    background: "#e1263f",
                    border: "2px solid rgba(255,255,255,.96)",
                    boxShadow: "0 1px 4px rgba(30,35,45,.28)",
                    transform: `translate(-50%, -50%) scale(${1 / cameraScale})`,
                    transformOrigin: "center",
                    pointerEvents: "none",
                  }}
                />
              )}

              {tool === "direct" && shapePoints.map((point, index) => (
                <button
                  key={index}
                  type="button"
                  className="lot-node"
                  style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: `translate(-50%, -50%) scale(${1 / cameraScale})` }}
                  onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragNode({ index }); }}
                  onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); addNodeAfter(index); }}
                  onContextMenu={(event) => { event.preventDefault(); deleteNode(index); }}
                  title="Drag · Double-click add point · Right-click delete"
                />
              ))}

              {draft.map((point, index) => (
                <i key={`draft-${index}`} className="lot-draft-node" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, transform: `translate(-50%, -50%) scale(${1 / cameraScale})` }} />
              ))}

              {overlay.pin?.visible && pinSrc && (
                <button
                  type="button"
                  className="lot-pin"
                  style={{
                    left: `${clamp01(overlay.pin.x) * 100}%`,
                    top: `${clamp01(overlay.pin.y) * 100}%`,
                    transform: `translate(-50%, -100%) scale(${1 / cameraScale})`,
                  }}
                  onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); setDragPin(true); }}
                  title="Drag 2D pin"
                >
                  <img src={pinSrc} alt="2D pin" draggable="false" style={{ transform: `rotate(${overlay.pin?.rotation || 0}deg) scale(${overlay.pin?.scale || 1})` }} />
                </button>
              )}
            </div>
          </div>
        </main>

        <aside className="lot-style-panel">
          <span className="section-label">STYLE</span>
          <label><span>Fill</span><input type="color" value={style.fill} onChange={(e) => setStyle("fill", e.target.value)} /></label>
          <label><span>Opacity</span><input type="range" min="0" max="0.8" step="0.01" value={style.opacity} onChange={(e) => setStyle("opacity", Number(e.target.value))} /><b>{Math.round(style.opacity * 100)}%</b></label>
          <label><span>Blend</span><select value={style.blendMode} onChange={(e) => setStyle("blendMode", e.target.value)}><option value="multiply">Multiply</option><option value="normal">Normal</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select></label>

          <div className="pin-scale-control">
            <span>2D PIN SIZE</span>
            <div className="pin-scale-stepper">
              <button type="button" onClick={() => setPinScale((overlay.pin?.scale || 1) - 0.1)}>−</button>
              <label><input type="number" min="25" max="400" step="5" value={Math.round((overlay.pin?.scale || 1) * 100)} onChange={(e) => setPinScale(Number(e.target.value) / 100)} /><span>%</span></label>
              <button type="button" onClick={() => setPinScale((overlay.pin?.scale || 1) + 0.1)}>+</button>
            </div>
            <input type="range" min="0.25" max="4" step="0.05" value={overlay.pin?.scale || 1} onChange={(e) => setPinScale(Number(e.target.value), false)} onMouseUp={(e) => setPinScale(Number(e.currentTarget.value), true)} />
          </div>

          <div className="pin-rotate-control">
            <span>2D PIN ROTATION</span>
            <div className="pin-rotate-stepper">
              <button type="button" onClick={() => setPinRotation((overlay.pin?.rotation || 0) - 15)}>↶ 15°</button>
              <label><input type="number" min="0" max="359" step="1" value={Math.round(overlay.pin?.rotation || 0)} onChange={(e) => setPinRotation(e.target.value)} /><span>°</span></label>
              <button type="button" onClick={() => setPinRotation((overlay.pin?.rotation || 0) + 15)}>15° ↷</button>
            </div>
            <input type="range" min="0" max="360" step="1" value={overlay.pin?.rotation || 0} onChange={(e) => setPinRotation(Number(e.target.value), false)} onMouseUp={(e) => setPinRotation(Number(e.currentTarget.value), true)} />
            <button className="pin-rotation-reset" type="button" onClick={() => setPinRotation(0)}>Reset 0°</button>
          </div>

          <div className={`lot-status ${overlay.status || "locator"}`}>
            <strong>{statusTitle}</strong>
            <span>{statusBody}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
