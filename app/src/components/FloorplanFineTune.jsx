import { useCallback, useRef } from "react";
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

const DESIGN_ASSIGNMENT_KEY = "plotflow-design-assignments-r1";

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

export default function FloorplanFineTune({
  unit,
  locatorResult,
  pageRender,
  initialView,
  onCancel,
  onSave,
  onCandidateChange,
  onRenderVectorPreview,
  initialOverlay,
  onBoundaryResult,
  startManual,
}) {
  const renderPreviewRef = useRef(onRenderVectorPreview);
  renderPreviewRef.current = onRenderVectorPreview;
  const stableRenderPreview = useCallback((view) => renderPreviewRef.current?.(view), []);
  const posterAssets = resolvePosterAssets(unit);

  return (
    <UnifiedFloorplanEditor
      unit={unit}
      locatorResult={locatorResult}
      pageRender={pageRender}
      initialView={initialView}
      initialOverlay={initialOverlay}
      posterAssets={posterAssets}
      pinSrc={pinAssets.pin2D}
      onCancel={onCancel}
      onSave={onSave}
      onCandidateChange={onCandidateChange}
      onBoundaryResult={onBoundaryResult}
      startManual={startManual}
      onRenderVectorPreview={stableRenderPreview}
    />
  );
}
