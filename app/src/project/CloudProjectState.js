const CLOUD_STATE_URL = import.meta.env.VITE_PROJECT_STATE_URL || "";
const CLOUD_PROJECT_ID = import.meta.env.VITE_CLOUD_PROJECT_ID || "vinhomes-saigon-park";
const SAVE_DELAY_MS = 900;

const EXACT_SHARED_KEYS = new Set([
  "plotflow-design-assignments-r1",
  "plotflow-lot-overlays-r1-v9",
  "plotflow-floorplan-overrides-v6",
  "plotflow-manual-floorplans-v1",
  "plotflow-unit-pin-layouts-v1",
  "plotflow-campaign-badges-by-unit-v2",
  "plotflow-quick-text-overrides-v1",
  "plotflow-policy-images-r2",
  "plotflow-layout-round1-v9",
  "plotflow-grid-round1-v9",
  "plotflow-overview-precision-arrange-v3",
  "plotflow-overview-group-style-v1",
  "plotflow-sheet-history-r1",
  "phongflow-overview-card-layout-v2",
  "phongflow-overview-anchor-layout-v2",
  "phongflow-overview-pen-shapes-v1",
  "phongflow-overview-pen-style-v4",
]);

let saveTimer = 0;
let saving = false;
let saveAgain = false;
let suspendTracking = false;
let installed = false;

function shouldShareKey(key = "") {
  const text = String(key || "");
  if (!text) return false;
  if (EXACT_SHARED_KEYS.has(text)) return true;
  if (text.startsWith(`plotflow:${CLOUD_PROJECT_ID}:`)) return true;
  return false;
}

function collectStorage() {
  const storage = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!shouldShareKey(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) storage[key] = value;
    }
  } catch {
    // Local cache is optional; cloud sync must never block the app.
  }
  return storage;
}

function applyStorage(snapshot = {}) {
  suspendTracking = true;
  try {
    const currentKeys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (shouldShareKey(key)) currentKeys.push(key);
    }
    currentKeys.forEach((key) => window.localStorage.removeItem(key));
    Object.entries(snapshot).forEach(([key, value]) => {
      if (shouldShareKey(key) && typeof value === "string") window.localStorage.setItem(key, value);
    });
  } catch {
    // Keep whatever local data is available when storage is restricted.
  } finally {
    suspendTracking = false;
  }
}

async function readCloudState() {
  if (!CLOUD_STATE_URL) return null;
  const response = await fetch(CLOUD_STATE_URL, { method: "GET", cache: "no-store" });
  if (response.status === 404) return { version: 1, projectId: CLOUD_PROJECT_ID, storage: {} };
  if (!response.ok) throw new Error(`Cloud state GET failed (${response.status})`);
  const value = await response.json();
  return value && typeof value === "object" ? value : null;
}

async function writeCloudState() {
  if (!CLOUD_STATE_URL) return false;
  if (saving) {
    saveAgain = true;
    return false;
  }

  saving = true;
  try {
    const payload = {
      version: 1,
      projectId: CLOUD_PROJECT_ID,
      updatedAt: new Date().toISOString(),
      storage: collectStorage(),
    };
    const response = await fetch(CLOUD_STATE_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ms-blob-type": "BlockBlob",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Cloud state PUT failed (${response.status})`);
    window.dispatchEvent(new CustomEvent("plotflow-cloud-state-saved", {
      detail: { projectId: CLOUD_PROJECT_ID, updatedAt: payload.updatedAt },
    }));
    return true;
  } catch (error) {
    console.warn("[PlotFlow] cloud state save skipped:", error);
    return false;
  } finally {
    saving = false;
    if (saveAgain) {
      saveAgain = false;
      scheduleCloudSave(250);
    }
  }
}

function scheduleCloudSave(delay = SAVE_DELAY_MS) {
  if (!CLOUD_STATE_URL || suspendTracking) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    void writeCloudState();
  }, delay);
}

function installStorageTracking() {
  if (installed || typeof Storage === "undefined") return;
  installed = true;

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;

  Storage.prototype.setItem = function plotflowCloudSetItem(key, value) {
    nativeSetItem.call(this, key, value);
    if (this === window.localStorage && shouldShareKey(key)) scheduleCloudSave();
  };

  Storage.prototype.removeItem = function plotflowCloudRemoveItem(key) {
    nativeRemoveItem.call(this, key);
    if (this === window.localStorage && shouldShareKey(key)) scheduleCloudSave();
  };

  Storage.prototype.clear = function plotflowCloudClear() {
    const hadSharedData = this === window.localStorage && Object.keys(collectStorage()).length > 0;
    nativeClear.call(this);
    if (hadSharedData) scheduleCloudSave();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      void writeCloudState();
    }
  });
}

export async function bootstrapCloudProjectState() {
  if (!CLOUD_STATE_URL || typeof window === "undefined" || new URLSearchParams(window.location.search).get("design-system") === "1") {
    installStorageTracking();
    return { enabled: false, projectId: CLOUD_PROJECT_ID };
  }

  try {
    const cloud = await readCloudState();
    const cloudStorage = cloud?.projectId === CLOUD_PROJECT_ID && cloud?.storage && typeof cloud.storage === "object"
      ? cloud.storage
      : {};

    if (Object.keys(cloudStorage).length > 0) {
      applyStorage(cloudStorage);
      console.info(`[PlotFlow] cloud project restored: ${CLOUD_PROJECT_ID}`);
    } else if (Object.keys(collectStorage()).length > 0) {
      await writeCloudState();
      console.info(`[PlotFlow] local project migrated to cloud: ${CLOUD_PROJECT_ID}`);
    }
  } catch (error) {
    console.warn("[PlotFlow] cloud state unavailable; using local cache:", error);
  }

  installStorageTracking();
  return { enabled: true, projectId: CLOUD_PROJECT_ID };
}

export function flushCloudProjectState() {
  return writeCloudState();
}
