import { canUseLegacyProjectStorage } from "./ProjectCloudScope.js";

// The existing editor, masterplan and auxiliary runtimes are VSP-specific.
// A profile flag alone is not sufficient to grant access to legacy data.
export function canMountLegacyWorkspace(project, screen) {
  return screen === "project"
    && canUseLegacyProjectStorage(project?.id)
    && project?.profile?.legacyStorage === true
    && project?.masterplan === true
    && project?.profile?.overview?.configured === true;
}

export function projectRouteId(value) {
  try { return decodeURIComponent(value || ""); } catch { return ""; }
}
