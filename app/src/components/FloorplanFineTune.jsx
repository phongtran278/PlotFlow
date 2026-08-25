import { useEffect } from "react";
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
import {
  calculateCropRect,
  FLOORPLAN_FRAME_ASPECT,
  FLOORPLAN_ZOOM_MAX,
  FLOORPLAN_ZOOM_MIN,
  normalizeUnitCode,
} from "../floorplan/pdfLocator";

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function setNativeInputValue(input, value) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function FloorplanViewportAssist({ pageRender }) {
  useEffect(() => {
    const editor = document.querySelector(".unified-floorplan-v2");
    if (!editor) return undefined;

    const zoomRow = editor.querySelector(".unified-zoom-row");
    const zoomNumber = zoomRow?.querySelector('input[type="number"]');
    const zoomRange = editor.querySelector(".unified-range");
    const positionInputs = Array.from(editor.querySelectorAll(".unified-position input"));
    const stage = editor.querySelector(".unified-floorplan-stage");
    const canvasColumn = editor.querySelector(".unified-canvas-column");
    if (!zoomRow || !zoomNumber || !stage || !canvasColumn) return undefined;

    let active = false;
    let startX = 0;
    let startZoom = 100;
    let frame = 0;
    let revealTimer = 0;

    const scrub = document.createElement("button");
    scrub.type = "button";
    scrub.className = "pf-detail-zoom-scrub";
    scrub.title = "Drag trái/phải để zoom mượt";
    zoomRow.insertAdjacentElement("afterend", scrub);

    let minimap = null;
    let minimapViewport = null;
    let minimapAnchor = null;
    if (pageRender?.dataUrl) {
      minimap = document.createElement("div");
      minimap.className = "pf-detail-minimap";
      minimap.innerHTML = `
        <span class="pf-detail-minimap-label">NAVIGATION</span>
        <div class="pf-detail-minimap-map">
          <img alt="Masterplan navigation" draggable="false" />
          <i class="pf-detail-minimap-anchor"></i>
          <b class="pf-detail-minimap-viewport"></b>
        </div>`;
      minimap.querySelector("img").src = pageRender.dataUrl;
      minimapViewport = minimap.querySelector(".pf-detail-minimap-viewport");
      minimapAnchor = minimap.querySelector(".pf-detail-minimap-anchor");
      canvasColumn.appendChild(minimap);
    }

    function readView() {
      return {
        zoom: clamp(zoomNumber.value, FLOORPLAN_ZOOM_MIN, FLOORPLAN_ZOOM_MAX),
        offsetX: Number(positionInputs[0]?.value) || 0,
        offsetY: Number(positionInputs[1]?.value) || 0,
      };
    }

    function updateScrub() {
      scrub.textContent = `ZOOM ${Math.round(readView().zoom)}% · DRAG ↔`;
    }

    function updateMinimap() {
      if (!minimapViewport || !pageRender?.width || !pageRender?.height) return;
      const crop = calculateCropRect(pageRender, readView(), FLOORPLAN_FRAME_ASPECT);
      minimapViewport.style.left = `${crop.x / pageRender.width * 100}%`;
      minimapViewport.style.top = `${crop.y / pageRender.height * 100}%`;
      minimapViewport.style.width = `${crop.w / pageRender.width * 100}%`;
      minimapViewport.style.height = `${crop.h / pageRender.height * 100}%`;
      if (minimapAnchor) {
        minimapAnchor.style.left = `${pageRender.anchorX / pageRender.width * 100}%`;
        minimapAnchor.style.top = `${pageRender.anchorY / pageRender.height * 100}%`;
      }
    }

    function markInteracting() {
      stage.classList.add("pf-view-interacting");
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => stage.classList.remove("pf-view-interacting"), 900);
      updateScrub();
      updateMinimap();
    }

    function setZoom(value) {
      setNativeInputValue(zoomNumber, Math.round(clamp(value, FLOORPLAN_ZOOM_MIN, FLOORPLAN_ZOOM_MAX)));
      markInteracting();
    }

    function onScrubDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      active = true;
      startX = event.clientX;
      startZoom = readView().zoom;
      scrub.setPointerCapture?.(event.pointerId);
      markInteracting();
    }

    function onScrubMove(event) {
      if (!active) return;
      const clientX = event.clientX;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = startZoom * Math.exp((clientX - startX) * 0.008);
        setZoom(next);
      });
    }

    function onScrubUp(event) {
      if (!active) return;
      active = false;
      scrub.releasePointerCapture?.(event.pointerId);
      markInteracting();
    }

    function onViewInput() {
      markInteracting();
    }

    function onWheel(event) {
      if (event.target.closest?.("button,input,select,textarea")) return;
      event.preventDefault();
      const current = readView().zoom;
      setZoom(current * Math.exp(-event.deltaY * 0.0018));
    }

    function onMinimapPointer(event) {
      const map = minimap?.querySelector(".pf-detail-minimap-map");
      if (!map || positionInputs.length < 2) return;
      const rect = map.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const pageX = clamp((event.clientX - rect.left) / rect.width, 0, 1) * pageRender.width;
      const pageY = clamp((event.clientY - rect.top) / rect.height, 0, 1) * pageRender.height;
      setNativeInputValue(positionInputs[0], Math.round(pageX - pageRender.anchorX));
      setNativeInputValue(positionInputs[1], Math.round(pageY - pageRender.anchorY));
      markInteracting();
    }

    scrub.addEventListener("pointerdown", onScrubDown);
    scrub.addEventListener("pointermove", onScrubMove);
    scrub.addEventListener("pointerup", onScrubUp);
    scrub.addEventListener("pointercancel", onScrubUp);
    zoomNumber.addEventListener("input", onViewInput);
    zoomRange?.addEventListener("input", onViewInput);
    positionInputs.forEach((input) => input.addEventListener("input", onViewInput));
    stage.addEventListener("wheel", onWheel, { passive: false });
    minimap?.addEventListener("pointerdown", onMinimapPointer);
    updateScrub();
    updateMinimap();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(revealTimer);
      stage.classList.remove("pf-view-interacting");
      scrub.removeEventListener("pointerdown", onScrubDown);
      scrub.removeEventListener("pointermove", onScrubMove);
      scrub.removeEventListener("pointerup", onScrubUp);
      scrub.removeEventListener("pointercancel", onScrubUp);
      zoomNumber.removeEventListener("input", onViewInput);
      zoomRange?.removeEventListener("input", onViewInput);
      positionInputs.forEach((input) => input.removeEventListener("input", onViewInput));
      stage.removeEventListener("wheel", onWheel);
      minimap?.removeEventListener("pointerdown", onMinimapPointer);
      scrub.remove();
      minimap?.remove();
    };
  }, [pageRender]);

  return null;
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
    <>
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
      <FloorplanViewportAssist pageRender={pageRender} />
    </>
  );
}
