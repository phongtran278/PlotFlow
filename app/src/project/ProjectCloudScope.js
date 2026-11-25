export const LEGACY_PROJECT_ID = "vinhomes-saigon-park";
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

export function canUseLegacyProjectStorage(projectId) {
  return projectId === LEGACY_PROJECT_ID;
}

export function isProjectCloudKey(projectId, key) {
  if (typeof projectId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId) || typeof key !== "string" || !key) return false;
  return key.startsWith(`plotflow:${projectId}:`) || (canUseLegacyProjectStorage(projectId) && EXACT_SHARED_KEYS.has(key));
}

export function validateCloudSnapshot(value, projectId) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || value.version !== 1 || value.projectId !== projectId
      || !value.storage || typeof value.storage !== "object" || Array.isArray(value.storage)
      || !Object.values(value.storage).every(v => typeof v === "string")) {
    throw new Error("Cloud snapshot schema or project mismatch");
  }
  return value;
}

// Unknown keys are preserved from the remote snapshot, but never imported into
// local storage by a different project. The caller supplies only scoped keys.
export function mergeProjectCloudStorage(projectId, remote, local) {
  return {
    ...Object.fromEntries(Object.entries(remote).filter(([key]) => !isProjectCloudKey(projectId,key))),
    ...Object.fromEntries(Object.entries(local).filter(([key,value]) => isProjectCloudKey(projectId,key) && typeof value === "string")),
  };
}
