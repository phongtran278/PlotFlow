function normalizeUnitCode(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .trim()
    .replace(/(?:\s|_|-)+(VOS|VEOSOM|VE_O_SOM)$/i, "")
    .replace(/\s+/g, "");
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
  // Restored from the supplied 260611 architecture positioning masterplan.
  // These units are located directly inside the corresponding legend colour zones.
  { unitCode: "AS50-30", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS80-03", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS51-24", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS80-38", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS55-14", architectureCode: "CH-53", architectureLabel: "LIỀN KỀ - TÂN CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS70-17", architectureCode: "CH-08", architectureLabel: "LIỀN KỀ - CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS70-19", architectureCode: "CH-08", architectureLabel: "LIỀN KỀ - CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS69-18", architectureCode: "CH-08", architectureLabel: "LIỀN KỀ - CỔ ĐIỂN", confidence: 0.96 },
  { unitCode: "AS62-18", architectureCode: "CH-13", architectureLabel: "LIỀN KỀ - ĐÔNG ÂU", confidence: 0.96 },
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

const ARCHITECTURE_MODELS = [
  { code: "CH-53", type: "SONG_LAP", label: "SONG LẬP - TÂN CỔ ĐIỂN" },
  { code: "CH-53", type: "LK", label: "LIỀN KỀ - TÂN CỔ ĐIỂN" },
  { code: "CH-08", type: "LK", label: "LIỀN KỀ - CỔ ĐIỂN" },
  { code: "CH-08", type: "SONG_LAP", label: "SONG LẬP - CỔ ĐIỂN" },
  { code: "CH-71", type: "SONG_LAP", label: "SONG LẬP - NHẬT BẢN ĐƯƠNG ĐẠI" },
  { code: "CH-71", type: "LK", label: "LIỀN KỀ - NHẬT BẢN ĐƯƠNG ĐẠI" },
  { code: "CH-59", type: "LK", label: "LIỀN KỀ - HIỆN ĐẠI NHIỆT ĐỚI" },
  { code: "CH-59", type: "DON_LAP", label: "ĐƠN LẬP - HIỆN ĐẠI NHIỆT ĐỚI" },
  { code: "CH-59", type: "SONG_LAP", label: "SONG LẬP - HIỆN ĐẠI NHIỆT ĐỚI" },
  { code: "CH-52", type: "LK", label: "LIỀN KỀ - HIỆN ĐẠI XANH" },
  { code: "CH-75", type: "LK", label: "LIỀN KỀ - HIỆN ĐẠI XANH" },
  { code: "CH-75", type: "SONG_LAP", label: "SONG LẬP - HIỆN ĐẠI XANH" },
  { code: "CH-29", type: "LK", label: "LIỀN KỀ - NHẬT BẢN" },
  { code: "CH-15", type: "LK", label: "LIỀN KỀ - HÀN QUỐC" },
  { code: "CH-19", type: "LK", label: "LIỀN KỀ - HỘI AN" },
  { code: "CH-13", type: "LK", label: "LIỀN KỀ - ĐÔNG ÂU" },
];

function canonicalPropertyType(value = "") {
  const key = normalizeText(value).replace(/_/g, "");
  if (["K", "LK", "LIENKE"].includes(key) || key.includes("LIENKE")) return "LK";
  if (["SL", "SONGLAP"].includes(key) || key.includes("SONGLAP")) return "SONG_LAP";
  if (["DL", "DONLAP"].includes(key) || key.includes("DONLAP")) return "DON_LAP";
  return "";
}

function architectureStyleKey(value = "") {
  let key = normalizeText(value);
  key = key
    .replace(/(^|_)(K|LK|LIEN_KE|SONG_LAP|DON_LAP)(_|$)/g, "_")
    .replace(/(^|_)(CAN_GOC|XE_KHE|SHOPHOUSE)(_|$)/g, "_")
    .replace(/^_+|_+$/g, "");
  return key;
}

function inferArchitectureFromData(unit) {
  const directCode = extractArchitectureCode(unit?.architectureCode)
    || extractArchitectureCode(unit?.architectureLabel)
    || extractArchitectureCode(unit?.houseModel);
  if (directCode) {
    const model = ARCHITECTURE_MODELS.find((item) => item.code === directCode && (!canonicalPropertyType(unit?.type) || item.type === canonicalPropertyType(unit?.type)))
      || ARCHITECTURE_MODELS.find((item) => item.code === directCode);
    return {
      architectureCode: directCode,
      architectureLabel: String(unit?.architectureLabel || model?.label || "").trim(),
      confidence: 1,
      source: "DATA_CODE",
    };
  }

  const propertyType = canonicalPropertyType(unit?.type || unit?.sourceFeature || unit?.architectureLabel);
  const styleSource = unit?.architectureLabel || unit?.houseModel || "";
  const styleKey = architectureStyleKey(styleSource);
  if (!styleKey) return null;

  let candidates = ARCHITECTURE_MODELS.filter((item) => architectureStyleKey(item.label) === styleKey);
  if (propertyType) candidates = candidates.filter((item) => item.type === propertyType);

  const uniqueCodes = [...new Set(candidates.map((item) => item.code))];
  if (uniqueCodes.length !== 1) return null;

  const selected = candidates.find((item) => item.code === uniqueCodes[0]) || candidates[0];
  return {
    architectureCode: selected.code,
    architectureLabel: String(unit?.architectureLabel || selected.label).trim(),
    confidence: 0.94,
    source: "DATA_INFERRED",
  };
}

export function resolveArchitectureMatch(unit) {
  const autoMatch = ARCHITECTURE_BY_UNIT.get(normalizeUnitCode(unit?.unitCode));
  const storedLabel = String(unit?.architectureLabel || "").trim();
  const storedCode = String(unit?.architectureCode || "").trim();
  const inferred = inferArchitectureFromData(unit);

  if (inferred?.architectureCode) {
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: inferred.architectureCode,
      architectureLabel: inferred.architectureLabel || storedLabel || autoMatch?.architectureLabel || "",
      source: inferred.source,
      confidence: inferred.confidence,
      isOverride: false,
    };
  }

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
