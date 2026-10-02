const MIGRATION_KEY = "phongflow-overview-v2-anchor-migrated-1";
const OLD_ANCHOR_KEY = "phongflow-overview-anchor-layout-v2";

try {
  if (typeof window !== "undefined" && window.localStorage.getItem(MIGRATION_KEY) !== "1") {
    window.localStorage.removeItem(OLD_ANCHOR_KEY);
    window.localStorage.setItem(MIGRATION_KEY, "1");
  }
} catch {
  // Storage can be unavailable in restrictive browser modes. The locator still works without migration.
}
