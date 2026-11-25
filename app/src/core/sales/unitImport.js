export function normalizeRow(row) {
  return {
    unitCode: String(row.unitCode ?? row.MA_CAN ?? row["MÃ CĂN"] ?? row["Mã căn"] ?? "").trim(),
    type: String(row.type ?? row.LOAI_HINH_SAN_PHAM ?? row["LOẠI HÌNH SẢN PHẨM"] ?? row["Loại hình sản phẩm"] ?? "").trim(),
    floors: row.floors ?? row.SO_TANG ?? row["SỐ TẦNG"] ?? "",
    handover: String(row.handover ?? row.TIEU_CHUAN_BAN_GIAO ?? row["TIÊU CHUẨN BÀN GIAO"] ?? "").trim(),
    landArea: row.landArea ?? row.DT_DAT_M2 ?? row["DT ĐẤT M2"] ?? "",
    constructionArea: row.constructionArea ?? row.DTXD_M2 ?? row["DTXD M2"] ?? "",
    roadWidth: row.roadWidth ?? row.LO_GIOI ?? row["LỘ GIỚI"] ?? "",
    priceStandard: row.priceStandard ?? row.TIEN_DO_CHUAN ?? row["TIẾN ĐỘ CHUẨN"] ?? row["Giá TT chuẩn"] ?? row["GIÁ TT CHUẨN"] ?? "",
    priceEarly: row.priceEarly ?? row.TIEN_DO_SOM ?? row["TIẾN ĐỘ SỚM"] ?? row["Giá TT sớm"] ?? row["GIÁ TT SỚM"] ?? "",
    price18: row.price18 ?? row.VAY_70_18T ?? "",
    price24: row.price24 ?? row.VAY_70_24T ?? "",
    price30: row.price30 ?? row.VAY_70_30T ?? row.price36 ?? row.VAY_70_36T ?? row["Giá 36TH"] ?? row["GIÁ 36TH"] ?? "",
    price36: row.price36 ?? row.VAY_70_36T ?? row.price30 ?? row.VAY_70_30T ?? row["Giá 36TH"] ?? row["GIÁ 36TH"] ?? "",
    houseModel: String(row.houseModel ?? row.houseName ?? row["Mẫu nhà"] ?? row["MÃ MẪU NHÀ"] ?? row["Mã mẫu nhà"] ?? "").trim(),
    floorplan: String(row.floorplan ?? "").trim(),
    amenity1: String(row.amenity1 ?? "").trim(),
    amenity2: String(row.amenity2 ?? "").trim(),
    architectureCode: String(
      row.architectureCode ??
      row.archCode ??
      row["Mã kiến trúc"] ??
      row["MÃ KIẾN TRÚC"] ??
      row["Mã mẫu nhà"] ??
      row["MÃ MẪU NHÀ"] ??
      ""
    ).trim(),
    architectureLabel: String(
      row.architectureLabel ??
      row.architectureName ??
      row.houseLabel ??
      row.tenKienTruc ??
      row["Kiến trúc"] ??
      row["KIẾN TRÚC"] ??
      row["Tên kiến trúc"] ??
      row["TÊN KIẾN TRÚC"] ??
      row.tenMauNha ??
      row["Tên mẫu nhà"] ??
      row["TÊN MẪU NHÀ"] ??
      row.architecture ??
      ""
    ).trim(),
    logoVariant: String(row.logoVariant ?? row.logo ?? "").trim(),
    showHotDeal: String(row.showHotDeal ?? row.hotDeal ?? "").trim(),
    showEarlyMoveIn: String(row.showEarlyMoveIn ?? row.earlyMoveIn ?? row.veOSom ?? "").trim(),
  };
}

export async function parseCSV(text) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(text, { type: "string" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map(normalizeRow).filter((unit) => unit.unitCode);
}

export function parseWorkbookUnits(workbook, XLSX) {
  const orderedNames = [
    ...workbook.SheetNames.filter((name) => String(name).trim().toUpperCase() === "UNITS"),
    ...workbook.SheetNames.filter((name) => String(name).trim().toUpperCase() !== "UNITS"),
  ];
  let best = { units: [], sheetName: "" };
  for (const sheetName of orderedNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
    const units = rows.map(normalizeRow).filter((unit) => unit.unitCode);
    if (units.length > best.units.length) best = { units, sheetName };
    if (String(sheetName).trim().toUpperCase() === "UNITS" && units.length) return { units, sheetName };
  }
  return best;
}

export function getGoogleSheetCSVUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Bạn chưa nhập link Google Sheet.");
  if (trimmed.includes("output=csv") || trimmed.includes("format=csv")) return trimmed;
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("Link Google Sheet không hợp lệ.");
  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gidMatch ? gidMatch[1] : "0"}`;
}

