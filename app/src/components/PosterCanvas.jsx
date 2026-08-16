import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PosterCanvasBase from "./PosterCanvasBase.jsx";
import SalesPolicyBar from "./SalesPolicyBar.jsx";

const LOT_OVERLAY_KEY = "plotflow-lot-overlays-r1-v9";

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function readPersistedOverlay(unitCode) {
  const code = normalizeCode(unitCode);
  if (!code) return null;
  try {
    const all = JSON.parse(localStorage.getItem(LOT_OVERLAY_KEY) || "{}");
    const overlay = all?.[code] || null;
    return overlay?.stale ? null : overlay;
  } catch {
    return null;
  }
}

export default function PosterCanvas({ lotOverlay, preferLotOverlay = false, previewZoom = 1, unit, ...props }) {
  const [persistedOverlay, setPersistedOverlay] = useState(() => readPersistedOverlay(unit?.unitCode));
  const hostRef = useRef(null);
  const [posterTarget, setPosterTarget] = useState(null);

  useEffect(() => {
    const sync = () => setPersistedOverlay(readPersistedOverlay(unit?.unitCode));
    sync();
    window.addEventListener("plotflow-overlay-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("plotflow-overlay-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [unit?.unitCode]);

  useLayoutEffect(() => {
    setPosterTarget(hostRef.current?.querySelector(".poster-canvas") || null);
  });

  // UnifiedFloorplanEditor can prefer its unsaved overlay so polygon/pin changes
  // are visible instantly; normal preview/export use persisted composition.
  const isUnifiedLivePreview = Math.abs(Number(previewZoom) - 0.27) < 0.0001;
  const effectiveOverlay = (preferLotOverlay || isUnifiedLivePreview)
    ? lotOverlay
    : (persistedOverlay || lotOverlay);

  return (
    <div ref={hostRef} className="plotflow-poster-host" style={{ display: "contents" }}>
      <PosterCanvasBase
        {...props}
        unit={unit}
        lotOverlay={effectiveOverlay}
        previewZoom={previewZoom}
      />
      {posterTarget && createPortal(
        <SalesPolicyBar handover={unit?.handover} />,
        posterTarget
      )}
    </div>
  );
}
