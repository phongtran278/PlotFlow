const MAX_ANALYSIS_WIDTH = 720;
const MAX_COMPONENTS_NEAR_ANCHOR = 14;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được floorplan để Auto Detect."));
    image.src = src;
  });
}

function luminance(data, index) {
  return Math.round(data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722);
}

function buildGray(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) gray[p] = luminance(data, i);
  return gray;
}

function dilateMask(mask, width, height, radius = 1) {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      for (let yy = y0; yy <= y1; yy += 1) {
        for (let xx = x0; xx <= x1; xx += 1) out[yy * width + xx] = 1;
      }
    }
  }
  return out;
}

function buildBarrierMask(gray, width, height, config) {
  const raw = new Uint8Array(width * height);
  const darkThreshold = config.darkThreshold;
  const gradientThreshold = config.gradientThreshold;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const value = gray[index];
      const gx = Math.abs(gray[index + 1] - gray[index - 1]);
      const gy = Math.abs(gray[index + width] - gray[index - width]);
      if (value < darkThreshold || gx + gy > gradientThreshold) raw[index] = 1;
    }
  }

  return dilateMask(raw, width, height, config.dilateRadius);
}

function labelComponents(barrier, width, height) {
  const total = width * height;
  const labels = new Int32Array(total);
  const queue = new Int32Array(total);
  const components = [null];
  let nextLabel = 0;

  for (let start = 0; start < total; start += 1) {
    if (barrier[start] || labels[start]) continue;
    nextLabel += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = nextLabel;

    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let touchesEdge = false;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= total || barrier[neighbor] || labels[neighbor]) continue;
        const nx = neighbor % width;
        if (Math.abs(nx - x) > 1) continue;
        labels[neighbor] = nextLabel;
        queue[tail++] = neighbor;
      }
    }

    components[nextLabel] = {
      label: nextLabel,
      count,
      minX,
      minY,
      maxX,
      maxY,
      sumX,
      sumY,
      touchesEdge,
    };
  }

  return { labels, components };
}

function labelsNearAnchor(labels, width, height, anchorX, anchorY) {
  const result = new Set();
  const maxRadius = Math.max(16, Math.round(Math.min(width, height) * 0.075));
  const angles = 24;

  const add = (x, y) => {
    const xx = Math.round(clamp(x, 0, width - 1));
    const yy = Math.round(clamp(y, 0, height - 1));
    const label = labels[yy * width + xx];
    if (label > 0) result.add(label);
  };

  add(anchorX, anchorY);
  for (let radius = 3; radius <= maxRadius && result.size < MAX_COMPONENTS_NEAR_ANCHOR; radius += 3) {
    for (let step = 0; step < angles; step += 1) {
      const angle = (Math.PI * 2 * step) / angles;
      add(anchorX + Math.cos(angle) * radius, anchorY + Math.sin(angle) * radius);
    }
  }

  return [...result];
}

function pointLineDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function convexHull(points) {
  if (points.length <= 3) return points.slice();
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function simplifyHull(points, tolerance, maxVertices = 8) {
  const result = points.map((point) => ({ ...point }));
  if (result.length <= 4) return result;

  let changed = true;
  while (changed && result.length > 4) {
    changed = false;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < result.length; i += 1) {
      const prev = result[(i - 1 + result.length) % result.length];
      const current = result[i];
      const next = result[(i + 1) % result.length];
      const distance = pointLineDistance(current, prev, next);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0 && bestDistance <= tolerance) {
      result.splice(bestIndex, 1);
      changed = true;
    }
  }

  while (result.length > maxVertices) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < result.length; i += 1) {
      const prev = result[(i - 1 + result.length) % result.length];
      const current = result[i];
      const next = result[(i + 1) % result.length];
      const distance = pointLineDistance(current, prev, next);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    result.splice(bestIndex, 1);
  }

  return result;
}

function polygonArea(points) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function extractBoundaryPoints(labels, component, width, height) {
  const points = [];
  const { label, minX, minY, maxX, maxY } = component;
  const stride = Math.max(1, Math.floor(Math.sqrt(component.count) / 140));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * width + x;
      if (labels[index] !== label) continue;
      const isBoundary = x === 0 || y === 0 || x === width - 1 || y === height - 1
        || labels[index - 1] !== label
        || labels[index + 1] !== label
        || labels[index - width] !== label
        || labels[index + width] !== label;
      if (isBoundary && ((x + y) % stride === 0)) points.push({ x, y });
    }
  }

  return points;
}

function rectangleScore(points) {
  if (points.length !== 4) return 0;
  let score = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = points[(i - 1 + 4) % 4];
    const b = points[i];
    const c = points[(i + 1) % 4];
    const abx = a.x - b.x;
    const aby = a.y - b.y;
    const cbx = c.x - b.x;
    const cby = c.y - b.y;
    const denom = Math.max(1e-6, Math.hypot(abx, aby) * Math.hypot(cbx, cby));
    const cosine = Math.abs((abx * cbx + aby * cby) / denom);
    score += Math.max(0, 1 - cosine * 3);
  }
  return score / 4;
}


function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const x = ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

function candidateFromComponent(labels, component, width, height, anchorX, anchorY) {
  if (!component || component.count < 30) return null;
  const total = width * height;
  const bboxW = component.maxX - component.minX + 1;
  const bboxH = component.maxY - component.minY + 1;
  const bboxArea = bboxW * bboxH;
  const areaRatio = component.count / total;
  const bboxRatio = bboxArea / total;
  const fillRatio = component.count / Math.max(1, bboxArea);
  const centroidX = component.sumX / component.count;
  const centroidY = component.sumY / component.count;
  const containsAnchor = anchorX >= component.minX && anchorX <= component.maxX && anchorY >= component.minY && anchorY <= component.maxY;
  const centerDistance = Math.hypot(centroidX - anchorX, centroidY - anchorY) / Math.max(12, Math.hypot(bboxW, bboxH));
  const distanceX = anchorX < component.minX ? component.minX - anchorX : anchorX > component.maxX ? anchorX - component.maxX : 0;
  const distanceY = anchorY < component.minY ? component.minY - anchorY : anchorY > component.maxY ? anchorY - component.maxY : 0;
  const anchorBoundsDistance = Math.hypot(distanceX, distanceY) / Math.max(12, Math.hypot(bboxW, bboxH));

  if (anchorBoundsDistance > 0.18) return null;
  if (areaRatio < 0.001 || areaRatio > 0.52) return null;
  if (bboxRatio < 0.0015 || bboxRatio > 0.62) return null;
  if (bboxW < Math.max(5, width * 0.018) || bboxH < Math.max(5, height * 0.02)) return null;
  if (bboxW > width * 0.88 || bboxH > height * 0.88) return null;
  if (fillRatio < 0.2) return null;

  const boundary = extractBoundaryPoints(labels, component, width, height);
  if (boundary.length < 12) return null;
  const hull = convexHull(boundary);
  const tolerance = Math.max(1.4, Math.min(width, height) * 0.0045);
  const simplified = simplifyHull(hull, tolerance, 8);
  if (simplified.length < 4 || simplified.length > 8) return null;
  if (!pointInPolygon({ x: anchorX, y: anchorY }, simplified)) return null;

  const hullArea = polygonArea(simplified);
  const hullFill = component.count / Math.max(1, hullArea);
  if (hullFill < 0.35 || hullFill > 1.4) return null;

  let confidence = 0.38;
  confidence += containsAnchor ? 0.18 : 0;
  confidence += Math.max(0, 0.16 * (1 - centerDistance / 0.55));
  confidence += Math.max(0, Math.min(0.1, (fillRatio - 0.2) * 0.18));
  confidence += areaRatio >= 0.003 && areaRatio <= 0.32 ? 0.08 : 0.02;
  confidence += simplified.length >= 4 && simplified.length <= 6 ? 0.08 : 0.04;
  confidence += Math.min(0.08, rectangleScore(simplified) * 0.08);
  if (component.touchesEdge) confidence -= 0.34;
  if (centerDistance > 0.7) confidence -= 0.16;

  const normalized = simplified.map((point) => ({
    x: clamp01(point.x / Math.max(1, width - 1)),
    y: clamp01(point.y / Math.max(1, height - 1)),
  }));

  return {
    confidence: clamp(confidence, 0, 0.99),
    shape: { type: "polygon", source: "auto-detected", points: normalized },
    vertices: normalized.length,
    classification: normalized.length === 4 && rectangleScore(simplified) > 0.62 ? "rectangle" : "polygon",
    diagnostics: { areaRatio, bboxRatio, fillRatio, centerDistance, anchorBoundsDistance, anchorContained: containsAnchor, touchesEdge: component.touchesEdge },
  };
}

async function analyzeWithConfig(imageData, anchor, config, trace = null) {
  const { width, height } = imageData;
  const gray = buildGray(imageData);
  const barrier = buildBarrierMask(gray, width, height, config);
  const { labels, components } = labelComponents(barrier, width, height);
  const anchorX = clamp(anchor.x, 0, 1) * (width - 1);
  const anchorY = clamp(anchor.y, 0, 1) * (height - 1);
  const nearLabels = labelsNearAnchor(labels, width, height, anchorX, anchorY);

  let best = null;
  const inspected = [];
  for (const label of nearLabels) {
    const component = components[label];
    const candidate = candidateFromComponent(labels, component, width, height, anchorX, anchorY);
    inspected.push({
      count: component.count,
      width: component.maxX - component.minX + 1,
      height: component.maxY - component.minY + 1,
      touchesEdge: component.touchesEdge,
      accepted: Boolean(candidate),
      confidence: candidate?.confidence ?? 0,
    });
    if (candidate && (!best || candidate.confidence > best.confidence)) best = candidate;
  }
  if (trace) {
    trace.nearLabelCount = nearLabels.length;
    trace.components = inspected;
  }
  return best;
}

function cropImageData(imageData, rect) {
  const width = rect.width;
  const height = rect.height;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((rect.y + y) * imageData.width + rect.x) * 4;
    const sourceEnd = sourceStart + width * 4;
    data.set(imageData.data.subarray(sourceStart, sourceEnd), y * width * 4);
  }
  return { data, width, height };
}

function centeredSearchWindow(width, height, anchor, ratio) {
  const cropWidth = Math.max(1, Math.min(width, Math.round(width * ratio)));
  const cropHeight = Math.max(1, Math.min(height, Math.round(height * ratio)));
  const anchorX = clamp01(anchor.x) * (width - 1);
  const anchorY = clamp01(anchor.y) * (height - 1);
  const x = Math.round(clamp(anchorX - cropWidth / 2, 0, width - cropWidth));
  const y = Math.round(clamp(anchorY - cropHeight / 2, 0, height - cropHeight));
  return {
    x,
    y,
    width: cropWidth,
    height: cropHeight,
    anchor: {
      x: (anchorX - x) / Math.max(1, cropWidth - 1),
      y: (anchorY - y) / Math.max(1, cropHeight - 1),
    },
  };
}

function mapCandidateToImage(candidate, rect, imageWidth, imageHeight, ratio) {
  const points = candidate.shape.points.map((point) => ({
    x: clamp01((rect.x + point.x * Math.max(1, rect.width - 1)) / Math.max(1, imageWidth - 1)),
    y: clamp01((rect.y + point.y * Math.max(1, rect.height - 1)) / Math.max(1, imageHeight - 1)),
  }));
  return {
    ...candidate,
    shape: { ...candidate.shape, points },
    diagnostics: { ...candidate.diagnostics, searchWindowRatio: ratio },
  };
}

// Recover the center of the first dark stroke outside each interior edge.
// Require agreement along the edge, not just a nearby dark pixel or label.
function snapBoundaryEdges(image, points, anchor) {
  const { width, height } = image;
  const gray = buildGray(image);
  const p = points.map(v => ({ x: v.x * (width - 1), y: v.y * (height - 1) }));
  const area = polygonArea(p);
  if (area < 30 || p.length < 4) return null;
  const center = p.reduce((s, v) => ({ x: s.x + v.x / p.length, y: s.y + v.y / p.length }), { x: 0, y: 0 });
  const maxOffset = Math.min(6, Math.max(2, Math.sqrt(area) * 0.14));
  const sample = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= width || y >= height ? 255 : gray[y * width + x];
  };
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 5) return null;
    let nx = (b.y - a.y) / length, ny = (a.x - b.x) / length;
    if ((center.x - a.x) * nx + (center.y - a.y) * ny > 0) { nx = -nx; ny = -ny; }
    const offsets = [];
    const count = Math.max(5, Math.min(25, Math.floor(length / 2)));
    for (let k = 0; k < count; k++) {
      const t = 0.18 + 0.64 * k / (count - 1);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      let start = null, end = null;
      for (let d = 0; d <= maxOffset + 2; d += 0.5) {
        if (sample(x + nx * d, y + ny * d) < 135) {
          if (start === null) start = d;
          end = d;
        } else if (start !== null) break;
      }
      // A complete narrow stroke, not a dark filled region.
      if (start !== null && end < maxOffset + 1.5 && end - start <= 5 && (start + end) / 2 <= maxOffset) offsets.push((start + end) / 2);
    }
    offsets.sort((a, b) => a - b);
    const median = offsets[Math.floor(offsets.length / 2)] ?? 0;
    const supported = offsets.filter(d => Math.abs(d - median) <= 1.25).length >= Math.ceil(count * 0.7);
    const offset = supported ? median : 0;
    return { nx, ny, c: nx * a.x + ny * a.y + offset, offset };
  });
  if (lines.some(l => !l) || !lines.some(l => l.offset > 0)) return null;
  const snapped = p.map((v, i) => {
    const a = lines[(i + lines.length - 1) % lines.length], b = lines[i];
    const det = a.nx * b.ny - a.ny * b.nx;
    if (Math.abs(det) < 0.2) return null;
    return { x: (a.c * b.ny - a.ny * b.c) / det, y: (a.nx * b.c - a.c * b.nx) / det };
  });
  if (snapped.some((v, i) => !v || v.x < 0 || v.y < 0 || v.x >= width || v.y >= height || Math.hypot(v.x - p[i].x, v.y - p[i].y) > maxOffset * 1.6)) return null;
  if (convexHull(snapped).length !== p.length || polygonArea(snapped) < area || polygonArea(snapped) > area * 1.65) return null;
  if (!pointInPolygon({ x: anchor.x * (width - 1), y: anchor.y * (height - 1) }, snapped)) return null;
  return { points: snapped.map(v => ({ x: v.x / (width - 1), y: v.y / (height - 1) })), edges: lines.filter(l => l.offset > 0).length };
}

export async function detectLotShapeFromImageData(imageData, anchor = { x: 0.5, y: 0.5 }) {
  const width = Math.floor(Number(imageData?.width) || 0);
  const height = Math.floor(Number(imageData?.height) || 0);
  if (width < 120 || height < 100 || !imageData?.data || imageData.data.length < width * height * 4) {
    return { accepted: false, confidence: 0, reason: "invalid-image-data" };
  }

  const safeAnchor = {
    x: clamp01(anchor?.x ?? 0.5),
    y: clamp01(anchor?.y ?? 0.5),
  };
  const windows = [1, 0.82, 0.64, 0.48, 0.38];
  const configs = [
    { darkThreshold: 158, gradientThreshold: 54, dilateRadius: 1 },
    { darkThreshold: 182, gradientThreshold: 42, dilateRadius: 1 },
    { darkThreshold: 205, gradientThreshold: 32, dilateRadius: 1 },
  ];

  let best = null;
  const attempts = [];
  for (const ratio of windows) {
    const rect = centeredSearchWindow(width, height, safeAnchor, ratio);
    if (rect.width < 180 || rect.height < 140) continue;
    const cropped = ratio === 1 ? imageData : cropImageData(imageData, rect);

    for (const config of configs) {
      const trace = {};
      const candidate = await analyzeWithConfig(cropped, rect.anchor, config, trace);
      if (!candidate) {
        attempts.push({ ratio, config, ...trace });
        continue;
      }
      if (candidate.diagnostics?.touchesEdge) continue;
      const mapped = mapCandidateToImage(candidate, rect, width, height, ratio);
      if (!best || mapped.confidence > best.confidence) best = mapped;
    }
  }

  if (!best) return { accepted: false, confidence: 0, reason: "no-closed-boundary", diagnostics: { attempts } };
  const accepted = best.confidence >= 0.68
    && best.diagnostics?.anchorContained === true
    && best.diagnostics?.anchorBoundsDistance <= 0.18;
  const snap = accepted ? snapBoundaryEdges(imageData, best.shape.points, safeAnchor) : null;
  return {
    ...best,
    ...(snap ? { shape: { ...best.shape, points: snap.points }, diagnostics: { ...best.diagnostics, snappedEdges: snap.edges } } : {}),
    accepted,
    method: "multi-scale-local-boundary-fill",
    reason: accepted ? "closed-boundary" : "low-confidence",
  };
}

export async function detectLotShape(imageSrc, anchor = { x: 0.5, y: 0.5 }) {
  if (!imageSrc) return { accepted: false, confidence: 0, reason: "missing-image" };
  const image = await loadImage(imageSrc);
  const scale = Math.min(1, MAX_ANALYSIS_WIDTH / Math.max(1, image.naturalWidth || image.width));
  const width = Math.max(240, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(180, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { accepted: false, confidence: 0, reason: "canvas-unavailable" };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  canvas.width = 1;
  canvas.height = 1;
  return detectLotShapeFromImageData(imageData, anchor);
}
