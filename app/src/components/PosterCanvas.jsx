import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PosterCanvasBase from "./PosterCanvasBase.jsx";
import PolicyImageOverlay from "./PolicyImageOverlay.jsx";
import CampaignBadgeStrip from "./CampaignBadgeStrip.jsx";
import "./CampaignBadgeStrip.css";
import ArchitectureAutoMatchCard from "./ArchitectureAutoMatchCard.jsx";
import QuickPinOverlay from "./QuickPinOverlay.jsx";
import QuickTextOverride, { applyQuickTextOverride, readQuickTextOverride } from "./QuickTextOverride.jsx";
import ManualFloorplanLocator from "./ManualFloorplanLocator.jsx";
import "./ManualFloorplanLocator.css";
import { findCatalogAsset, houseCatalog } from "../data/assetCatalog.js";
import { resolveArchitectureHouseAsset, withResolvedArchitecture } from "../data/architectureAutoMatch.js";
import { renderPdfPageBase, renderPdfRegion } from "../floorplan/pdfLocator.js";

const LOT_OVERLAY_KEY = "plotflow-lot-overlays-r1-v9";
const MANUAL_FLOORPLAN_KEY = "plotflow-manual-floorplans-v1";
const DESIGN_ASSIGNMENT_KEY = "plotflow-design-assignments-r1";

function normalizeCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}

function readPersistedOverlay(unitCode) {
  const code = normalizeCode(unitCode);
  if (!code) return null;
  const overlay = readJson(LOT_OVERLAY_KEY)?.[code] || null;
  return overlay?.stale ? null : overlay;
}

function readManualFloorplan(unitCode) {
  const code = normalizeCode(unitCode);
  return code ? (readJson(MANUAL_FLOORPLAN_KEY)?.[code]?.dataUrl || null) : null;
}

function readManualHouse(unitCode) {
  const code = normalizeCode(unitCode);
  if (!code) return null;
  const savedHouseId = readJson(DESIGN_ASSIGNMENT_KEY)?.[code]?.houseId;
  return findCatalogAsset(houseCatalog, savedHouseId);
}

function saveManualFloorplan(unitCode, payload) {
  const code = normalizeCode(unitCode);
  if (!code || !payload?.dataUrl) return;
  const all = readJson(MANUAL_FLOORPLAN_KEY);
  all[code] = payload;
  try { localStorage.setItem(MANUAL_FLOORPLAN_KEY, JSON.stringify(all)); } catch { /* optional cache */ }
}

function normalizeSidebarPriceText() {
  document.querySelectorAll(".unit-select > span:last-child").forEach((node) => {
    const text = String(node.textContent || "").trim();
    if (!text || text === "—") return;
    const next = text.replace(/,/g, ".");
    if (node.textContent !== next) node.textContent = next;
  });
}

function missingHousePlaceholder(key = "HOUSE ASSET") {
  const safe = String(key || "HOUSE ASSET").replace(/[<>&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="578" viewBox="0 0 1080 578"><rect width="1080" height="578" fill="#f3f5f5"/><rect x="32" y="32" width="1016" height="514" rx="24" fill="none" stroke="#c5cdcb" stroke-width="3" stroke-dasharray="12 10"/><text x="540" y="265" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#67716f">MISSING HOUSE ASSET</text><text x="540" y="315" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#2d3634">${safe}</text><text x="540" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#8b9492">Bổ sung đúng file vào assets/houses rồi chạy npm run setup</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function PosterCanvas({
  lotOverlay,
  preferLotOverlay = false,
  previewZoom = 1,
  unit,
  assets = {},
  isEditing = false,
  floorplanStatus,
  ...props
}) {
  const [persistedOverlay, setPersistedOverlay] = useState(() => readPersistedOverlay(unit?.unitCode));
  const [quickPinMode, setQuickPinMode] = useState(false);
  const [manualLocatorOpen, setManualLocatorOpen] = useState(false);
  const [manualFloorplanImage, setManualFloorplanImage] = useState(() => readManualFloorplan(unit?.unitCode));
  const [manualLocatorBusy, setManualLocatorBusy] = useState(false);
  const [quickTextOverride, setQuickTextOverride] = useState(() => readQuickTextOverride(unit?.unitCode));
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
    const syncQuickText = (event) => {
      const eventCode = normalizeCode(event?.detail?.unitCode);
      if (eventCode && eventCode !== normalizeCode(unit?.unitCode)) return;
      setQuickTextOverride(readQuickTextOverride(unit?.unitCode));
    };
    setQuickTextOverride(readQuickTextOverride(unit?.unitCode));
    window.addEventListener("plotflow-quick-text-updated", syncQuickText);
    window.addEventListener("storage", syncQuickText);
    return () => {
      window.removeEventListener("plotflow-quick-text-updated", syncQuickText);
      window.removeEventListener("storage", syncQuickText);
    };
  }, [unit?.unitCode]);

  useEffect(() => {
    setQuickPinMode(false);
    setManualLocatorOpen(false);
    setManualFloorplanImage(readManualFloorplan(unit?.unitCode));
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

  const dataResolvedUnit = withResolvedArchitecture(unit);
  const resolvedUnit = applyQuickTextOverride(dataResolvedUnit, quickTextOverride);

  // House priority is intentional:
  // 1) a house explicitly chosen in the UI for this unit,
  // 2) the source Sheet/Excel houseModel,
  // 3) strict architecture auto-match,
  // 4) explicit Missing placeholder.
  // This keeps base models such as CH75_LK valid for normal linked houses while
  // still requiring CH75_LK_XE_KHE only when the unit is actually marked xẻ khe.
  const manualHouse = readManualHouse(unit?.unitCode);
  const sheetHouse = findCatalogAsset(houseCatalog, unit?.houseModel);
  const houseResolution = resolveArchitectureHouseAsset(unit, houseCatalog);
  const resolvedHouse = manualHouse || sheetHouse || houseResolution.asset || null;
  const missingKey = resolvedHouse ? "" : (houseResolution.suggestedHouseModel || houseResolution.expectedAssetKey || "");
  const baseAssets = {
    ...assets,
    badges: [],
    houseImage: resolvedHouse?.src || (missingKey ? missingHousePlaceholder(missingKey) : null),
    houseMissingKey: missingKey,
    ...(manualFloorplanImage ? { floorplanImage: manualFloorplanImage } : {}),
  };

  function exitLayoutEditing() {
    document.querySelector(".edit-layout-button.active")?.click();
  }

  async function applyManualFloorplan({ pageNumber, x, y, zoom = 180, pdfDoc }) {
    if (!pdfDoc) return;
    try {
      setManualLocatorBusy(true);
      const pageBase = await renderPdfPageBase(pdfDoc, pageNumber, 1.7);
      const pageRender = {
        ...pageBase,
        anchorX: x * pageBase.width,
        anchorY: y * pageBase.height,
        anchorW: 18,
        anchorH: 18,
      };
      const view = { zoom, offsetX: 0, offsetY: 0, highlight: false };
      const crop = await renderPdfRegion(pdfDoc, pageRender, view, {
        outputWidth: 1084,
        includeHighlight: false,
        maxRenderScale: 128,
      });
      const payload = { dataUrl: crop.dataUrl, pageNumber, x, y, zoom };
      saveManualFloorplan(unit?.unitCode, payload);
      setManualFloorplanImage(crop.dataUrl);
      setManualLocatorOpen(false);
    } finally {
      setManualLocatorBusy(false);
    }
  }

  const manualControl = !isEditing && quickControlsTarget && floorplanStatus === "not_found"
    ? createPortal(
        <div className="manual-locator-quick-card">
          <div><span>FLOORPLAN</span><strong>Auto Locate chưa tìm thấy</strong></div>
          <button type="button" onClick={() => setManualLocatorOpen(true)}>✎ Manual Locate</button>
        </div>,
        quickControlsTarget
      )
    : null;

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
        <button type="button" onClick={exitLayoutEditing} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}>
          ✓ Exit Edit Layout
        </button>,
        toolbarTarget
      )}

      <ArchitectureAutoMatchCard unit={unit} target={quickControlsTarget} isEditing={isEditing} />
      <QuickTextOverride unit={unit} resolvedUnit={dataResolvedUnit} target={quickControlsTarget} isEditing={isEditing} />
      {manualControl}

      {manualLocatorOpen && createPortal(
        <ManualFloorplanLocator
          initialPage={1}
          busy={manualLocatorBusy}
          onCancel={() => setManualLocatorOpen(false)}
          onPick={applyManualFloorplan}
        />,
        document.body
      )}

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
          <QuickPinOverlay artboard={posterTarget} src={assets.pin3D} active={!isEditing && quickPinMode} unitCode={unit?.unitCode} />
          <PolicyImageOverlay handover={unit?.handover} />
        </>,
        posterTarget
      )}
    </div>
  );
}
