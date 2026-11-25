export const PROJECT_PROFILE_SCHEMA_VERSION = 1;

const DEFAULT_PROFILE = {
  schemaVersion: PROJECT_PROFILE_SCHEMA_VERSION,
  legacyStorage: false,
  topology: { kind: "unspecified", hierarchy: [] },
  sales: { schema: "project-sales-v1", fieldMap: {} },
  overview: { configured: false, groups: [], rasterSource: null },
  detail: { template: "sales-poster-v1" },
  locator: { codeRules: {} },
  assets: { roles: [], catalogId: null, masterplanPdf: null, preparedManifest: null, pageTilesBase: null, housesBase: null, amenitiesBase: null, brandingBase: null },
};

function mergeObject(base, value) {
  return { ...base, ...(value || {}) };
}

// Profiles are JSON data. Never share mutable nested defaults between projects.
export function cloneProjectConfig(value) {
  return structuredClone(value);
}

export function createProjectProfile(value = {}) {
  return cloneProjectConfig({
    ...DEFAULT_PROFILE,
    ...value,
    schemaVersion: PROJECT_PROFILE_SCHEMA_VERSION,
    topology: mergeObject(DEFAULT_PROFILE.topology, value.topology),
    sales: mergeObject(DEFAULT_PROFILE.sales, value.sales),
    overview: mergeObject(DEFAULT_PROFILE.overview, value.overview),
    detail: mergeObject(DEFAULT_PROFILE.detail, value.detail),
    locator: mergeObject(DEFAULT_PROFILE.locator, value.locator),
    assets: mergeObject(DEFAULT_PROFILE.assets, value.assets),
  });
}

export function projectOverviewGroups(profile) {
  return Array.isArray(profile?.overview?.groups)
    ? [...new Set(profile.overview.groups.filter(group => typeof group === "string" && group.trim()).map(group => group.trim()))]
    : [];
}
