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
    return { mode: "balanced", lowMemory: false, deviceMemory: null, cores: null };
  }

  const override = readOverride();
  const deviceMemory = numberOrNull(navigator.deviceMemory);
  const cores = numberOrNull(navigator.hardwareConcurrency);

  const detectedLowMemory = (deviceMemory != null && deviceMemory <= 4)
    || (cores != null && cores <= 4);
  const lowMemory = override === "low" ? true : override === "balanced" ? false : detectedLowMemory;

  return {
    mode: lowMemory ? "low" : "balanced",
    lowMemory,
    deviceMemory,
    cores,
    lotEditorWidth: lowMemory ? 1600 : 2168,
    previewCacheTarget: lowMemory ? 4 : 12,
    objectUrlTarget: lowMemory ? 10 : 36,
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
