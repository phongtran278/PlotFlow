const UNIT_CODE_RE = /\b(?:TL-\d{1,5}|[A-Z]{1,8}\d{1,5}-\d{1,5})\b/g;

export function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

export function extractUnitCodes(value) {
  return normalizeUnitCode(value).match(UNIT_CODE_RE) || [];
}
