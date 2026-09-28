export const PRICE_STYLE_STORAGE_KEY = "plotflow-price-design-v1";

export const DEFAULT_PRICE_STYLE = {
  background: "#f7efe7",
  labelColor: "#292725",
  valueColor: "#bd1530",
  suffixColor: "#bd1530",
  labelSize: 10.2,
  valueSize: 42,
  suffixSize: 16,
  labelWeight: 850,
  valueWeight: 850,
  suffixWeight: 850,
  radius: 7,
  gap: 6,
  align: "center",
};

export function normalizePriceUnitCode(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(PRICE_STYLE_STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeStore(value, detail = {}) {
  localStorage.setItem(PRICE_STYLE_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("plotflow-price-style-updated", { detail }));
}

export function readPriceStyle(unitCode) {
  const store = readStore();
  const code = normalizePriceUnitCode(unitCode);
  return {
    ...DEFAULT_PRICE_STYLE,
    ...(store.global || {}),
    ...(code ? store.units?.[code] || {} : {}),
  };
}

export function savePriceStyleForUnit(unitCode, style) {
  const code = normalizePriceUnitCode(unitCode);
  if (!code) return;
  const store = readStore();
  const units = { ...(store.units || {}), [code]: { ...style } };
  writeStore({ ...store, units }, { scope: "unit", unitCode: code });
}

export function applyPriceStyleToAll(style) {
  const store = readStore();
  writeStore({ ...store, global: { ...style }, units: {} }, { scope: "all" });
}

export function resetPriceStyleForUnit(unitCode) {
  const code = normalizePriceUnitCode(unitCode);
  if (!code) return;
  const store = readStore();
  const units = { ...(store.units || {}) };
  delete units[code];
  writeStore({ ...store, units }, { scope: "unit-reset", unitCode: code });
}

export function resetAllPriceStyles() {
  writeStore({}, { scope: "reset-all" });
}
