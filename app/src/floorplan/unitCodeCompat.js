import locatorOverrides from "./locatorOverrides.json";

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
    .replace(/[‐‑‒–—―−﹘﹣－]/g, "-")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
}

function compactUnitCode(value) {
  return normalizeUnitCode(value).replace(/-/g, "");
}

function compatibleKeys(key) {
  const keys = new Set([key]);

  // Vietnamese embedded fonts can expose Đ as a missing glyph or split the prefix
  // into separate PDF text fragments. Keep these aliases for old/current indexes,
  // while durable recovered coordinates live in locatorOverrides.json.
  if (key.startsWith("DLCV")) {
    keys.add(key.slice(1));
    keys.add(key.slice(2));
  }
  if (key.startsWith("LCV")) keys.add(`D${key}`);
  if (key.startsWith("CV")) keys.add(`DL${key}`);

  return [...keys];
}

function compatibleCompactKeys(key) {
  return new Set(compatibleKeys(key).map((candidate) => compactUnitCode(candidate)));
}

function overrideMatchesForKey(key) {
  for (const candidate of compatibleKeys(key)) {
    const direct = locatorOverrides?.[candidate];
    if (Array.isArray(direct) && direct.length) return uniqueMatches(direct);
  }

  const compatible = new Set(compatibleKeys(key));
  const compactCompatible = compatibleCompactKeys(key);
  const normalized = [];
  for (const [rawKey, rawMatches] of Object.entries(locatorOverrides || {})) {
    if (rawKey.startsWith("_")) continue;
    const normalizedRawKey = normalizeUnitCode(rawKey);
    if (
      (compatible.has(normalizedRawKey) || compactCompatible.has(compactUnitCode(rawKey)))
      && Array.isArray(rawMatches)
    ) {
      normalized.push(...rawMatches);
    }
  }
  return uniqueMatches(normalized);
}

function matchesForKey(index, key) {
  // Durable overrides win. They are recovered/confirmed coordinates and must survive
  // future masterplan optimization or manifest regeneration.
  const overrideMatches = overrideMatchesForKey(key);
  if (overrideMatches.length) return overrideMatches;

  const direct = compatibleKeys(key).flatMap((candidate) => index?.[candidate] || []);
  if (direct.length) return uniqueMatches(direct);

  const compatible = new Set(compatibleKeys(key));
  const compactCompatible = compatibleCompactKeys(key);
  const normalized = [];
  for (const [rawKey, rawMatches] of Object.entries(index || {})) {
    const normalizedRawKey = normalizeUnitCode(rawKey);
    if (compatible.has(normalizedRawKey) || compactCompatible.has(compactUnitCode(rawKey))) {
      normalized.push(...(rawMatches || []));
    }
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
