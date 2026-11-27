const UNIT_CODE_RE = /\b(?:TL\s*-\s*\d{1,5}|[A-Z]{1,8}\d{1,5}\s*-\s*\d{1,5})\b/g;

export function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .replace(/[‐‑‒–—―−﹘﹣－]/g, "-")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

export function extractUnitCodes(value) {
  const searchable = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .replace(/[‐‑‒–—―−﹘﹣－]/g, "-")
    .toUpperCase();
  return (searchable.match(UNIT_CODE_RE) || []).map(normalizeUnitCode);
}
