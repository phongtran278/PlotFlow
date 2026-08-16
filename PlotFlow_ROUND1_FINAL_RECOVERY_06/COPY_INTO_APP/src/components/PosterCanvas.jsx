import { useEffect, useMemo, useRef, useState } from "react";
import UnitInfoCard from "./UnitInfoCard";

const BASE = {
  house: { x: 0, y: 0, w: 1080, h: 578 },

  // ROUND 1 PATCH 05 — balanced two-column row.
  // Floorplan and Unit Info now have equal visual area by default.
  floorplan: { x: 24, y: 590, w: 506, h: 390 },
  info: { x: 550, y: 590, w: 506, h: 390 },

  amenity1: { x: 26, y: 1437, w: 515, h: 293 },
  amenity2: { x: 553, y: 1437, w: 501, h: 293 },

  // Header composition preset: same outer margin left/right.
  // Logo and badge(s) stay editable in Edit Layout after auto placement.
  logo: { x: 28, y: 24, w: 170, h: 193 },
  badgeHotDeal: { x: 920, y: 24, w: 132, h: 194 },
  badgeEarly: { x: 754, y: 24, w: 132, h: 194 },

  pin3d: { x: 518, y: 1120, w: 62, h: 86 },
};

const LABELS = {
  house: "HOUSE",
  floorplan: "FLOORPLAN",
  info: "UNIT INFO",
  amenity1: "AMENITY 01",
  amenity2: "AMENITY 02",
  logo: "PROJECT LOGO",
  badgeHotDeal: "HOT DEAL",
  badgeEarly: "VỀ Ở SỚM",
  pin3d: "3D PIN",
};

export default function PosterCanvas({
  unit,
  assets,
  isEditing = false,
  floorplanStatus = null,
  onEditFloorplan = null,
  onEditLot = null,
  onChooseAsset = null,
  lotOverlay = null,
  previewZoom = 1,
}) {
  const [layout, setLayout] = useState(BASE);
  const [selected, setSelected] = useState(["amenity1", "amenity2"]);
  const [gap, setGap] = useState(12);
  const [zoom, setZoom] = useState(58);
  const [grid, setGrid] = useState({
    columns: 12,
    margin: 60,
    gutter: 20,
    show: true,
    centerGuides: true,
    snapGrid: true,
    smartGuides: true,
    measurements: true,
  });

  const [dragState, setDragState] = useState(null);
  const [liveGuides, setLiveGuides] = useState([]);
  const [liveMeasurements, setLiveMeasurements] = useState([]);
  const canvasRef = useRef(null);
  const [history, setHistory] = useState([BASE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [resizeState, setResizeState] = useState(null);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  function pushHistory(nextLayout) {
    setHistory((prev) => {
      const next = [...prev.slice(0, historyIndex + 1), nextLayout].slice(-80);
      setHistoryIndex(next.length - 1);
      return next;
    });
  }

  function undo() {
    if (!canUndo) return;
    const i = historyIndex - 1;
    setHistoryIndex(i);
    setLayout(history[i]);
  }

  function redo() {
    if (!canRedo) return;
    const i = historyIndex + 1;
    setHistoryIndex(i);
    setLayout(history[i]);
  }

  function saveLayout() {
    localStorage.setItem("plotflow-layout-round1-v7", JSON.stringify(layout));
    localStorage.setItem("plotflow-grid-round1-v7", JSON.stringify(grid));
  }

  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem("plotflow-layout-round1-v7");
      const savedGrid = localStorage.getItem("plotflow-grid-round1-v7");
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        setLayout(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
      }
      if (savedGrid) setGrid((prev) => ({ ...prev, ...JSON.parse(savedGrid) }));
    } catch (error) {
      console.warn("PlotFlow saved layout could not be loaded", error);
    }
  }, []);

  useEffect(() => {
    function keydown(e) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [history, historyIndex]);

  const rawArchitectureLabel = String(unit.architectureLabel || "").trim();
  const unitType = String(unit.type || "").trim();
  const normalizedType = unitType.toLocaleUpperCase("vi-VN");
  const normalizedLabel = rawArchitectureLabel.toLocaleUpperCase("vi-VN");

  const architectureLabel = rawArchitectureLabel
    ? (normalizedLabel.includes(normalizedType) || !unitType
        ? rawArchitectureLabel
        : `${unitType} - ${rawArchitectureLabel}`)
    : unitType;

  function selectSlot(key, e) {
    if (!isEditing) return;
    e.stopPropagation();
    if (e.shiftKey) {
      setSelected((prev) =>
        prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
      );
    } else {
      setSelected([key]);
    }
  }

  function patchSelected(patch) {
    setLayout((prev) => {
      const next = { ...prev };
      selected.forEach((key) => {
        next[key] = { ...next[key], ...patch(next[key], key) };
      });
      return next;
    });
  }

  function align(axis) {
    if (!selected.length) return;
    setLayout((prev) => {
      const next = { ...prev };
      selected.forEach((key) => {
        const s = next[key];
        if (axis === "left") next[key] = { ...s, x: 0 };
        if (axis === "right") next[key] = { ...s, x: 1080 - s.w };
        if (axis === "hcenter") next[key] = { ...s, x: Math.round((1080 - s.w) / 2) };
        if (axis === "top") next[key] = { ...s, y: 0 };
        if (axis === "bottom") next[key] = { ...s, y: 1920 - s.h };
        if (axis === "vcenter") next[key] = { ...s, y: Math.round((1920 - s.h) / 2) };
      });
      return next;
    });
  }

  function centerGroup() {
    if (!selected.length) return;
    setLayout((prev) => {
      const next = { ...prev };
      const items = selected.map((k) => next[k]);
      const minX = Math.min(...items.map((i) => i.x));
      const maxX = Math.max(...items.map((i) => i.x + i.w));
      const groupW = maxX - minX;
      const targetX = Math.round((1080 - groupW) / 2);
      const dx = targetX - minX;
      selected.forEach((key) => {
        next[key] = { ...next[key], x: next[key].x + dx };
      });
      return next;
    });
  }

  function equalWidthAndGap() {
    if (selected.length !== 2) return;
    setLayout((prev) => {
      const next = { ...prev };
      const [aKey, bKey] = [...selected].sort((a, b) => prev[a].x - prev[b].x);
      const leftMargin = Math.min(prev[aKey].x, 1080 - (prev[bKey].x + prev[bKey].w));
      const available = 1080 - leftMargin * 2 - gap;
      const w = Math.round(available / 2);
      next[aKey] = { ...prev[aKey], x: leftMargin, w };
      next[bKey] = { ...prev[bKey], x: leftMargin + w + gap, w };
      return next;
    });
  }

  function distributeHorizontal() {
    if (selected.length < 2) return;
    setLayout((prev) => {
      const next = { ...prev };
      const keys = [...selected].sort((a, b) => prev[a].x - prev[b].x);
      const totalW = keys.reduce((sum, k) => sum + prev[k].w, 0);
      const free = 1080 - totalW;
      const g = keys.length > 1 ? free / (keys.length - 1) : 0;
      let x = 0;
      keys.forEach((k) => {
        next[k] = { ...prev[k], x: Math.round(x) };
        x += prev[k].w + g;
      });
      return next;
    });
  }

  function resetLayout() {
    setLayout(BASE);
    pushHistory(BASE);
    setSelected(["amenity1", "amenity2"]);
    setGap(12);
  }

  const primary = selected.length === 1 ? layout[selected[0]] : null;

  function setPrimaryField(field, value) {
    if (!primary || !selected[0]) return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setLayout((prev) => ({
      ...prev,
      [selected[0]]: { ...prev[selected[0]], [field]: n },
    }));
  }

  function slotStyle(key) {
    const s = layout[key];
    return { left: s.x, top: s.y, width: s.w, height: s.h };
  }


  const gridColumns = useMemo(() => {
    const count = Math.max(1, Number(grid.columns) || 1);
    const margin = Math.max(0, Number(grid.margin) || 0);
    const gutter = Math.max(0, Number(grid.gutter) || 0);
    const available = 1080 - margin * 2 - gutter * (count - 1);
    const columnWidth = Math.max(0, available / count);

    return Array.from({ length: count }, (_, index) => ({
      left: margin + index * (columnWidth + gutter),
      width: columnWidth,
    }));
  }, [grid.columns, grid.margin, grid.gutter]);

  function setGridField(field, value) {
    setGrid((prev) => ({
      ...prev,
      [field]: value,
    }));
  }


  function snapNumber(value, candidates, threshold = 8) {
    let best = value;
    let bestDistance = threshold + 1;

    candidates.forEach((candidate) => {
      const distance = Math.abs(value - candidate);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });

    return bestDistance <= threshold ? best : value;
  }

  function getGridXCandidates() {
    const values = [0, 540, 1080, grid.margin, 1080 - grid.margin];

    gridColumns.forEach((column) => {
      values.push(column.left);
      values.push(column.left + column.width);
      values.push(column.left + column.width / 2);
    });

    return values;
  }

  function getGridYCandidates() {
    return [0, 960, 1920];
  }

  function beginResize(key, event) {
    if (!isEditing || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected([key]);
    const item = layout[key];
    setResizeState({
      key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startW: item.w,
      startH: item.h,
      scale: zoom / 100,
    });
  }

  useEffect(() => {
    if (!resizeState) return;
    function move(e) {
      const r = resizeState;
      const dw = (e.clientX - r.startClientX) / r.scale;
      const dh = (e.clientY - r.startClientY) / r.scale;
      setLayout(prev => ({
        ...prev,
        [r.key]: {
          ...prev[r.key],
          w: Math.max(40, Math.round(r.startW + dw)),
          h: Math.max(40, Math.round(r.startH + dh))
        }
      }));
    }
    function up() {
      setResizeState(null);
      setLayout(current => { pushHistory({...current}); return current; });
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [resizeState]);

  function beginDrag(key, event) {
    if (!isEditing || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    if (!selected.includes(key)) {
      setSelected([key]);
    }

    const scale = zoom / 100;
    setDragState({
      key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layout[key].x,
      startY: layout[key].y,
      scale,
    });
  }

  useEffect(() => {
    if (!dragState) return;

    function onMove(event) {
      const { key, startClientX, startClientY, startX, startY, scale } = dragState;
      const current = layout[key];

      let nextX = startX + (event.clientX - startClientX) / scale;
      let nextY = startY + (event.clientY - startClientY) / scale;

      const guides = [];
      const measurements = [];

      if (grid.snapGrid) {
        const xCandidates = getGridXCandidates();
        const yCandidates = getGridYCandidates();

        const snappedLeft = snapNumber(nextX, xCandidates);
        const snappedCenterX = snapNumber(nextX + current.w / 2, xCandidates);
        const snappedRight = snapNumber(nextX + current.w, xCandidates);

        if (snappedLeft !== nextX) {
          nextX = snappedLeft;
          guides.push({ axis: "x", value: snappedLeft, type: "grid" });
        } else if (snappedCenterX !== nextX + current.w / 2) {
          nextX = snappedCenterX - current.w / 2;
          guides.push({ axis: "x", value: snappedCenterX, type: "grid" });
        } else if (snappedRight !== nextX + current.w) {
          nextX = snappedRight - current.w;
          guides.push({ axis: "x", value: snappedRight, type: "grid" });
        }

        const snappedTop = snapNumber(nextY, yCandidates);
        const snappedCenterY = snapNumber(nextY + current.h / 2, yCandidates);
        const snappedBottom = snapNumber(nextY + current.h, yCandidates);

        if (snappedTop !== nextY) {
          nextY = snappedTop;
          guides.push({ axis: "y", value: snappedTop, type: "grid" });
        } else if (snappedCenterY !== nextY + current.h / 2) {
          nextY = snappedCenterY - current.h / 2;
          guides.push({ axis: "y", value: snappedCenterY, type: "grid" });
        } else if (snappedBottom !== nextY + current.h) {
          nextY = snappedBottom - current.h;
          guides.push({ axis: "y", value: snappedBottom, type: "grid" });
        }
      }

      if (grid.smartGuides) {
        Object.entries(layout).forEach(([otherKey, other]) => {
          if (otherKey === key) return;

          const xPairs = [
            [nextX, other.x],
            [nextX + current.w / 2, other.x + other.w / 2],
            [nextX + current.w, other.x + other.w],
          ];

          for (const [movingAnchor, otherAnchor] of xPairs) {
            if (Math.abs(movingAnchor - otherAnchor) <= 7) {
              nextX += otherAnchor - movingAnchor;
              guides.push({ axis: "x", value: otherAnchor, type: "smart" });
              break;
            }
          }

          const yPairs = [
            [nextY, other.y],
            [nextY + current.h / 2, other.y + other.h / 2],
            [nextY + current.h, other.y + other.h],
          ];

          for (const [movingAnchor, otherAnchor] of yPairs) {
            if (Math.abs(movingAnchor - otherAnchor) <= 7) {
              nextY += otherAnchor - movingAnchor;
              guides.push({ axis: "y", value: otherAnchor, type: "smart" });
              break;
            }
          }

          if (grid.measurements) {
            const movingLeft = nextX;
            const movingRight = nextX + current.w;
            const otherLeft = other.x;
            const otherRight = other.x + other.w;

            if (Math.abs(nextY - other.y) < Math.max(current.h, other.h)) {
              if (movingLeft >= otherRight) {
                const distance = Math.round(movingLeft - otherRight);
                if (distance <= 160) {
                  measurements.push({
                    axis: "x",
                    from: otherRight,
                    to: movingLeft,
                    y: Math.min(nextY, other.y) + 28,
                    label: `${distance}px`,
                  });
                }
              } else if (otherLeft >= movingRight) {
                const distance = Math.round(otherLeft - movingRight);
                if (distance <= 160) {
                  measurements.push({
                    axis: "x",
                    from: movingRight,
                    to: otherLeft,
                    y: Math.min(nextY, other.y) + 28,
                    label: `${distance}px`,
                  });
                }
              }
            }
          }
        });
      }

      nextX = Math.max(-current.w, Math.min(1080, Math.round(nextX)));
      nextY = Math.max(-current.h, Math.min(1920, Math.round(nextY)));

      setLayout((prev) => ({
        ...prev,
        [key]: { ...prev[key], x: nextX, y: nextY },
      }));

      setLiveGuides(guides.slice(0, 6));
      setLiveMeasurements(measurements.slice(0, 4));
    }

    function onUp() {
      setDragState(null);
      setLiveGuides([]);
      setLiveMeasurements([]);
      setLayout(current => { pushHistory({...current}); return current; });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, layout, grid, gridColumns, zoom]);

  return (
    <div className={`layout-studio ${isEditing ? "is-editing" : ""}`}>
      {isEditing && (
        <aside className="layers-panel">
          <div className="studio-panel-heading">
            <span>LAYERS</span>
            <strong>Template</strong>
          </div>

          <div className="layer-list">
            {Object.keys(LABELS).map((key) => (
              <button
                key={key}
                type="button"
                className={`layer-row ${selected.includes(key) ? "active" : ""}`}
                onClick={(e) => selectSlot(key, e)}
              >
                <span className="layer-icon">◇</span>
                <span>{LABELS[key]}</span>
                <small>{selected.includes(key) ? "Selected" : ""}</small>
              </button>
            ))}
          </div>

          <div className="layers-tip">
            Shift + click để multi-select.
          </div>
        </aside>
      )}

      <section className="studio-center">
        {isEditing && (
          <div className="studio-toolbar">
            <div className="toolbar-copy">
              <strong>Artboard</strong>
              <span>1080 × 1920 px</span>
            </div>

            <div className="history-controls">
              <button type="button" onClick={undo} disabled={!canUndo} title="Undo (⌘Z / Ctrl+Z)">↶</button>
              <button type="button" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z / Ctrl+Shift+Z)">↷</button>
              <button type="button" className="save-layout-button" onClick={saveLayout}>Save Layout</button>
            </div>

            <div className="zoom-control">
              <button type="button" onClick={() => setZoom((z) => Math.max(30, z - 5))}>−</button>
              <input
                type="range"
                min="30"
                max="100"
                step="1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <button type="button" onClick={() => setZoom((z) => Math.min(100, z + 5))}>+</button>
              <strong>{zoom}%</strong>
            </div>
          </div>
        )}

        <div className="studio-canvas-scroll">
          <div
            className="poster-viewport studio-poster-viewport"
            style={isEditing ? { "--studio-zoom": zoom / 100 } : { "--studio-zoom": previewZoom }}
          >
            <div ref={canvasRef} className={`poster-canvas ${isEditing ? "layout-editing" : ""}`}>
              <img className="poster-template" src="/assets/template/template.png" alt="PlotFlow Template" />

              {isEditing && grid.show && (
                <div className="layout-grid-overlay" aria-hidden="true">
                  {gridColumns.map((column, index) => (
                    <div
                      key={index}
                      className="layout-grid-column"
                      style={{
                        left: `${column.left}px`,
                        width: `${column.width}px`,
                      }}
                    />
                  ))}
                </div>
              )}

              {isEditing && grid.centerGuides && (
                <div className="center-guides-overlay" aria-hidden="true">
                  <div className="center-guide vertical-guide" />
                  <div className="center-guide horizontal-guide" />
                </div>
              )}

              {isEditing && (
                <div className="smart-overlay" aria-hidden="true">
                  {liveGuides.map((guide, index) => (
                    <div
                      key={`guide-${index}`}
                      className={`live-guide ${guide.axis === "x" ? "live-guide-x" : "live-guide-y"} ${guide.type}`}
                      style={
                        guide.axis === "x"
                          ? { left: `${guide.value}px` }
                          : { top: `${guide.value}px` }
                      }
                    />
                  ))}

                  {liveMeasurements.map((measure, index) => (
                    <div
                      key={`measure-${index}`}
                      className="live-measurement"
                      style={{
                        left: `${Math.min(measure.from, measure.to)}px`,
                        top: `${measure.y}px`,
                        width: `${Math.abs(measure.to - measure.from)}px`,
                      }}
                    >
                      <i />
                      <span>{measure.label}</span>
                      <i />
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`poster-slot poster-house ${selected.includes("house") ? "selected" : ""}`}
                style={slotStyle("house")}
                onMouseDown={(e) => beginDrag("house", e)}
                onClick={(e) => selectSlot("house", e)}
              >
                {assets.houseImage && <img className="house-image-fade" src={assets.houseImage} alt="House model" />}
                <div className="poster-architecture-label">{architectureLabel}</div>
                {!isEditing && onChooseAsset && (
                  <button type="button" className="poster-change-asset" onClick={(e) => { e.stopPropagation(); onChooseAsset("house"); }}>Change House</button>
                )}
                {isEditing && <><SlotTag text="HOUSE" /><ResizeHandle onMouseDown={(e) => beginResize("house", e)} /></>}
              </div>

              <div
                className={`poster-slot poster-floorplan ${selected.includes("floorplan") ? "selected" : ""}`}
                style={slotStyle("floorplan")}
                onMouseDown={(e) => beginDrag("floorplan", e)}
                onClick={(e) => selectSlot("floorplan", e)}
              >
                {assets.floorplanImage ? <img src={assets.floorplanImage} alt="Floorplan" /> : <MissingAsset label="Floorplan" />}
                {lotOverlay?.shape?.points?.length >= 3 && (
                  <svg className="poster-lot-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon
                      points={lotOverlay.shape.points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                      fill={lotOverlay.style?.fill || "#d91e36"}
                      fillOpacity={lotOverlay.style?.opacity ?? 0.32}
                      stroke={lotOverlay.style?.stroke === "none" ? "none" : (lotOverlay.style?.stroke || "none")}
                      strokeWidth={lotOverlay.style?.strokeWidth || 0}
                      style={{ mixBlendMode: lotOverlay.style?.blendMode || "multiply" }}
                    />
                  </svg>
                )}
                {lotOverlay?.pin?.visible && assets.pin2D && (
                  <img
                    className="poster-pin-2d"
                    src={assets.pin2D}
                    alt="2D pin"
                    style={{
                      left: `${lotOverlay.pin.x * 100}%`,
                      top: `${lotOverlay.pin.y * 100}%`,
                      transform: `translate(-50%, -92%) scale(${lotOverlay.pin.scale || 1})`,
                    }}
                  />
                )}
                {!isEditing && onEditLot && (
                  <button type="button" className="floorplan-lot-edit" onClick={(e) => { e.stopPropagation(); onEditLot(); }}>✦ Highlight Lot</button>
                )}
                {!isEditing && onEditFloorplan && (
                  <button
                    type="button"
                    className="floorplan-edit-view"
                    onClick={(e) => { e.stopPropagation(); onEditFloorplan(); }}
                  >
                    <span>{floorplanStatus === "review" ? "△ Review" : floorplanStatus === "not_found" ? "✕ Not Found" : "⌖ Floorplan"}</span>
                    <strong>Edit View</strong>
                  </button>
                )}
                {isEditing && <><SlotTag text="FLOORPLAN" /><ResizeHandle onMouseDown={(e) => beginResize("floorplan", e)} /></>}
              </div>

              <div
                className={`poster-unit-info ${selected.includes("info") ? "selected" : ""}`}
                style={slotStyle("info")}
                onMouseDown={(e) => beginDrag("info", e)}
                onClick={(e) => selectSlot("info", e)}
              >
                <UnitInfoCard unit={unit} />
                {isEditing && <><SlotTag text="UNIT INFO" /><ResizeHandle onMouseDown={(e) => beginResize("info", e)} /></>}
              </div>

              <div
                className={`poster-slot poster-amenity-1 ${selected.includes("amenity1") ? "selected" : ""}`}
                style={slotStyle("amenity1")}
                onMouseDown={(e) => beginDrag("amenity1", e)}
                onClick={(e) => selectSlot("amenity1", e)}
              >
                {assets.amenity1Image ? <img src={assets.amenity1Image} alt="Amenity 01" /> : <MissingAsset label="Amenity 01" />}
                {!isEditing && onChooseAsset && <button type="button" className="poster-change-asset" onClick={(e) => { e.stopPropagation(); onChooseAsset("amenity1"); }}>Change</button>}
                {isEditing && <><SlotTag text="AMENITY 01" /><ResizeHandle onMouseDown={(e) => beginResize("amenity1", e)} /></>}
              </div>

              <div
                className={`poster-slot poster-amenity-2 ${selected.includes("amenity2") ? "selected" : ""}`}
                style={slotStyle("amenity2")}
                onMouseDown={(e) => beginDrag("amenity2", e)}
                onClick={(e) => selectSlot("amenity2", e)}
              >
                {assets.amenity2Image ? <img src={assets.amenity2Image} alt="Amenity 02" /> : <MissingAsset label="Amenity 02" />}
                {!isEditing && onChooseAsset && <button type="button" className="poster-change-asset" onClick={(e) => { e.stopPropagation(); onChooseAsset("amenity2"); }}>Change</button>}
                {isEditing && <><SlotTag text="AMENITY 02" /><ResizeHandle onMouseDown={(e) => beginResize("amenity2", e)} /></>}
              </div>

              {assets.logoImage && (
                <div className={`poster-overlay-slot poster-logo ${selected.includes("logo") ? "selected" : ""}`} style={slotStyle("logo")} onMouseDown={(e) => beginDrag("logo", e)} onClick={(e) => selectSlot("logo", e)}>
                  <img src={assets.logoImage} alt="Project logo" />
                  {!isEditing && onChooseAsset && <button type="button" className="poster-change-asset compact" onClick={(e) => { e.stopPropagation(); onChooseAsset("logo"); }}>Logo</button>}
                  {isEditing && <><SlotTag text="PROJECT LOGO" /><ResizeHandle onMouseDown={(e) => beginResize("logo", e)} /></>}
                </div>
              )}

              {[...(assets.badges || [])]
                .sort((a, b) => {
                  const order = { BADGE_VE_O_SOM: 0, BADGE_HOT_DEAL: 1 };
                  return (order[a.id] ?? 9) - (order[b.id] ?? 9);
                })
                .map((badge, index, list) => {
                  const key = list.length === 1 ? "badgeHotDeal" : (index === 0 ? "badgeEarly" : "badgeHotDeal");
                  return (
                    <div key={badge.id} className={`poster-overlay-slot poster-badge ${selected.includes(key) ? "selected" : ""}`} style={slotStyle(key)} onMouseDown={(e) => beginDrag(key, e)} onClick={(e) => selectSlot(key, e)}>
                      <img src={badge.src} alt={badge.name} />
                      {isEditing && <><SlotTag text={badge.name.toUpperCase()} /><ResizeHandle onMouseDown={(e) => beginResize(key, e)} /></>}
                    </div>
                  );
                })}

              {assets.pin3D && (
                <div className={`poster-overlay-slot poster-pin-3d ${selected.includes("pin3d") ? "selected" : ""}`} style={slotStyle("pin3d")} onMouseDown={(e) => beginDrag("pin3d", e)} onClick={(e) => selectSlot("pin3d", e)}>
                  <img src={assets.pin3D} alt="3D pin" />
                  {isEditing && <><SlotTag text="3D PIN" /><ResizeHandle onMouseDown={(e) => beginResize("pin3d", e)} /></>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {isEditing && (
        <aside className="inspector-panel">
          <div className="studio-panel-heading">
            <span>INSPECTOR</span>
            <strong>{selected.length === 1 ? LABELS[selected[0]] : `${selected.length} OBJECTS`}</strong>
          </div>

          {primary ? (
            <div className="geometry-grid">
              {["x", "y", "w", "h"].map((field) => (
                <label key={field}>
                  <span>{field.toUpperCase()}</span>
                  <input
                    type="number"
                    value={primary[field]}
                    onChange={(e) => setPrimaryField(field, e.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="multi-selection-card">
              <strong>{selected.length} objects selected</strong>
              <span>Dùng Group / Distribution để căn theo quan hệ.</span>
            </div>
          )}

          <div className="panel-section">
            <span className="section-label">ALIGN TO ARTBOARD</span>
            <div className="tool-grid">
              <button onClick={() => align("left")}>Left</button>
              <button onClick={() => align("hcenter")}>Center X</button>
              <button onClick={() => align("right")}>Right</button>
              <button onClick={() => align("top")}>Top</button>
              <button onClick={() => align("vcenter")}>Center Y</button>
              <button onClick={() => align("bottom")}>Bottom</button>
            </div>
          </div>

          <div className="panel-section">
            <span className="section-label">GROUP / DISTRIBUTE</span>
            <button className="wide-tool" onClick={centerGroup} disabled={selected.length < 2}>
              Center Group to Artboard
            </button>
            <button className="wide-tool" onClick={distributeHorizontal} disabled={selected.length < 2}>
              Distribute Horizontally
            </button>
          </div>

          <div className="panel-section">
            <span className="section-label">TWO-COLUMN CONSTRAINT</span>
            <label className="gap-field">
              <span>Gap</span>
              <input type="number" value={gap} onChange={(e) => setGap(Number(e.target.value) || 0)} />
              <b>px</b>
            </label>

            <button
              className="wide-tool primary-tool"
              onClick={equalWidthAndGap}
              disabled={selected.length !== 2}
            >
              Equal Width + Equal Margins
            </button>

            <p className="constraint-note">
              Với 2 object: PlotFlow tính width, gap và hai margin ngoài chính xác trên artboard 1080px.
            </p>
          </div>

          
          {selected.length === 2 && (() => {
            const keys = [...selected].sort((a,b)=>layout[a].x-layout[b].x);
            const a=layout[keys[0]], b=layout[keys[1]];
            const lm=Math.round(a.x);
            const rm=Math.round(1080-(b.x+b.w));
            const gp=Math.round(b.x-(a.x+a.w));
            const wd=Math.abs(Math.round(a.w-b.w));
            const diff=Math.abs(lm-rm);
            const exact=diff===0 && wd===0;
            return <div className="panel-section measurement-panel">
              <span className="section-label">MEASUREMENTS</span>
              <div className="measurement-row"><span>Left margin</span><strong>{lm}px</strong></div>
              <div className="measurement-row"><span>Gap</span><strong>{gp}px</strong></div>
              <div className="measurement-row"><span>Right margin</span><strong>{rm}px</strong></div>
              <div className="measurement-row"><span>Width difference</span><strong>{wd}px</strong></div>
              <div className={`symmetry-status ${exact?"exact":"off"}`}>{exact?"✓ Symmetrical — exact":`△ Margin difference: ${diff}px`}</div>
            </div>
          })()}

          <div className="panel-section">
            <span className="section-label">LAYOUT GRID</span>

            <div className="grid-fields">
              <label>
                <span>Columns</span>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={grid.columns}
                  onChange={(e) => setGridField("columns", Math.max(1, Number(e.target.value) || 1))}
                />
              </label>

              <label>
                <span>Margin</span>
                <div><input
                  type="number"
                  min="0"
                  value={grid.margin}
                  onChange={(e) => setGridField("margin", Math.max(0, Number(e.target.value) || 0))}
                /><b>px</b></div>
              </label>

              <label>
                <span>Gutter</span>
                <div><input
                  type="number"
                  min="0"
                  value={grid.gutter}
                  onChange={(e) => setGridField("gutter", Math.max(0, Number(e.target.value) || 0))}
                /><b>px</b></div>
              </label>
            </div>

            <label className="toggle-row">
              <span>Show Grid</span>
              <input
                type="checkbox"
                checked={grid.show}
                onChange={(e) => setGridField("show", e.target.checked)}
              />
            </label>

            <label className="toggle-row">
              <span>Center Guides</span>
              <input
                type="checkbox"
                checked={grid.centerGuides}
                onChange={(e) => setGridField("centerGuides", e.target.checked)}
              />
            </label>

            <label className="toggle-row emphasis-toggle">
              <span>Snap to Grid</span>
              <input
                type="checkbox"
                checked={grid.snapGrid}
                onChange={(e) => setGridField("snapGrid", e.target.checked)}
              />
            </label>

            <label className="toggle-row emphasis-toggle">
              <span>Smart Guides</span>
              <input
                type="checkbox"
                checked={grid.smartGuides}
                onChange={(e) => setGridField("smartGuides", e.target.checked)}
              />
            </label>

            <label className="toggle-row emphasis-toggle">
              <span>Live Measurement</span>
              <input
                type="checkbox"
                checked={grid.measurements}
                onChange={(e) => setGridField("measurements", e.target.checked)}
              />
            </label>

            <div className="grid-math-card">
              <span>Column width</span>
              <strong>
                {gridColumns.length
                  ? `${gridColumns[0].width.toFixed(2)} px`
                  : "—"}
              </strong>
              <small>
                1080 − margins − gutters ÷ columns
              </small>
            </div>
          </div>

          <button className="reset-layout" onClick={resetLayout}>Reset Layout</button>
        </aside>
      )}
    </div>
  );
}

function SlotTag({ text }) {
  return <div className="slot-tag">{text}</div>;
}

function ResizeHandle({ onMouseDown }) {
  return <button type="button" className="resize-handle" onMouseDown={onMouseDown} title="Drag to resize" aria-label="Resize" />;
}

function MissingAsset({ label }) {
  return <div className="poster-missing">{label}</div>;
}
