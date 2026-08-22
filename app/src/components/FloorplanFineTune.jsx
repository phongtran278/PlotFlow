import UnifiedFloorplanEditor, { DEFAULT_FLOORPLAN_VIEW } from "./UnifiedFloorplanEditorV2.jsx";
import "./UnifiedFloorplanEntry.css";
import { assetLibrary } from "../data/assetLibrary";
import {
  amenityCatalog,
  badgeCatalog,
  findCatalogAsset,
  houseCatalog,
  logoCatalog,
  pinAssets,
} from "../data/assetCatalog";
import { resolveArchitectureHouseAsset } from "../data/architectureAutoMatch.js";
import { normalizeUnitCode } from "../floorplan/pdfLocator";

export { DEFAULT_FLOORPLAN_VIEW };

const LOT_OVERLAY_KEY = "plotflow-lot-overlays-r1-v9";
const DESIGN_ASSIGNMENT_KEY = "plotflow-design-assignments-r1";
const FLOORPLAN_OVERRIDE_KEY = "plotflow-floorplan-overrides-v6";

function loadJson(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function truthy(value) {
  return ["1", "TRUE", "YES", "Y", "X", "ON"].includes(String(value || "").trim().toUpperCase());
}

function resolvePosterAssets(unit) {
  if (!unit) return { badges: [], pin2D: pinAssets.pin2D };
  const code = normalizeUnitCode(unit.unitCode);
  const saved = loadJson(DESIGN_ASSIGNMENT_KEY, {})[code] || {};

  // Source houseModel wins. If it is blank, use only an exact compatible auto
  // architecture match. Never fall back to the first/random house in catalog.
  const explicitHouse = findCatalogAsset(houseCatalog, unit.houseModel);
  const autoHouse = resolveArchitectureHouseAsset(unit, houseCatalog).asset;
  const house = explicitHouse || autoHouse || null;
  const amenity1 = amenityCatalog.find((item) => item.id === saved.amenity1Id)
    || findCatalogAsset(amenityCatalog, unit.amenity1)
    || amenityCatalog[0];
  const amenity2 = amenityCatalog.find((item) => item.id === saved.amenity2Id)
    || findCatalogAsset(amenityCatalog, unit.amenity2)
    || amenityCatalog[1]
    || amenityCatalog[0];
  const logo = Object.prototype.hasOwnProperty.call(saved, "logoId")
    ? logoCatalog.find((item) => item.id === saved.logoId)
    : (findCatalogAsset(logoCatalog, unit.logoVariant) || logoCatalog.find((item) => item.id === "LOGO_WHITE"));

  const badgeIds = Object.prototype.hasOwnProperty.call(saved, "badges")
    ? saved.badges
    : [
        truthy(unit.showHotDeal) ? "BADGE_HOT_DEAL" : null,
        truthy(unit.showEarlyMoveIn) ? "BADGE_VE_O_SOM" : null,
      ].filter(Boolean);

  return {
    houseImage: house?.src ?? assetLibrary.houses[unit.houseModel] ?? null,
    floorplanImage: assetLibrary.floorplans[unit.floorplan] ?? null,
    amenity1Image: amenity1?.src ?? assetLibrary.amenities[unit.amenity1] ?? null,
    amenity2Image: amenity2?.src ?? assetLibrary.amenities[unit.amenity2] ?? null,
    logoImage: logo?.src ?? null,
    badges: (badgeIds || []).map((id) => badgeCatalog.find((item) => item.id === id)).filter(Boolean),
    pin3D: saved.pin3DVisible ? pinAssets.pin3D : null,
    pin2D: pinAssets.pin2D,
  };
}

function persistOverlay(code, overlay) {
  if (!code || !overlay) return;
  const all = loadJson(LOT_OVERLAY_KEY, {});
  all[code] = { ...overlay, stale: false };
  localStorage.setItem(LOT_OVERLAY_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("plotflow-overlay-updated", { detail: { unitCode: code } }));
}

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
  const code = normalizeUnitCode(unit?.unitCode);
  const currentIndex = locatorResult?.selectedMatchIndex ?? 0;
  const savedOverride = loadJson(FLOORPLAN_OVERRIDE_KEY, {})[code] || null;
  const persistedOverlay = loadJson(LOT_OVERLAY_KEY, {})[code] || null;

  const sameSavedSource = savedOverride
    ? (savedOverride.selectedMatchIndex ?? 0) === currentIndex
    : currentIndex === 0;

  const initialOverlay = sameSavedSource && !persistedOverlay?.stale ? persistedOverlay : null;
  const effectiveInitialView = sameSavedSource
    ? ({ ...DEFAULT_FLOORPLAN_VIEW, ...(initialView || {}) })
    : DEFAULT_FLOORPLAN_VIEW;

  const posterAssets = resolvePosterAssets(unit);

  async function saveComposition(view, overlay) {
    persistOverlay(code, overlay);
    await onSave?.(view);
    persistOverlay(code, overlay);
  }

  return (
    <UnifiedFloorplanEditor
      unit={unit}
      locatorResult={locatorResult}
      pageRender={pageRender}
      initialView={effectiveInitialView}
      initialOverlay={initialOverlay}
      posterAssets={posterAssets}
      pinSrc={pinAssets.pin2D}
      onCancel={onCancel}
      onSave={saveComposition}
      onCandidateChange={onCandidateChange}
      onRenderVectorPreview={onRenderVectorPreview}
    />
  );
}
