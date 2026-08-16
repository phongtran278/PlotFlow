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

function architectureNumber(value = "") {
  return String(value).match(/CH\s*[-_ ]?\s*(\d+)/i)?.[1] || "";
}

function extractArchitectureCode(value = "") {
  const number = architectureNumber(value);
  return number ? `CH-${number}` : "";
}

export function resolveArchitectureMatch(unit) {
  const autoMatch = ARCHITECTURE_BY_UNIT.get(normalizeUnitCode(unit?.unitCode));
  const storedLabel = String(unit?.architectureLabel || "").trim();
  const storedCode = String(unit?.architectureCode || "").trim();
  const sameAsAuto = Boolean(
    autoMatch && storedLabel && normalizeText(storedLabel) === normalizeText(autoMatch.architectureLabel)
  );

  if ((storedLabel || storedCode) && !sameAsAuto) {
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: extractArchitectureCode(storedCode) || extractArchitectureCode(storedLabel) || autoMatch?.architectureCode || "",
      architectureLabel: storedLabel || autoMatch?.architectureLabel || storedCode,
      source: "MANUAL",
      confidence: 1,
      isOverride: true,
    };
  }

  if (autoMatch) {
    return {
      ...autoMatch,
      architectureLabel: storedLabel || autoMatch.architectureLabel,
      architectureCode: extractArchitectureCode(storedCode) || autoMatch.architectureCode,
      source: "AUTO",
      isOverride: false,
    };
  }

  if (storedLabel || storedCode) {
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: extractArchitectureCode(storedCode) || extractArchitectureCode(storedLabel),
      architectureLabel: storedLabel || storedCode,
      source: "MANUAL",
      confidence: 1,
      isOverride: true,
    };
  }

  return {
    unitCode: unit?.unitCode || "",
    architectureCode: "",
    architectureLabel: "",
    source: "NONE",
    confidence: 0,
    isOverride: false,
  };
}

function shapeFlags(unit, match) {
  const unitShape = normalizeText(`${unit?.type || ""} ${unit?.sourceFeature || ""} ${match.architectureLabel || ""}`);
  return {
    split: unitShape.includes("XE_KHE") || unitShape.includes("XEKHE"),
    corner: unitShape.includes("CAN_GOC") || unitShape.includes("GOC"),
    shophouse: unitShape.includes("SHOPHOUSE"),
    semiDetached: unitShape.includes("SONG_LAP") || unitShape.includes("SONGLAP"),
    detached: unitShape.includes("DON_LAP") || unitShape.includes("DONLAP"),
  };
}

function canonicalTypeToken(unit, match) {
  const flags = shapeFlags(unit, match);
  if (flags.semiDetached) return "SONG_LAP";
  if (flags.detached) return "DON_LAP";
  return "LK";
}

export function expectedHouseAssetKey(unit) {
  const match = resolveArchitectureMatch(unit);
  const number = architectureNumber(match.architectureCode);
  if (!number) return "";
  const flags = shapeFlags(unit, match);
  const parts = [`CH${number}`, canonicalTypeToken(unit, match)];
  if (flags.shophouse) parts.push("SHOPHOUSE");
  else if (flags.split) parts.push("XE_KHE");
  // CĂN GÓC is display metadata only; it intentionally shares the base house image.
  return parts.join("_");
}

function assetFlags(asset) {
  const haystack = normalizeText(`${asset.id} ${asset.name || ""} ${asset.fileName || ""}`);
  return {
    split: haystack.includes("XE_KHE") || haystack.includes("XEKHE"),
    corner: haystack.includes("CAN_GOC") || haystack.includes("GOC"),
    shophouse: haystack.includes("SHOPHOUSE"),
    semiDetached: haystack.includes("SONG_LAP") || haystack.includes("SONGLAP") || haystack.includes("BT_"),
    detached: haystack.includes("DON_LAP") || haystack.includes("DONLAP"),
    haystack,
  };
}

function isCompatibleHouseVariant(asset, match, unit) {
  const wants = shapeFlags(unit, match);
  const has = assetFlags(asset);
  if (wants.semiDetached !== has.semiDetached) return false;
  if (wants.detached !== has.detached) return false;
  if (!wants.semiDetached && !wants.detached && (has.semiDetached || has.detached)) return false;
  if (wants.shophouse !== has.shophouse && (wants.shophouse || has.shophouse)) return false;
  if (wants.split !== has.split && (wants.split || has.split)) return false;
  // Automatic matching ignores corner-specific images; corner units use the regular base facade.
  if (has.corner) return false;
  return true;
}

function scoreHouseCandidate(asset, match, unit) {
  const flags = assetFlags(asset);
  let score = architectureNumber(`${asset.id} ${asset.name || ""} ${asset.fileName || ""}`) === architectureNumber(match.architectureCode) ? 100 : 0;
  const wants = shapeFlags(unit, match);
  if (wants.split === flags.split) score += 18;
  if (wants.shophouse === flags.shophouse) score += 12;
  if (wants.semiDetached === flags.semiDetached) score += 12;
  if (wants.detached === flags.detached) score += 12;
  return score;
}

export function resolveArchitectureHouseAsset(unit, houseCatalog = []) {
  const match = resolveArchitectureMatch(unit);
  const targetNumber = architectureNumber(match.architectureCode);
  const expectedKey = expectedHouseAssetKey(unit);
  if (!targetNumber) {
    return { ...match, asset: null, assetStatus: "NONE", suggestedHouseModel: "", expectedAssetKey: "" };
  }

  const codeCandidates = houseCatalog.filter((asset) =>
    architectureNumber(`${asset.id} ${asset.name || ""} ${asset.fileName || ""}`) === targetNumber
  );
  const candidates = codeCandidates.filter((asset) => isCompatibleHouseVariant(asset, match, unit));

  if (!candidates.length) {
    return {
      ...match,
      asset: null,
      assetStatus: codeCandidates.length ? "MISSING_VARIANT" : "MISSING",
      suggestedHouseModel: expectedKey ? `HOUSE_${expectedKey}` : `HOUSE_CH${targetNumber}`,
      expectedAssetKey: expectedKey,
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
    expectedAssetKey: expectedKey,
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
      expectedAssetKey: resolved.expectedAssetKey,
      houseModel: resolved.asset?.id || "",
      houseAssetStatus: resolved.assetStatus,
      architectureSource: "AUTO",
      architectureConfidence: item.confidence,
    };
  });
}
