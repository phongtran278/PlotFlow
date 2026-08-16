import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PosterCanvasBase from "./PosterCanvasBase.jsx";
import PolicyImageOverlay from "./PolicyImageOverlay.jsx";
import CampaignBadgeStrip from "./CampaignBadgeStrip.jsx";
import "./CampaignBadgeStrip.css";
import ArchitectureAutoMatchCard from "./ArchitectureAutoMatchCard.jsx";
import QuickPinOverlay from "./QuickPinOverlay.jsx";
import { houseCatalog } from "../data/assetCatalog.js";
import { resolveArchitectureHouseAsset, withResolvedArchitecture } from "../data/architectureAutoMatch.js";

const LOT_OVERLAY_KEY = "plotflow-lot-overlays-r1-v9";
const DESIGN_ASSIGNMENT_KEY = "plotflow-design-assignments-r1";

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

function hasSavedHouseOverride(unitCode) {
  const code = normalizeCode(unitCode);
  if (!code) return false;
  try {
    const all = JSON.parse(localStorage.getItem(DESIGN_ASSIGNMENT_KEY) || "{}");
    return Object.prototype.hasOwnProperty.call(all?.[code] || {}, "houseId");
  } catch {
    return false;
  }
}

function normalizeSidebarPriceText() {
  document.querySelectorAll(".unit-select > span:last-child").forEach((node) => {
    const text = String(node.textContent || "").trim();
    if (!text || text === "—" || !text.toLowerCase().includes("tỷ")) return;
    const raw = text.replace(/tỷ/gi, "").trim().replace(/,/g, ".");
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const truncated = Math.trunc((value + Number.EPSILON) * 1000) / 1000;
    const next = `${truncated.toFixed(3)} tỷ`;
    if (node.textContent !== next) node.textContent = next;
  });
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
  const hostRef = useRef(null);
  const [posterTarget, setPosterTarget] = useState(null);
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
    setQuickPinMode(false);
  }, [unit?.unitCode, isEditing]);

  useLayoutEffect(() => {
    setPosterTarget(hostRef.current?.querySelector(".poster-canvas") || null);
    setToolbarTarget(hostRef.current?.querySelector(".studio-toolbar") || null);
    setQuickControlsTarget(document.querySelector(".design-assignment-dock") || null);
    normalizeSidebarPriceText();
  });

  const isUnifiedLivePreview = Math.abs(Number(previewZoom) - 0.27) < 0.0001;
  const effectiveOverlay = (preferLotOverlay || isUnifiedLivePreview)
    ? lotOverlay
    : (persistedOverlay || lotOverlay);

  const resolvedUnit = withResolvedArchitecture(unit);
  const houseResolution = resolveArchitectureHouseAsset(unit, houseCatalog);
  const canAutoHouse = Boolean(
    resolvedUnit &&
    !String(unit?.houseModel || "").trim() &&
    !hasSavedHouseOverride(unit?.unitCode) &&
    houseResolution.asset
  );
  const baseAssets = {
    ...assets,
    badges: [],
    ...(canAutoHouse ? { houseImage: houseResolution.asset.src } : {}),
  };

  function exitLayoutEditing() {
    document.querySelector(".edit-layout-button.active")?.click();
  }

  return (
    <div ref={hostRef} className="plotflow-poster-host" style={{ display: "contents" }}>
      <PosterCanvasBase
        {...props}
        unit={resolvedUnit}
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

      <ArchitectureAutoMatchCard
        unit={unit}
        target={quickControlsTarget}
        isEditing={isEditing}
      />

      {posterTarget && createPortal(
        <>
          <CampaignBadgeStrip
            artboard={posterTarget}
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
            unitCode={unit?.unitCode}
          />
          <PolicyImageOverlay handover={unit?.handover} />
        </>,
        posterTarget
      )}
    </div>
  );
}
