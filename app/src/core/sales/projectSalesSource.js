// A browser cache of imported rows. Sheet history continues to use project
// storage for recovery on a new device. Sales rows never enter cloud design state.
const CACHE_PREFIX = "plotflow-sales-source-v1:";
export const SALES_EVENT = "plotflow-overview-sell-units";

const empty = () => ({ active: null, sheet: null, excel: null });

export function readSalesSource(projectId) {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_PREFIX + projectId) || "null");
    if (saved && [null, "sheet", "excel"].includes(saved.active)) return saved;
  } catch { /* a corrupt or unavailable cache can be reconnected */ }
  return empty();
}

export function isSalesSourceInitialized(projectId) {
  try { return localStorage.getItem(CACHE_PREFIX + projectId) !== null; }
  catch { return false; }
}

export function writeSalesSource(projectId, source) {
  try { localStorage.setItem(CACHE_PREFIX + projectId, JSON.stringify(source)); }
  catch { return false; }
  return true;
}

export function activeSalesDataset(source) {
  return source[source.active] || null;
}

export function disconnectSalesSheet(source) {
  return { ...source, sheet: null, active: source.excel ? "excel" : null };
}

export function overviewSalesUnits(source) {
  return (activeSalesDataset(source)?.units || []).map(unit => unit.overview).filter(Boolean);
}
