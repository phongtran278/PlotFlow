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

function installSingleRasterSurface() {
  let disposed = false;
  let sequence = 0;
  let canvas = null;
  let activeBitmap = null;

  function releaseBitmap() {
    try { activeBitmap?.close?.(); } catch {}
    activeBitmap = null;
  }

  function ensureCanvas(stage) {
    if (canvas?.isConnected && canvas.parentElement === stage) return canvas;
    canvas?.remove?.();
    canvas = document.createElement("canvas");
    canvas.className = "unified-raster-canvas";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "1",
      pointerEvents: "none",
      background: "#fff",
    });
    stage.insertBefore(canvas, stage.firstChild || null);
    return canvas;
  }

  async function consumeImage(img) {
    if (disposed || !img?.isConnected) return;
    const src = img.getAttribute("src") || img.src;
    if (!src || img.dataset.plotflowCanvasConsumed === src) return;
    img.dataset.plotflowCanvasConsumed = src;

    // Keep the React node for compatibility, but prevent Chromium from promoting
    // every successive crop into another composited image texture.
    img.style.display = "none";
    img.removeAttribute("src");

    const stage = img.closest(".unified-floorplan-stage");
    if (!stage) return;
    const target = ensureCanvas(stage);
    const ownSequence = ++sequence;

    try {
      const response = await fetch(src, { cache: "no-store" });
      if (!response.ok || disposed || ownSequence !== sequence) return;
      const blob = await response.blob();
      const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(blob) : null;
      if (!bitmap || disposed || ownSequence !== sequence) {
        try { bitmap?.close?.(); } catch {}
        return;
      }

      releaseBitmap();
      activeBitmap = bitmap;
      const width = Math.max(2, Number(bitmap.width) || 1280);
      const height = Math.max(2, Number(bitmap.height) || 986);
      if (target.width !== width) target.width = width;
      if (target.height !== height) target.height = height;
      const ctx = target.getContext("2d", { alpha: false });
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      releaseBitmap();

      if (typeof window !== "undefined") {
        window.__plotflowRasterSurface = {
          mode: "single-canvas",
          width,
          height,
          activeBitmaps: 0,
          renders: (window.__plotflowRasterSurface?.renders || 0) + 1,
        };
      }
    } catch (error) {
      if (!disposed) console.debug("Single raster surface skipped", error);
    }
  }

  function scan(root = document) {
    root.querySelectorAll?.(".unified-floorplan-stage .unified-hq-image").forEach(consumeImage);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target?.matches?.(".unified-hq-image")) {
        consumeImage(mutation.target);
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(".unified-hq-image")) consumeImage(node);
        scan(node);
      });
    }
  });

  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  scan();

  return () => {
    disposed = true;
    sequence += 1;
    observer.disconnect();
    releaseBitmap();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
      canvas.remove();
      canvas = null;
    }
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

  useEffect(() => installSingleRasterSurface(), []);

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