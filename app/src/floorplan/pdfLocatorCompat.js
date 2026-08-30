import {
  normalizeUnitCode as baseNormalizeUnitCode,
  resolveUnitsAgainstIndex as baseResolveUnitsAgainstIndex,
} from "./pdfLocatorAuto.js";

export function normalizeUnitCode(value) {
  return baseNormalizeUnitCode(
    String(value || "")
      .replace(/[Ðð]/g, "D")
  );
}

function candidateKeys(rawCode) {
  const key = normalizeUnitCode(rawCode);
  const candidates = [key];

  // Some embedded PDF fonts split or drop the Vietnamese Đ glyph into a separate
  // text fragment. In that case PDF.js indexes DLCV2-14 as LCV2-14 or CV2-14.
  // Keep the visible Sheet code unchanged but allow these locator-only aliases.
  if (key.startsWith("DLCV")) {
    candidates.push(key.slice(1));
    candidates.push(key.slice(2));
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function resolveUnitsAgainstIndex(units, index) {
  const normalizedIndex = index || {};
  const result = {};

  units.forEach((unit) => {
    const key = normalizeUnitCode(unit.unitCode);
    const aliases = candidateKeys(unit.unitCode);
    let matchedKey = key;
    let matches = [];

    for (const alias of aliases) {
      const candidateMatches = normalizedIndex[alias] || [];
      if (candidateMatches.length) {
        matchedKey = alias;
        matches = candidateMatches;
        break;
      }
    }

    // Preserve the Sheet code as the public result key, but annotate locator matches
    // with the Sheet code so downstream camera/highlight state remains consistent.
    const publicMatches = matches.map((match) => ({
      ...match,
      unitCode: key,
      locatorCode: matchedKey,
    }));

    result[key] = {
      unitCode: key,
      status: publicMatches.length === 0 ? "not_found" : publicMatches.length === 1 ? "ready" : "review",
      matches: publicMatches,
      selectedMatchIndex: 0,
      locatorAlias: matchedKey !== key ? matchedKey : null,
    };
  });

  return result;
}

export { baseResolveUnitsAgainstIndex };
