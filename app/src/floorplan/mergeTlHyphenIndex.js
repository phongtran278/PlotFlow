const RUNTIME_COORDINATE_SPACE = "runtime-page-top-left-points";

export function mergeTlHyphenIndex(manifest, supplement) {
  if (!manifest?.index || !manifest?.pages) {
    throw new Error("Prepared masterplan manifest thiếu index/pages.");
  }
  if (manifest.coordinateTransformId) {
    if (manifest.coordinateTransformId === supplement?.coordinateCalibration?.id) return manifest;
    throw new Error("Masterplan manifest đã dùng một coordinate transform khác.");
  }
  if (supplement?.version !== 1 || supplement?.codePatternVersion !== 2
      || !Array.isArray(supplement.entries) || supplement.count !== supplement.entries.length) {
    throw new Error("TL lot index không đúng schema hoặc thiếu dữ liệu.");
  }

  const pageInfo = manifest.pages[String(supplement.pageNumber)];
  if (!pageInfo || Math.abs(Number(pageInfo.width) - Number(supplement.pageSize?.width)) > 0.05
      || Math.abs(Number(pageInfo.height) - Number(supplement.pageSize?.height)) > 0.05) {
    throw new Error("TL lot index không khớp kích thước trang Masterplan.");
  }

  const calibration = validateCalibration(supplement, pageInfo);
  const index = {};
  for (const [rawCode, matches] of Object.entries(manifest.index)) {
    const code = normalizeCode(rawCode);
    if (!Array.isArray(matches)) {
      index[rawCode] = matches;
      continue;
    }
    index[rawCode] = code.startsWith("TL")
      ? matches.map((match) => transformIndexMatch(match, pageInfo, calibration, code))
      : matches;
  }

  const seen = new Set();
  for (const entry of supplement.entries) {
    const code = normalizeCode(entry?.unitCode);
    const sourceBbox = entry?.bbox || {};
    const values = [sourceBbox.x0, sourceBbox.y0, sourceBbox.x1, sourceBbox.y1].map(Number);
    if (!/^TL-\d{1,5}$/.test(code) || seen.has(code) || entry.pageNumber !== supplement.pageNumber
        || values.some((value) => !Number.isFinite(value))
        || values[0] < 0 || values[1] < 0 || values[2] <= values[0] || values[3] <= values[1]
        || values[2] > Number(pageInfo.width) || values[3] > Number(pageInfo.height)) {
      throw new Error(`TL lot index có tọa độ hoặc mã không hợp lệ: ${code || "unknown"}`);
    }
    assertInsideRegion(sourceBbox, calibration.sourceRegion, code);
    seen.add(code);
    if (!Array.isArray(index[code]) || !index[code].length) {
      const bbox = transformBbox(sourceBbox, calibration.matrix);
      assertInsidePage(bbox, pageInfo, code);
      index[code] = [{
        unitCode: code,
        pageNumber: entry.pageNumber,
        bbox,
        sourceBbox: { x0: values[0], y0: values[1], x1: values[2], y1: values[3] },
        coordinateSpace: RUNTIME_COORDINATE_SPACE,
        sourceText: entry.sourceText || code,
      }];
    }
  }

  return {
    ...manifest,
    index,
    coordinateTransformId: calibration.id,
    codePatternVersion: Math.max(Number(manifest.codePatternVersion || 0), supplement.codePatternVersion),
    tlHyphenIndex: {
      count: seen.size,
      sourcePdf: supplement.sourcePdf,
      sourceSha256: supplement.sourceSha256,
      runtimePdfSha256: calibration.runtimePdfSha256,
      coordinateTransformId: calibration.id,
    },
  };
}

function validateCalibration(supplement, pageInfo) {
  const calibration = supplement.coordinateCalibration;
  const matrix = calibration?.sourceToRuntime;
  const tiles = pageInfo.tiles;
  const expectedTiles = calibration?.runtimeTileSource;
  if (!calibration?.id || calibration.sourcePdfSha256 !== supplement.sourceSha256
      || !/^[a-f0-9]{64}$/i.test(calibration.runtimePdfSha256 || "")
      || !Array.isArray(matrix) || matrix.length !== 2
      || matrix.some((row) => !Array.isArray(row) || row.length !== 3 || row.some((v) => !Number.isFinite(Number(v))))
      || !calibration.sourceRegion || !tiles || !expectedTiles) {
    throw new Error("TL coordinate calibration thiếu metadata hoặc ma trận hợp lệ.");
  }
  const determinant = Number(matrix[0][0]) * Number(matrix[1][1])
    - Number(matrix[0][1]) * Number(matrix[1][0]);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.1) {
    throw new Error("TL coordinate calibration có ma trận suy biến.");
  }
  const expectedWidths = expectedTiles.levelWidths || [];
  const actualWidths = (tiles.levels || []).map((level) => Number(level.width));
  const sourceManifest = String(pageInfo.sourceManifest || "").replace(/\\/g, "/");
  if (Number(tiles.sourceWidth) !== Number(expectedTiles.width)
      || Number(tiles.sourceHeight) !== Number(expectedTiles.height)
      || Number(tiles.tileSize) !== Number(expectedTiles.tileSize)
      || JSON.stringify(actualWidths) !== JSON.stringify(expectedWidths)
      || sourceManifest !== calibration.runtimeTileSourceManifest) {
    throw new Error("TL coordinate calibration không khớp page-tile source đang tải.");
  }
  return {
    id: calibration.id,
    matrix: matrix.map((row) => row.map(Number)),
    sourceRegion: calibration.sourceRegion,
    runtimePdfSha256: calibration.runtimePdfSha256,
  };
}

function transformIndexMatch(match, pageInfo, calibration, code) {
  if (match?.coordinateSpace === RUNTIME_COORDINATE_SPACE) return match;
  const sourceBbox = match?.bbox || pdfTextMatchToTopLeftBbox(match, Number(pageInfo.height));
  if (!sourceBbox) return match;
  assertInsideRegion(sourceBbox, calibration.sourceRegion, code);
  const bbox = transformBbox(sourceBbox, calibration.matrix);
  assertInsidePage(bbox, pageInfo, code);
  return {
    ...match,
    bbox,
    sourceBbox: { ...sourceBbox },
    coordinateSpace: RUNTIME_COORDINATE_SPACE,
  };
}

function pdfTextMatchToTopLeftBbox(match, pageHeight) {
  const x = Number(match?.x);
  const y = Number(match?.y);
  const width = Number(match?.width);
  const height = Number(match?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x0: x, y0: pageHeight - y - height, x1: x + width, y1: pageHeight - y };
}

function transformBbox(box, matrix) {
  const points = [
    [Number(box.x0), Number(box.y0)],
    [Number(box.x1), Number(box.y0)],
    [Number(box.x1), Number(box.y1)],
    [Number(box.x0), Number(box.y1)],
  ].map(([x, y]) => [
    matrix[0][0] * x + matrix[0][1] * y + matrix[0][2],
    matrix[1][0] * x + matrix[1][1] * y + matrix[1][2],
  ]);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

function assertInsideRegion(box, region, code) {
  const values = [box.x0, box.y0, box.x1, box.y1].map(Number);
  if (values.some((value) => !Number.isFinite(value))
      || values[0] < Number(region.x0) || values[1] < Number(region.y0)
      || values[2] > Number(region.x1) || values[3] > Number(region.y1)) {
    throw new Error(`TL code nằm ngoài vùng hiệu chuẩn tọa độ: ${code}`);
  }
}

function assertInsidePage(box, pageInfo, code) {
  if (![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite)
      || box.x0 < 0 || box.y0 < 0 || box.x1 <= box.x0 || box.y1 <= box.y0
      || box.x1 > Number(pageInfo.width) || box.y1 > Number(pageInfo.height)) {
    throw new Error(`TL code sau hiệu chỉnh nằm ngoài trang Masterplan: ${code}`);
  }
}

function normalizeCode(value) {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .toUpperCase().replace(/\s+/g, "").trim();
}
