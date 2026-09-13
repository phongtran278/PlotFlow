const OVERRIDE_KEY = "plotflow-memory-mode";
const MASTERPLAN_CACHE_REVISION_KEY = "plotflow-masterplan-cache-revision";
const MASTERPLAN_CACHE_REVISION = "hoan-thien-light-20260825-v1";
const FLOORPLAN_OVERRIDE_KEY = "plotflow-floorplan-overrides-v6";

function migrateLightweightMasterplanCache() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage?.getItem(MASTERPLAN_CACHE_REVISION_KEY) === MASTERPLAN_CACHE_REVISION) return;

    try { window.indexedDB?.deleteDatabase?.("plotflow-raster-cache-v1"); } catch {}

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

function platformInfo() {
  if (typeof navigator === "undefined") return { platform: "unknown", windows: false, mac: false };
  const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "unknown");
  const normalized = platform.toLowerCase();
  return {
    platform,
    windows: normalized.includes("win"),
    mac: normalized.includes("mac"),
  };
}

export function getMemoryProfile() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      mode: "low",
      lowMemory: true,
      deviceMemory: null,
      cores: null,
      platform: "unknown",
      windows: false,
      mac: false,
      lotEditorWidth: 1600,
      previewCacheTarget: 2,
      pageCacheTarget: 2,
      objectUrlTarget: 2,
      preloadNextUnit: false,
      pdfIdleReleaseMs: 4000,
      overviewTileTarget: 8,
      overviewParallelLoads: 1,
      overviewMaxDpr: 1,
    };
  }

  const override = readOverride();
  const deviceMemory = numberOrNull(navigator.deviceMemory);
  const cores = numberOrNull(navigator.hardwareConcurrency);
  const platform = platformInfo();

  const detectedLowMemory = true;
  const lowMemory = override === "balanced" ? false : override === "low" ? true : detectedLowMemory;
  const constrainedDevice = !deviceMemory || deviceMemory <= 8;
  const windowsConservative = platform.windows && constrainedDevice;

  return {
    mode: lowMemory ? "low" : "balanced",
    lowMemory,
    deviceMemory,
    cores,
    ...platform,
    lotEditorWidth: lowMemory ? 1600 : 2168,
    previewCacheTarget: lowMemory ? 2 : 12,
    pageCacheTarget: lowMemory ? 2 : 4,
    objectUrlTarget: lowMemory ? 2 : 36,
    preloadNextUnit: !lowMemory,
    pdfIdleReleaseMs: lowMemory ? 4000 : 30000,
    overviewTileTarget: windowsConservative ? 6 : lowMemory ? 10 : 12,
    overviewParallelLoads: windowsConservative ? 1 : lowMemory ? 2 : 3,
    overviewMaxDpr: windowsConservative ? 1 : lowMemory ? 1.1 : 1.25,
  };
}

function sampleRuntimeMemory(profile) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const perfMemory = performance?.memory;
  const mb = (value) => Number.isFinite(value) ? Math.round((value / 1048576) * 10) / 10 : null;
  const current = {
    sampledAt: Date.now(),
    platform: profile.platform,
    windows: profile.windows,
    mac: profile.mac,
    deviceMemoryGb: profile.deviceMemory,
    cores: profile.cores,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    jsHeapUsedMb: mb(perfMemory?.usedJSHeapSize),
    jsHeapTotalMb: mb(perfMemory?.totalJSHeapSize),
    jsHeapLimitMb: mb(perfMemory?.jsHeapSizeLimit),
    domNodes: document.getElementsByTagName("*").length,
    images: document.images.length,
    canvases: document.querySelectorAll("canvas").length,
    overviewTiles: document.querySelectorAll(".pf-overview-raster-tile").length,
    overviewActiveTiles: Number(window.__plotflowOverviewRuntime?.activeTiles || 0),
    overviewPendingTiles: Number(window.__plotflowOverviewRuntime?.pendingTiles || 0),
    overviewLevel: Number(window.__plotflowOverviewRuntime?.currentLevel || 0),
  };

  const previous = window.__plotflowRuntimeMemory || {};
  window.__plotflowRuntimeMemory = {
    current,
    peak: {
      jsHeapUsedMb: Math.max(Number(previous.peak?.jsHeapUsedMb || 0), Number(current.jsHeapUsedMb || 0)),
      domNodes: Math.max(Number(previous.peak?.domNodes || 0), current.domNodes),
      images: Math.max(Number(previous.peak?.images || 0), current.images),
      overviewTiles: Math.max(Number(previous.peak?.overviewTiles || 0), current.overviewTiles),
    },
  };
}

function installRuntimeMemoryMonitor(profile) {
  if (typeof window === "undefined") return;
  if (window.__plotflowRuntimeMemoryTimer) window.clearInterval(window.__plotflowRuntimeMemoryTimer);
  sampleRuntimeMemory(profile);
  window.__plotflowRuntimeMemoryTimer = window.setInterval(() => sampleRuntimeMemory(profile), 15000);
}

export function installMemoryProfile() {
  if (typeof window === "undefined") return getMemoryProfile();
  const profile = getMemoryProfile();
  window.__plotflowMemoryProfile = profile;
  document.documentElement.dataset.plotflowMemory = profile.mode;
  document.documentElement.dataset.plotflowPlatform = profile.windows ? "windows" : profile.mac ? "mac" : "other";
  installRuntimeMemoryMonitor(profile);
  return profile;
}

export function setMemoryMode(mode = "auto") {
  if (typeof window === "undefined") return;
  const value = ["auto", "low", "balanced"].includes(mode) ? mode : "auto";
  try { window.localStorage?.setItem(OVERRIDE_KEY, value); } catch {}
  installMemoryProfile();
}
