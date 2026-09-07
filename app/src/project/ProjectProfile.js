export const PROJECT_PROFILE_SCHEMA_VERSION = 1;

const DEFAULT_PROFILE = {
  schemaVersion: PROJECT_PROFILE_SCHEMA_VERSION,
  legacyStorage: false,
  topology: { kind: "unspecified", hierarchy: [] },
  sales: { schema: "project-sales-v1", fieldMap: {} },
  overview: { groups: [] },
  detail: { template: "sales-poster-v1" },
  locator: { codeRules: {} },
  assets: { roles: [] },
};

function mergeObject(base, value) {
  return { ...base, ...(value || {}) };
}

export function createProjectProfile(value = {}) {
  return {
    ...DEFAULT_PROFILE,
    ...value,
    schemaVersion: PROJECT_PROFILE_SCHEMA_VERSION,
    topology: mergeObject(DEFAULT_PROFILE.topology, value.topology),
    sales: mergeObject(DEFAULT_PROFILE.sales, value.sales),
    overview: mergeObject(DEFAULT_PROFILE.overview, value.overview),
    detail: mergeObject(DEFAULT_PROFILE.detail, value.detail),
    locator: mergeObject(DEFAULT_PROFILE.locator, value.locator),
    assets: mergeObject(DEFAULT_PROFILE.assets, value.assets),
  };
}
