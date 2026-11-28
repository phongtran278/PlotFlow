import { normalizeRow as normalizeSalesRow } from "./unitImport.js";

function normKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function pick(row, aliases = []) {
  const columns = Object.keys(row || {}).map(key => ({ key, normalized: normKey(key) }));
  for (const alias of aliases) {
    const name = normKey(alias);
    const column = columns.find(item => item.normalized === name);
    if (column) return row[column.key];
  }
  return "";
}

function text(value) {
  return String(value ?? "").trim();
}

export function normalizeOverviewRow(row) {
  const sales = normalizeSalesRow(row);
  const code = sales.unitCode || text(pick(row, ["unitCode", "Mã lô", "Mã căn", "Mã sản phẩm", "Mã SP", "Mã"]));
  if (!code) return null;
  return {
    code,
    handover: sales.handover || text(pick(row, ["handover", "TCBG", "Tiêu chuẩn bàn giao", "Tiêu chuẩn giao nhà", "TC bàn giao", "Tiêu chuẩn BG"])),
    land: text(sales.landArea) || text(pick(row, ["landArea", "Diện tích đất", "DT đất", "DTĐ", "DTD"])),
    floor: text(sales.constructionArea) || text(pick(row, ["constructionArea", "Diện tích sàn", "DT sàn", "DTS", "Diện tích xây dựng", "DTXD"])),
    type: sales.type || text(pick(row, ["type", "Loại hình", "Loại sản phẩm", "Loại nhà"])),
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

// Both screens project the same accepted source row. Keep explicit Overview
// prices alongside the Detail fields rather than inferring one from the other.
export function normalizeProjectSalesRow(row) {
  const detail = normalizeSalesRow(row);
  const overview = normalizeOverviewRow(row);
  if (!overview) return detail;
  return {
    ...detail,
    unitCode: overview.code,
    landArea: detail.landArea === "" ? overview.land : detail.landArea,
    constructionArea: detail.constructionArea === "" ? overview.floor : detail.constructionArea,
    type: overview.type,
    handover: overview.handover,
    overview,
  };
}
