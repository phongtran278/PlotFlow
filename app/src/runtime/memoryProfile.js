const OVERRIDE_KEY = "plotflow-memory-mode";
const MASTERPLAN_CACHE_REVISION_KEY = "plotflow-masterplan-cache-revision";
const MASTERPLAN_CACHE_REVISION = "hoan-thien-light-20260825-v1";
const FLOORPLAN_OVERRIDE_KEY = "plotflow-floorplan-overrides-v6";

function migrateLightweightMasterplanCache() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage?.getItem(MASTERPLAN_CACHE_REVISION_KEY) === MASTERPLAN_CACHE_REVISION) return;

    // The bundled PDF changed without changing its public URL. The old raster/index DB
    // was keyed by URL, so keeping it can point Detail at coordinates from the previous PDF.
    try { window.indexedDB?.deleteDatabase?.("plotflow-raster-cache-v1"); } catch {}

    // Preserve candidate choices but drop zoom/pan coordinates from the previous source.
    // This mirrors Overview's source-first locator behavior on the first run after migration.
    try {
      const raw = JSON.parse(window.localStorage?.getItem(FLOORPLAN_OVERRIDE_KEY) || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const next = {};
        Object.entries(raw).forEach(([code, value]) => {
          if (!value || typeof value !== "object") return;
          const { view: _staleView, ...rest } = value;
          next[code] = rest;
        });
        window.localStorage?.setItem(FLOORPLAN_OVERRIDE_KEY, JSON.stringify(next));
      }
    } catch {}

    window.localStorage?.setItem(MASTERPLAN_CACHE_REVISION_KEY, MASTERPLAN_CACHE_REVISION);
  } catch {}
}

migrateLightweightMasterplanCache();

function readOverride() {
  try {
    return window.localStorage?.getItem(OVERRIDE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function getMemoryProfile() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      mode: "low",
      lowMemory: true,
      deviceMemory: null,
      cores: null,
      lotEditorWidth: 1600,
      previewCacheTarget: 2,
      pageCacheTarget: 2,
      objectUrlTarget: 2,
      preloadNextUnit: false,
      pdfIdleReleaseMs: 4000,
    };
  }

  const override = readOverride();
  const deviceMemory = numberOrNull(navigator.deviceMemory);
  const cores = numberOrNull(navigator.hardwareConcurrency);

  // PlotFlow is memory-first by default so 4 GB office laptops remain a supported baseline.
  // Balanced mode is an explicit opt-in for stronger machines that prefer preload/cache speed.
  const detectedLowMemory = true;
  const lowMemory = override === "balanced" ? false : override === "low" ? true : detectedLowMemory;

  return {
    mode: lowMemory ? "low" : "balanced",
    lowMemory,
    deviceMemory,
    cores,
    lotEditorWidth: lowMemory ? 1600 : 2168,
    previewCacheTarget: lowMemory ? 2 : 12,
    pageCacheTarget: lowMemory ? 2 : 4,
    objectUrlTarget: lowMemory ? 2 : 36,
    preloadNextUnit: !lowMemory,
    pdfIdleReleaseMs: lowMemory ? 4000 : 30000,
  };
}

export function installMemoryProfile() {
  if (typeof window === "undefined") return getMemoryProfile();
  const profile = getMemoryProfile();
  window.__plotflowMemoryProfile = profile;
  document.documentElement.dataset.plotflowMemory = profile.mode;
  return profile;
}

export function setMemoryMode(mode = "auto") {
  if (typeof window === "undefined") return;
  const value = ["auto", "low", "balanced"].includes(mode) ? mode : "auto";
  try { window.localStorage?.setItem(OVERRIDE_KEY, value); } catch {}
  installMemoryProfile();
}
