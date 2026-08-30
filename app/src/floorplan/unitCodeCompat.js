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

  // Vietnamese embedded fonts can expose Đ as a missing glyph or split the prefix
  // into separate PDF text fragments. For the DLCV family only, tolerate the two
  // observed fragments: DLCV2-14 -> LCV2-14 -> CV2-14.
  if (key.startsWith("DLCV")) {
    keys.add(key.slice(1));
    keys.add(key.slice(2));
  }
  if (key.startsWith("LCV")) keys.add(`D${key}`);
  if (key.startsWith("CV")) keys.add(`DL${key}`);

  return [...keys];
}

function matchesForKey(index, key) {
  const direct = compatibleKeys(key).flatMap((candidate) => index?.[candidate] || []);
  if (direct.length) return uniqueMatches(direct);

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
    const matches = matchesForKey(index, key).map((match) => ({
      ...match,
      unitCode: key,
    }));
    result[key] = {
      unitCode: key,
      status: matches.length === 0 ? "not_found" : matches.length === 1 ? "ready" : "review",
      matches,
      selectedMatchIndex: 0,
    };
  }
  return result;
}
