function uniqueMatches(matches = []) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = [
      match?.pageNumber ?? "",
      Math.round(Number(match?.x || 0) * 100) / 100,
      Math.round(Number(match?.y || 0) * 100) / 100,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
}

function compatibleKeys(key) {
  const keys = new Set([key]);

  // Some embedded Vietnamese PDF fonts expose Đ as a glyph with no Unicode mapping.
  // In that case PDF.js can return LCV... instead of ĐLCV/DLCV.... Keep this targeted
  // alias so unrelated leading-D unit families are never merged accidentally.
  if (key.startsWith("DLCV")) keys.add(key.slice(1));
  if (key.startsWith("LCV")) keys.add(`D${key}`);

  return [...keys];
}

function matchesForKey(index, key) {
  const direct = compatibleKeys(key).flatMap((candidate) => index?.[candidate] || []);
  if (direct.length) return uniqueMatches(direct);

  // Older/generated indexes may still contain the raw PDF glyph. Normalize keys lazily
  // here rather than forcing a full masterplan rebuild just to repair a character map.
  const compatible = new Set(compatibleKeys(key));
  const normalized = [];
  for (const [rawKey, rawMatches] of Object.entries(index || {})) {
    if (compatible.has(normalizeUnitCode(rawKey))) normalized.push(...(rawMatches || []));
  }
  return uniqueMatches(normalized);
}

export function resolveUnitsAgainstIndex(units, index) {
  const result = {};
  for (const unit of units || []) {
    const key = normalizeUnitCode(unit?.unitCode);
    const matches = matchesForKey(index, key);
    result[key] = {
      unitCode: key,
      status: matches.length === 0 ? "not_found" : matches.length === 1 ? "ready" : "review",
      matches,
      selectedMatchIndex: 0,
    };
  }
  return result;
}
