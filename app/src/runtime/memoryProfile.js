const OVERRIDE_KEY = "plotflow-memory-mode";

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
    return { mode: "low", lowMemory: true, deviceMemory: null, cores: null, lotEditorWidth: 1600, previewCacheTarget: 2, objectUrlTarget: 2, preloadNextUnit: false };
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
    objectUrlTarget: lowMemory ? 2 : 36,
    preloadNextUnit: !lowMemory,
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
