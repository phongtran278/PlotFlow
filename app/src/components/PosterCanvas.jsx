import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PosterCanvasBase from "./PosterCanvasBase.jsx";
import PolicyImageOverlay from "./PolicyImageOverlay.jsx";
import CampaignBadgeStrip from "./CampaignBadgeStrip.jsx";
import QuickPinOverlay from "./QuickPinOverlay.jsx";

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

export default function PosterCanvas({
  lotOverlay,
  preferLotOverlay = false,
  previewZoom = 1,
  unit,
  assets = {},
  isEditing = false,
  ...props
}) {
  const [persistedOverlay, setPersistedOverlay] = useState(() => readPersistedOverlay(unit?.unitCode));
  const [quickPinMode, setQuickPinMode] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const hostRef = useRef(null);
  const [posterTarget, setPosterTarget] = useState(null);
  const [inspectorTarget, setInspectorTarget] = useState(null);
  const [quickControlsTarget, setQuickControlsTarget] = useState(null);
  const [toolbarTarget, setToolbarTarget] = useState(null);

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

  useEffect(() => {
    const refresh = () => setLayoutRevision((value) => value + 1);
    window.addEventListener("plotflow-layout-quick-updated", refresh);
    return () => window.removeEventListener("plotflow-layout-quick-updated", refresh);
  }, []);

  useEffect(() => {
    if (isEditing) setQuickPinMode(false);
  }, [isEditing]);

  useLayoutEffect(() => {
    setPosterTarget(hostRef.current?.querySelector(".poster-canvas") || null);
    setInspectorTarget(hostRef.current?.querySelector(".inspector-panel") || null);
    setToolbarTarget(hostRef.current?.querySelector(".studio-toolbar") || null);
    setQuickControlsTarget(document.querySelector(".design-assignment-dock") || null);
  });

  const isUnifiedLivePreview = Math.abs(Number(previewZoom) - 0.27) < 0.0001;
  const effectiveOverlay = (preferLotOverlay || isUnifiedLivePreview)
    ? lotOverlay
    : (persistedOverlay || lotOverlay);

  // CampaignBadgeStrip is the single source of truth for campaign badges.
  // Legacy fixed badge slots stay disabled so the strip can reorder/resize/reflow.
  const baseAssets = { ...assets, badges: [] };

  function exitLayoutEditing() {
    document.querySelector(".edit-layout-button.active")?.click();
  }

  return (
    <div ref={hostRef} className="plotflow-poster-host" style={{ display: "contents" }}>
      <PosterCanvasBase
        key={`poster-base-${layoutRevision}`}
        {...props}
        unit={unit}
        assets={baseAssets}
        isEditing={isEditing}
        lotOverlay={effectiveOverlay}
        previewZoom={previewZoom}
      />

      {isEditing && toolbarTarget && createPortal(
        <button
          type="button"
          onClick={exitLayoutEditing}
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 9,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ✓ Exit Edit Layout
        </button>,
        toolbarTarget
      )}

      {posterTarget && createPortal(
        <>
          <CampaignBadgeStrip
            artboard={posterTarget}
            inspectorTarget={inspectorTarget}
            quickControlsTarget={quickControlsTarget}
            isEditing={isEditing}
            quickPinMode={quickPinMode}
            pinVisible={Boolean(assets.pin3D)}
            onToggleQuickPin={() => setQuickPinMode((value) => !value)}
          />
          <QuickPinOverlay
            artboard={posterTarget}
            src={assets.pin3D}
            active={!isEditing && quickPinMode}
          />
          <PolicyImageOverlay handover={unit?.handover} />
        </>,
        posterTarget
      )}
    </div>
  );
}
