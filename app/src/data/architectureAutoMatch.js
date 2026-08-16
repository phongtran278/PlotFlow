function normalizeUnitCode(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
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

export function resolveArchitectureMatch(unit) {
  const manualLabel = String(unit?.architectureLabel || "").trim();
  if (manualLabel) {
    const codeFromLabel = manualLabel.match(/CH\s*[-_]?\s*(\d+)/i)?.[1];
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: codeFromLabel ? `CH-${codeFromLabel}` : "",
      architectureLabel: manualLabel,
      source: "MANUAL",
      confidence: 1,
      isOverride: true,
    };
  }

  const match = ARCHITECTURE_BY_UNIT.get(normalizeUnitCode(unit?.unitCode));
  if (!match) {
    return {
      unitCode: unit?.unitCode || "",
      architectureCode: "",
      architectureLabel: "Chưa có auto match",
      source: "NONE",
      confidence: 0,
      isOverride: false,
    };
  }

  return {
    ...match,
    source: "AUTO",
    isOverride: false,
  };
}

export function architectureExportRows() {
  return ARCHITECTURE_AUTO_MATCHES.map((item) => ({
    unitCode: item.unitCode,
    architectureCode: item.architectureCode,
    architectureLabel: item.architectureLabel,
    architectureSource: "AUTO",
    architectureConfidence: item.confidence,
  }));
}
