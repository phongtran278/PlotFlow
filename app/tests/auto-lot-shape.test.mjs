import test from "node:test";
import assert from "node:assert/strict";
import { detectLotShapeFromImageData } from "../src/floorplan/autoLotShape.js";

const WIDTH = 640;
const HEIGHT = 480;

function imageData(width = WIDTH, height = HEIGHT, color = [255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = 255;
  }
  return { width, height, data };
}

function pixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (y * image.width + x) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = 255;
}

function fillRect(image, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) pixel(image, x, y, color);
  }
}

function drawLine(image, x0, y0, x1, y1, color = [24, 24, 24], thickness = 2) {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) {
      for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
        pixel(image, x0 + ox, y0 + oy, color);
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
  }
}

function drawLot(image, x0, y0, x1, y1, { openSide = null } = {}) {
  fillRect(image, x0, y0, x1, y1, [246, 228, 95]);
  if (openSide !== "top") drawLine(image, x0, y0, x1, y0);
  if (openSide !== "right") drawLine(image, x1, y0, x1, y1);
  if (openSide !== "bottom") drawLine(image, x1, y1, x0, y1);
  if (openSide !== "left") drawLine(image, x0, y1, x0, y0);
  // Small label strokes: they should not cause the fill to be assigned to a
  // neighbouring lot when the anchor lands on dark text.
  drawLine(image, x0 + 4, y0 + 18, x0 + 8, y0 + 18, [35, 35, 35], 1);
  drawLine(image, x0 + 4, y0 + 22, x0 + 9, y0 + 22, [35, 35, 35], 1);
}

function bounds(points) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

test("multi-scale search detects a narrow parcel that fails the full-crop size filter", async () => {
  const image = imageData();
  drawLot(image, 302, 180, 315, 242);
  drawLot(image, 318, 180, 331, 242);
  const anchor = { x: 308.5 / (WIDTH - 1), y: 210 / (HEIGHT - 1) };

  const result = await detectLotShapeFromImageData(image, anchor);

  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.method, "multi-scale-local-boundary-fill");
  assert.ok(result.diagnostics.searchWindowRatio < 1);
  assert.ok(result.vertices >= 4 && result.vertices <= 8);
  const box = bounds(result.shape.points);
  assert.ok(box.minX > 0.45 && box.maxX < 0.51, JSON.stringify(box));
  assert.ok(box.minY > 0.36 && box.maxY < 0.53, JSON.stringify(box));
});

test("an open parcel edge is rejected rather than filled as a confident polygon", async () => {
  const image = imageData();
  drawLot(image, 302, 180, 315, 242, { openSide: "right" });
  // Continue the same fill to the image edge: the parcel has no closed right boundary.
  fillRect(image, 315, 181, WIDTH - 1, 241, [246, 228, 95]);
  const result = await detectLotShapeFromImageData(image, {
    x: 308.5 / (WIDTH - 1),
    y: 210 / (HEIGHT - 1),
  });
  assert.equal(result.accepted, false);
});

test("invalid image buffers fail closed", async () => {
  const result = await detectLotShapeFromImageData({ width: 10, height: 10, data: new Uint8Array(4) });
  assert.deepEqual(
    { accepted: result.accepted, reason: result.reason },
    { accepted: false, reason: "invalid-image-data" },
  );
});

test("boundary refinement reaches the dark stroke center without crossing into the adjacent parcel", async () => {
  const image = imageData();
  drawLot(image, 270, 180, 330, 270);
  drawLot(image, 330, 180, 390, 270);
  const result = await detectLotShapeFromImageData(image, {
    x: 300 / (WIDTH - 1), y: 225 / (HEIGHT - 1),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.vertices, 4);
  assert.equal(result.diagnostics.snappedEdges, 4);
  const box = bounds(result.shape.points);
  for (const [actual, expected] of [
    [box.minX * (WIDTH - 1), 270], [box.maxX * (WIDTH - 1), 330],
    [box.minY * (HEIGHT - 1), 180], [box.maxY * (HEIGHT - 1), 270],
  ]) assert.ok(Math.abs(actual - expected) <= 1.5, JSON.stringify(box));
});
