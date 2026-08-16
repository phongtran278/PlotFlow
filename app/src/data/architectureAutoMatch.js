function normalizeUnitCode(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const ARCHITECTURE_AUTO_MATCHES = [
  { unitCode: "AS50-08", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.99 },
  { unitCode: "AS80-20", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.99 },
  { unitCode: "AS76-08", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.99 },
  { unitCode: "AS63-19", architectureCode: "CH-13", architectureLabel: "LIỀN KỀ - ĐÔNG ÂU", confidence: 0.99 },
  { unitCode: "AS86-45", architectureCode: "CH-13", architectureLabel: "LIỀN KỀ - ĐÔNG ÂU", confidence: 0.99 },
  { unitCode: "TL32-19", architectureCode: "CH-59", architectureLabel: "LIỀN KỀ - HIỆN ĐẠI NHIỆT ĐỚI", confidence: 0.99 },
  { unitCode: "TL12-05", architectureCode: "CH-15", architectureLabel: "LIỀN KỀ - HÀN QUỐC", confidence: 0.99 },
  { unitCode: "TL7-25", architectureCode: "CH-19", architectureLabel: "LIỀN KỀ - HỘI AN", confidence: 0.99 },
  { unitCode: "TL10-55", architectureCode: "CH-59", architectureLabel: "LIỀN KỀ - XẺ KHE - HIỆN ĐẠI NHIỆT ĐỚI", confidence: 0.99 },
  { unitCode: "TL3-33", architectureCode: "CH-75", architectureLabel: "LIỀN KỀ - HIỆN ĐẠI XANH", confidence: 0.99 },
  { unitCode: "TL5-27", architectureCode: "CH-75", architectureLabel: "LIỀN KỀ - HIỆN ĐẠI XANH", confidence: 0.99 },
  { unitCode: "TL9-41", architectureCode: "CH-59", architectureLabel: "LIỀN KỀ - CĂN GÓC - HIỆN ĐẠI NHIỆT ĐỚI", confidence: 0.99 },
  { unitCode: "TL12-101", architectureCode: "CH-15", architectureLabel: "LIỀN KỀ - HÀN QUỐC", confidence: 0.99 },
  { unitCode: "ĐLCV2-14", architectureCode: "CH-75", architectureLabel: "SONG LẬP - HIỆN ĐẠI XANH", confidence: 0.99 },
];

const ARCHITECTURE_BY_UNIT = new Map(
  ARCHITECTURE_AUTO_MATCHES.map((item) => [normalizeUnitCode(item.unitCode), item])
);

function extractArchitectureCode(value = "") {
  const number = String(value).match(/CH\s*[-_]?\s*(\d+)/i)?.[1];
  return number ? `CH-${number}` : "";
}

export function resolveArchitectureMatch(unit) {
  const autoMatch = ARCHITECTURE_BY_UNIT.get(normalizeUnitCode(unit?.unitCode));
  const manualLabel = String(unit?.architectureLabel || "").trim();
  const manualCode = String(unit?.architectureCode || "").trim();

  if (manualLabel || manualCode) {
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: extractArchitectureCode(manualCode) || extractArchitectureCode(manualLabel) || autoMatch?.architectureCode || "",
      architectureLabel: manualLabel || autoMatch?.architectureLabel || manualCode,
      source: "MANUAL",
      confidence: 1,
      isOverride: true,
    };
  }

  if (!autoMatch) {
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: "",
      architectureLabel: "",
      source: "NONE",
      confidence: 0,
      isOverride: false,
    };
  }

  return {
    ...autoMatch,
    source: "AUTO",
    isOverride: false,
  };
}

function architectureToken(value = "") {
  return normalizeText(value).replace(/^HOUSE_/, "");
}

function scoreHouseCandidate(asset, match, unit) {
  const haystack = architectureToken(`${asset.id} ${asset.name || ""} ${asset.fileName || ""}`);
  const code = architectureToken(match.architectureCode);
  let score = haystack.includes(code) ? 100 : 0;
  const unitShape = normalizeText(`${unit?.type || ""} ${match.architectureLabel || ""}`);

  const wantsSplit = unitShape.includes("XE_KHE") || unitShape.includes("XEKHE");
  const wantsCorner = unitShape.includes("CAN_GOC") || unitShape.includes("GOC");
  const wantsSemiDetached = unitShape.includes("SONG_LAP") || unitShape.includes("SONGLAP");
  const hasSplit = haystack.includes("XE_KHE") || haystack.includes("XEKHE");
  const hasCorner = haystack.includes("CAN_GOC") || haystack.includes("GOC");
  const hasSemiDetached = haystack.includes("SONG_LAP") || haystack.includes("SONGLAP") || haystack.includes("BT_");

  if (wantsSplit === hasSplit) score += 18;
  else if (wantsSplit) score -= 16;
  else if (hasSplit) score -= 6;

  if (wantsCorner && hasCorner) score += 12;
  if (wantsSemiDetached && hasSemiDetached) score += 12;
  if (!wantsSemiDetached && hasSemiDetached) score -= 8;

  return score;
}

export function resolveArchitectureHouseAsset(unit, houseCatalog = []) {
  const match = resolveArchitectureMatch(unit);
  if (!match.architectureCode) {
    return { ...match, asset: null, assetStatus: "NONE", suggestedHouseModel: "" };
  }

  const codeToken = architectureToken(match.architectureCode);
  const candidates = houseCatalog.filter((asset) =>
    architectureToken(`${asset.id} ${asset.name || ""} ${asset.fileName || ""}`).includes(codeToken)
  );

  if (!candidates.length) {
    return {
      ...match,
      asset: null,
      assetStatus: "MISSING",
      suggestedHouseModel: `HOUSE_${codeToken}`,
    };
  }

  const ranked = candidates
    .map((asset) => ({ asset, score: scoreHouseCandidate(asset, match, unit) }))
    .sort((a, b) => b.score - a.score);
  const asset = ranked[0].asset;

  return {
    ...match,
    asset,
    assetStatus: "FOUND",
    suggestedHouseModel: asset.id,
  };
}

export function withResolvedArchitecture(unit) {
  const match = resolveArchitectureMatch(unit);
  if (!unit || match.source === "NONE") return unit;
  return {
    ...unit,
    architectureCode: unit.architectureCode || match.architectureCode,
    architectureLabel: unit.architectureLabel || match.architectureLabel,
    architectureSource: unit.architectureSource || match.source,
    architectureConfidence: unit.architectureConfidence || match.confidence,
  };
}

export function architectureExportRows(houseCatalog = []) {
  return ARCHITECTURE_AUTO_MATCHES.map((item) => {
    const resolved = resolveArchitectureHouseAsset(item, houseCatalog);
    return {
      unitCode: item.unitCode,
      architectureCode: item.architectureCode,
      architectureLabel: item.architectureLabel,
      houseModel: resolved.asset?.id || "",
      houseAssetStatus: resolved.assetStatus,
      architectureSource: "AUTO",
      architectureConfidence: item.confidence,
    };
  });
}
