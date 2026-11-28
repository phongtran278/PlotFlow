import { canUseLegacyProjectStorage, isProjectCloudKey, validateCloudSnapshot, mergeProjectCloudStorage } from "./ProjectCloudScope.js";

const CLOUD_STATE_URL = import.meta.env.VITE_PROJECT_STATE_URL || "";
const CLOUD_PROJECT_ID = import.meta.env.VITE_CLOUD_PROJECT_ID || "vinhomes-saigon-park";
const STATE_API_BASE_URL = (import.meta.env.VITE_STATE_API_BASE_URL || "").replace(/\/$/, "");
// The dedicated Cloudflare staging UI may only use the stable staging API.
const STAGING_UI_ORIGIN = "https://plotflow-ui-staging.phongtran7076.workers.dev";
const STAGING_API_ORIGIN = "https://plotflow-state-api-staging.phongtran7076.workers.dev";
const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
const cloudflareHost = typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev");
const stagingHost = browserOrigin === STAGING_UI_ORIGIN;
const stagingBuild = import.meta.env.VITE_PLOTFLOW_PRIVATE_STAGING === "1";
const API_MODE = Boolean(STATE_API_BASE_URL) && (!stagingBuild && !cloudflareHost || stagingHost && STATE_API_BASE_URL === STAGING_API_ORIGIN && !CLOUD_STATE_URL);
const LEGACY_ENABLED = Boolean(CLOUD_STATE_URL) && !cloudflareHost && !stagingBuild;
const STATE_API_URL = API_MODE ? `${STATE_API_BASE_URL}/v1/projects/${encodeURIComponent(CLOUD_PROJECT_ID)}/state` : "";
const SAVE_DELAY_MS = 900;



let saveTimer = 0;
let saving = false;
let saveAgain = false;
let suspendTracking = false;
let installed = false;
let remoteEtag = null;
let remoteStorage = {};
let writeBlocked = false;
let bootstrapComplete = false;
// Only expose bounded, non-sensitive diagnostic codes, never response bodies or URLs.
function cloudLoadFailure(code) {
  return Object.assign(new Error("Cloud state load failed: " + code), { cloudDiagnostic: code });
}
function notifyState(status, diagnostic = null) {
  if (typeof window !== "undefined") {
    window.__plotflowCloudStateStatus = { status, diagnostic, transport: (API_MODE || stagingBuild) ? "state-api" : "legacy" };
    window.dispatchEvent(new CustomEvent("plotflow-cloud-state-status", {
      detail: { status, diagnostic, projectId: CLOUD_PROJECT_ID, transport: (API_MODE || stagingBuild) ? "state-api" : "legacy" },
    }));
  }
}
function normalizeEtag(raw) {
  const value = String(raw || "");
  return /^"[^"\r\n]+"$/.test(value) ? value : null;
}

function shouldShareKey(key = "") {
  return isProjectCloudKey(CLOUD_PROJECT_ID, key);
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
  if (!API_MODE && !LEGACY_ENABLED) return null;
  let response;
  try {
    response = await fetch(API_MODE ? STATE_API_URL : CLOUD_STATE_URL, {
      method: "GET", cache: "no-store", credentials: API_MODE ? "include" : "same-origin",
      ...(API_MODE ? { redirect: "error", signal: AbortSignal.timeout(15000) } : {}),
    });
  } catch (error) {
    if (!API_MODE) throw error;
    throw cloudLoadFailure(error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "timeout" : "network_or_access");
  }
  if (!API_MODE && response.status === 404) throw new Error("Cloud snapshot missing; manual recovery required");
  if (!response.ok) {
    if (!API_MODE) throw new Error(`Cloud state GET failed (${response.status})`);
    const codes = { 401: "authentication_required", 403: "access_denied", 404: "endpoint_not_found",
      502: "storage_unavailable", 503: "service_unavailable" };
    throw cloudLoadFailure(codes[response.status] || "http_error");
  }
  let value;
  try {
    value = validateCloudSnapshot(await response.json(), CLOUD_PROJECT_ID);
  } catch (error) {
    if (!API_MODE) throw error;
    throw cloudLoadFailure("invalid_snapshot");
  }
  if (API_MODE) {
    const etag = normalizeEtag(response.headers.get("x-plotflow-state-etag"));
    if (!etag) throw cloudLoadFailure("missing_read_version");
    remoteEtag = etag;
  }
  remoteStorage = { ...value.storage };
  return value;
}

async function writeCloudState() {
  if ((!API_MODE && !LEGACY_ENABLED) || !bootstrapComplete || writeBlocked) return false;
  if (API_MODE && !remoteEtag) return false;
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
      storage: mergeProjectCloudStorage(CLOUD_PROJECT_ID, remoteStorage, collectStorage()),
    };
    const response = await fetch(API_MODE ? STATE_API_URL : CLOUD_STATE_URL, {
      method: "PUT",
      credentials: API_MODE ? "include" : "same-origin",
      headers: API_MODE ? {
        "Content-Type": "application/json; charset=utf-8",
        "If-Match": remoteEtag,
      } : {
        "Content-Type": "application/json; charset=utf-8",
        "x-ms-blob-type": "BlockBlob",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      ...(API_MODE ? { redirect: "error", signal: AbortSignal.timeout(15000) } : {}),
    });
    if (API_MODE && response.status === 412) {
      writeBlocked = true;
      notifyState("version_conflict");
      return false;
    }
    if (!response.ok) throw new Error(`Cloud state PUT failed (${response.status})`);
    if (API_MODE) {
      const nextEtag = normalizeEtag(response.headers.get("x-plotflow-state-etag") || response.headers.get("etag"));
      if (!nextEtag) {
        writeBlocked = true;
        notifyState("missing_write_version");
        return false;
      }
      remoteEtag = nextEtag;
    }
    remoteStorage = payload.storage;
    if (API_MODE && !writeBlocked) notifyState("saved");
    window.dispatchEvent(new CustomEvent("plotflow-cloud-state-saved", {
      detail: { projectId: CLOUD_PROJECT_ID, updatedAt: payload.updatedAt },
    }));
    return true;
  } catch (error) {
    if (API_MODE) { writeBlocked = true; notifyState("save_error"); }
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
  if ((!API_MODE && !LEGACY_ENABLED) || suspendTracking || !bootstrapComplete || writeBlocked) return;
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

  // Same-origin tabs share localStorage. Stop automatic writes when another
  // tab changes a tracked key; ETag alone cannot isolate that shared cache.
  if (API_MODE && stagingHost) window.addEventListener("storage", (event) => {
    if (event.storageArea !== window.localStorage || (event.key !== null && !shouldShareKey(event.key))) return;
    writeBlocked = true;
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    notifyState("version_conflict");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      void writeCloudState();
    }
  });
}

export async function bootstrapCloudProjectState() {
  if (!API_MODE && stagingBuild && stagingHost) { writeBlocked = true; notifyState("load_error", "transport_config"); }
  if ((!API_MODE && !LEGACY_ENABLED) || typeof window === "undefined" || new URLSearchParams(window.location.search).get("design-system") === "1") {
    installStorageTracking();
    return { enabled: false, projectId: CLOUD_PROJECT_ID };
  }

  if (!API_MODE && !canUseLegacyProjectStorage(CLOUD_PROJECT_ID)) {
    writeBlocked = true;
    notifyState("manual_migration_required");
    return { enabled: false, projectId: CLOUD_PROJECT_ID, transport: "legacy" };
  }

  try {
    const cloud = await readCloudState();
    const cloudStorage = cloud.storage;
    const scoped = Object.fromEntries(Object.entries(cloudStorage).filter(([key]) => shouldShareKey(key)));
    if (Object.keys(scoped).length > 0) {
      const local = collectStorage();
      const differs = Object.keys(local).length > 0 &&
        (Object.keys(local).length !== Object.keys(scoped).length ||
          Object.entries(local).some(([key, value]) => scoped[key] !== value));
      if (API_MODE && stagingHost && differs) {
        writeBlocked = true;
        notifyState("manual_migration_required");
      } else {
        applyStorage(scoped);
        console.info(`[PlotFlow] cloud project restored: ${CLOUD_PROJECT_ID}`);
      }
    } else if (Object.keys(collectStorage()).length > 0) {
      // Never auto-publish a local cache into an empty or foreign-key snapshot.
      writeBlocked = true;
      notifyState("manual_migration_required");
    }
  } catch (error) {
    writeBlocked = true;
    notifyState("load_error", API_MODE ? error?.cloudDiagnostic || "unknown" : null);
    console.warn("[PlotFlow] cloud state unavailable; using local cache:", error);
  }

  bootstrapComplete = true;
  installStorageTracking();
  return { enabled: true, projectId: CLOUD_PROJECT_ID, transport: (API_MODE || stagingBuild) ? "state-api" : "legacy" };
}

export function flushCloudProjectState() {
  return writeCloudState();
}
