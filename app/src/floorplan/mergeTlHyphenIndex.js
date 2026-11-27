export function mergeTlHyphenIndex(manifest, supplement) {
  if (!manifest?.index || !manifest?.pages) {
    throw new Error("Prepared masterplan manifest thiếu index/pages.");
  }
  if (supplement?.version !== 1 || supplement?.codePatternVersion !== 2
      || !Array.isArray(supplement.entries) || supplement.count !== supplement.entries.length) {
    throw new Error("TL lot index không đúng schema hoặc thiếu dữ liệu.");
  }
  const pageInfo = manifest.pages[String(supplement.pageNumber)];
  if (!pageInfo || Math.abs(Number(pageInfo.width) - Number(supplement.pageSize?.width)) > 0.05
      || Math.abs(Number(pageInfo.height) - Number(supplement.pageSize?.height)) > 0.05) {
    throw new Error("TL lot index không khớp hệ tọa độ Masterplan đang tải.");
  }
  const seen = new Set();
  const index = { ...manifest.index };
  for (const entry of supplement.entries) {
    const code = normalizeCode(entry?.unitCode);
    const box = entry?.bbox || {};
    const values = [box.x0, box.y0, box.x1, box.y1].map(Number);
    if (!/^TL-\d{1,5}$/.test(code) || seen.has(code) || entry.pageNumber !== supplement.pageNumber
        || values.some((value) => !Number.isFinite(value))
        || values[0] < 0 || values[1] < 0 || values[2] <= values[0] || values[3] <= values[1]
        || values[2] > Number(pageInfo.width) || values[3] > Number(pageInfo.height)) {
      throw new Error(`TL lot index có tọa độ hoặc mã không hợp lệ: ${code || "unknown"}`);
    }
    seen.add(code);
    if (!Array.isArray(index[code]) || !index[code].length) {
      index[code] = [{
        unitCode: code,
        pageNumber: entry.pageNumber,
        bbox: { x0: values[0], y0: values[1], x1: values[2], y1: values[3] },
        sourceText: entry.sourceText || code,
      }];
    }
  }
  return {
    ...manifest,
    index,
    codePatternVersion: Math.max(Number(manifest.codePatternVersion || 0), supplement.codePatternVersion),
    tlHyphenIndex: { count: seen.size, sourcePdf: supplement.sourcePdf },
  };
}

function normalizeCode(value) {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .toUpperCase().replace(/\s+/g, "").trim();
}
