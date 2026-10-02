import { useEffect } from "react";

const STORAGE_KEY = "plotflow-overview-sell-units-v1";

function normKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function pick(row, aliases = []) {
  const keys = Object.keys(row || {});
  const wanted = new Set(aliases.map(normKey));
  for (const key of keys) {
    if (wanted.has(normKey(key))) return row[key];
  }
  return "";
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeRow(row) {
  const code = text(pick(row, ["unitCode", "Mã lô", "Mã căn", "Mã sản phẩm", "Mã SP", "Mã"]));
  if (!code) return null;
  return {
    code,
    handover: text(pick(row, ["handover", "TCBG", "Tiêu chuẩn bàn giao", "Tiêu chuẩn giao nhà", "TC bàn giao", "Tiêu chuẩn BG"])),
    land: text(pick(row, ["landArea", "Diện tích đất", "DT đất", "DTĐ", "DTD"])),
    floor: text(pick(row, ["constructionArea", "Diện tích sàn", "DT sàn", "DTS", "Diện tích xây dựng", "DTXD"])),
    type: text(pick(row, ["type", "Loại hình", "Loại sản phẩm", "Loại nhà"])),
    priceLandVat: text(pick(row, [
      "priceLandVat",
      "Giá đất & GT TM (đã VAT)",
      "Giá đất & GT TM đã VAT",
      "Giá đất và GT TM đã VAT",
      "Giá đất & GT TM",
      "Giá đất + GT TM",
      "Giá đất",
      "priceEarly",
    ])),
    priceAllIn: text(pick(row, [
      "priceAllIn",
      "Giá All-in",
      "Giá All In",
      "GIÁ ALL-IN",
      "ALL-IN",
      "All in",
      "price18",
    ])),
  };
}

function publish(units) {
  const clean = (units || []).filter(Boolean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  window.__plotflowOverviewSellUnits = clean;
  const groups = Array.from(new Set(clean.map((unit) => unit.handover).filter(Boolean)));
  window.dispatchEvent(new CustomEvent("plotflow-overview-sell-units", { detail: { units: clean, groups } }));
}

async function rowsFromWorkbookInput(input, type) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(input, { type });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map(normalizeRow).filter(Boolean);
}

function looksLikeSheetCsv(url = "") {
  const value = String(url || "");
  return /spreadsheets\/d\//i.test(value) && /(format=csv|output=csv|export\?)/i.test(value);
}

export function readOverviewSellUnits() {
  if (Array.isArray(window.__plotflowOverviewSellUnits)) return window.__plotflowOverviewSellUnits;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function OverviewSellDataRuntime() {
  useEffect(() => {
    const saved = readOverviewSellUnits();
    if (saved.length) {
      window.__plotflowOverviewSellUnits = saved;
      queueMicrotask(() => publish(saved));
    }

    const originalFetch = window.fetch.bind(window);
    let disposed = false;

    async function wrappedFetch(input, init) {
      const response = await originalFetch(input, init);
      const url = typeof input === "string" ? input : input?.url || response.url || "";
      if (looksLikeSheetCsv(url)) {
        response.clone().text().then((csv) => rowsFromWorkbookInput(csv, "string")).then((units) => {
          if (!disposed && units.length) publish(units);
        }).catch((error) => console.warn("Overview sell sheet capture failed", error));
      }
      return response;
    }

    async function onFileChange(event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      if (!input.closest?.(".excel-import-button")) return;
      const file = input.files?.[0];
      if (!file || !/\.(xlsx|xls)$/i.test(file.name)) return;
      try {
        const units = await rowsFromWorkbookInput(await file.arrayBuffer(), "array");
        if (!disposed && units.length) publish(units);
      } catch (error) {
        console.warn("Overview sell Excel capture failed", error);
      }
    }

    window.fetch = wrappedFetch;
    document.addEventListener("change", onFileChange, true);
    return () => {
      disposed = true;
      document.removeEventListener("change", onFileChange, true);
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
