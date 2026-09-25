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
import { findCatalogAsset, houseCatalog, pinAssets } from "../data/assetCatalog.js";
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="578" viewBox="0 0 1080 578"><rect width="1080" height="578" fill="#f3f5f5"/><rect x="32" y="32" width="1016" height="514" rx="24" fill="none" stroke="#c5cdcb" stroke-width="3" stroke-dasharray="12 10"/><text x="540" y="265" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#67716f">CHƯA CÓ MẪU NHÀ</text><text x="540" y="315" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#2d3634">${safe}</text><text x="540" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#8b9492">Kết nối dữ liệu hoặc chọn mẫu nhà khi cần</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function focusSheetInput() {
  const input = document.querySelector(".sheet-connect input[type='text']");
  input?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  window.setTimeout(() => input?.focus?.(), 220);
}

function openExcelPicker() {
  document.querySelector(".excel-import-button input[type='file']")?.click?.();
}

export default function PosterCanvas({
  lotOverlay,
  preferLotOverlay = false,
  previewZoom = 1,
  unit = {},
  assets = {},
  isEditing = false,
  floorplanStatus,
  placeholderMode = false,
  ...props
}) {
  const [persistedOverlay, setPersistedOverlay] = useState(() => placeholderMode ? null : readPersistedOverlay(unit?.unitCode));
  const [quickPinMode, setQuickPinMode] = useState(false);
  const [manualLocatorOpen, setManualLocatorOpen] = useState(false);
  const [manualFloorplanImage, setManualFloorplanImage] = useState(() => placeholderMode ? null : readManualFloorplan(unit?.unitCode));
  const [manualLocatorBusy, setManualLocatorBusy] = useState(false);
  const [quickTextOverride, setQuickTextOverride] = useState(() => placeholderMode ? null : readQuickTextOverride(unit?.unitCode));
  const hostRef = useRef(null);
  const [posterTarget, setPosterTarget] = useState(null);
  const [quickControlsTarget, setQuickControlsTarget] = useState(null);
  const [toolbarTarget, setToolbarTarget] = useState(null);

  useEffect(() => {
    if (placeholderMode) {
      setPersistedOverlay(null);
      return undefined;
    }
    const sync = () => setPersistedOverlay(readPersistedOverlay(unit?.unitCode));
    sync();
    window.addEventListener("plotflow-overlay-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("plotflow-overlay-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [unit?.unitCode, placeholderMode]);

  useEffect(() => {
    if (placeholderMode) {
      setQuickTextOverride(null);
      return undefined;
    }
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
  }, [unit?.unitCode, placeholderMode]);

  useEffect(() => {
    setQuickPinMode(false);
    setManualLocatorOpen(false);
    setManualFloorplanImage(placeholderMode ? null : readManualFloorplan(unit?.unitCode));
  }, [unit?.unitCode, isEditing, placeholderMode]);

  useEffect(() => {
    if (placeholderMode) return undefined;
    function openPinArrange(event) {
      const eventCode = normalizeCode(event?.detail?.unitCode);
      if (eventCode && eventCode !== normalizeCode(unit?.unitCode)) return;
      if (!isEditing) setQuickPinMode(true);
    }
    window.addEventListener("plotflow-open-pin-arrange", openPinArrange);
    return () => window.removeEventListener("plotflow-open-pin-arrange", openPinArrange);
  }, [isEditing, unit?.unitCode, placeholderMode]);

  useLayoutEffect(() => {
    setPosterTarget(hostRef.current?.querySelector(".poster-canvas") || null);
    setToolbarTarget(hostRef.current?.querySelector(".studio-toolbar") || null);
    setQuickControlsTarget(document.querySelector(".design-assignment-dock") || null);
    normalizeSidebarPriceText();
  });

  const isUnifiedLivePreview = Math.abs(Number(previewZoom) - 0.27) < 0.0001;
  const effectiveOverlay = placeholderMode ? null : ((preferLotOverlay || isUnifiedLivePreview)
    ? lotOverlay
    : (persistedOverlay || lotOverlay));

  const dataResolvedUnit = placeholderMode ? unit : withResolvedArchitecture(unit);
  const resolvedUnit = placeholderMode ? dataResolvedUnit : applyQuickTextOverride(dataResolvedUnit, quickTextOverride);
  const effectivePinSrc = placeholderMode ? null : (assets.pin3D || pinAssets.pin3D);

  const manualHouse = placeholderMode ? null : readManualHouse(unit?.unitCode);
  const sheetHouse = placeholderMode ? null : findCatalogAsset(houseCatalog, unit?.houseModel);
  const houseResolution = placeholderMode ? { asset: null, suggestedHouseModel: "", expectedAssetKey: "" } : resolveArchitectureHouseAsset(unit, houseCatalog);
  const resolvedHouse = manualHouse || sheetHouse || houseResolution.asset || null;
  const missingKey = placeholderMode
    ? "Mẫu nhà sẽ hiển thị sau khi có dữ liệu"
    : (resolvedHouse ? "" : (houseResolution.suggestedHouseModel || houseResolution.expectedAssetKey || ""));
  const baseAssets = {
    ...assets,
    badges: placeholderMode ? [] : (assets.badges || []),
    pin3D: effectivePinSrc,
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

  const manualControl = !placeholderMode && !isEditing && quickControlsTarget && floorplanStatus === "not_found"
    ? createPortal(
        <div className="manual-locator-quick-card">
          <div><span>FLOORPLAN</span><strong>Auto Locate chưa tìm thấy</strong></div>
          <button type="button" onClick={() => setManualLocatorOpen(true)}>✎ Manual Locate</button>
        </div>,
        quickControlsTarget
      )
    : null;

  if (placeholderMode) {
    return (
      <section className="pf-detail-empty-state" aria-label="Connect sales data to begin">
        <div className="pf-detail-empty-orbit" aria-hidden="true"><i /><i /><i /><b /></div>
        <div className="pf-detail-empty-copy">
          <span>DETAIL WORKSPACE · READY FOR DATA</span>
          <h3>Turn one sales sheet into a live design workspace.</h3>
          <p>Connect the project data first. PlotFlow will populate units, match the floorplan workflow, and open the design controls only when there is something real to work with.</p>
          <div className="pf-detail-empty-actions">
            <button type="button" className="primary" onClick={focusSheetInput}>Connect Google Sheet <span>→</span></button>
            <button type="button" onClick={openExcelPicker}>Import Excel</button>
          </div>
          <footer><span>01 · Connect data</span><i /><span>02 · Locate floorplan</span><i /><span>03 · Refine & export</span></footer>
        </div>
      </section>
    );
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
            pinVisible={Boolean(effectivePinSrc)}
            onToggleQuickPin={() => setQuickPinMode((value) => !value)}
            unitCode={unit?.unitCode}
            sourceBadges={baseAssets.badges}
          />
          <QuickPinOverlay artboard={posterTarget} src={effectivePinSrc} active={!isEditing && quickPinMode} unitCode={unit?.unitCode} />
          <PolicyImageOverlay handover={unit?.handover} />
        </>,
        posterTarget
      )}
    </div>
  );
}
