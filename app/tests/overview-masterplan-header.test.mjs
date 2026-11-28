import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { headerAsset, coverHeader, projectHeaderRect, headerSpec, MASTERPLAN_HEADER_CALIBRATION } from "../src/product/overviewMasterplanHeader.js";

const project = "vinhomes-saigon-park";
test("maps only supported VSP handover groups to original assets", () => {
  assert.match(headerAsset(project, "Giãn xây"), /GIAN_XAY/);
  assert.match(headerAsset(project, "Xây thô"), /XAY_THO/);
  assert.match(headerAsset(project, " Hoàn thiện "), /HOAN_THIEN/);
  assert.equal(headerAsset("other", "Giãn xây"), null);
  assert.equal(headerAsset(project, "unknown"), null);
});
test("uniform cover keeps aspect ratio, covers both axes and centers bleed", () => {
  const target = { x: 100, y: 200, width: 200, height: 100 };
  const r = coverHeader(target, { width: 4, height: 1 });
  assert.deepEqual(r, { x: 0, y: 200, width: 400, height: 100 });
  assert.equal(coverHeader({ ...target, width: 0 }), null);
  const tall = coverHeader(target, { width: 1, height: 1 });
  assert.deepEqual(tall, { x: 100, y: 150, width: 200, height: 200 });
});
test("native placement follows fit, zoom, pan and resize", () => {
  const r = { x: 4200, y: 2100, width: 8400, height: 4200 };
  assert.deepEqual(projectHeaderRect(r, { x: 20, y: 30, width: 420 }), { x: 62, y: 51, width: 84, height: 42 });
  assert.deepEqual(projectHeaderRect(r, { x: 20, y: 30, width: 420 }, { scale: 2, tx: -11, ty: 5 }), { x: 113, y: 107, width: 168, height: 84 });
  assert.deepEqual(projectHeaderRect(r, { x: 0, y: 10, width: 840 }), { x: 84, y: 52, width: 168, height: 84 });
});
test("calibrated full-width cover is top-aligned and preserves image ratio", () => {
  assert.deepEqual(MASTERPLAN_HEADER_CALIBRATION, { x: 0, y: 0, width: 42000, height: 4420 });
  const { rect } = headerSpec(project, "Giãn xây");
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0);
  assert.ok(Math.abs(rect.width - 42000) < 1e-6);
  assert.ok(Math.abs(rect.width / rect.height - 16544 / 1838) < 1e-6);
  assert.ok(rect.height >= 4420 && rect.height < 4700);
  assert.equal(headerSpec(project, "Giãn xây", null), null);
  assert.equal(headerSpec(project, "Giãn xây", { x: 0, y: 0, width: 100, height: 5000 }), null);
  assert.equal(headerSpec("other", "Giãn xây"), null);
});
test("all original PNGs retain RGBA and the composite blocks the old header", async () => {
  for (const group of ["Giãn xây", "Xây thô", "Hoàn thiện"]) {
    const { src, rect, backing } = headerSpec(project, group);
    assert.deepEqual(backing.rect, MASTERPLAN_HEADER_CALIBRATION);
    assert.equal(backing.color, "#ffffff");
    const assetPath = fileURLToPath(new URL("../public" + src, import.meta.url));
    const meta = await sharp(assetPath).metadata();
    assert.equal(meta.width, 16544, group);
    assert.equal(meta.height, 1838, group);
    assert.equal(meta.hasAlpha, true, group);
    const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rows = Math.ceil(MASTERPLAN_HEADER_CALIBRATION.height * info.height / rect.height);
    let uncovered = 0, first = null, minAlpha = 255;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * info.channels + 3];
        minAlpha = Math.min(minAlpha, a);
        if (a < 254) { uncovered++; if (!first) first = { x, y, alpha: a }; }
      }
    }
    console.log("[header-alpha]", JSON.stringify({ group, rows, minAlpha, uncovered, first }));
    // Verify the PNG composite with its opaque backing, not the raw alpha alone.
    // Crop to the exact source footprint of the backing, not the PNG bleed.
    const region = { left: 0, top: 0, width: info.width, height: rows };
    const base = await sharp(assetPath).extract(region).flatten({ background: backing.color })
      .ensureAlpha().raw().toBuffer();
    assert.equal(base.length, info.width * rows * 4);
    let compositeTransparent = 0;
    for (let i = 3; i < base.length; i += 4) if (base[i] !== 255) compositeTransparent++;
    assert.equal(compositeTransparent, 0, group + " composite is not opaque");
    // Verify cover math also in screen coordinates; backing must not extend into bleed.
    const screen = projectHeaderRect(backing.rect, { x: 20, y: 30, width: 420 }, { scale: 2, tx: -11, ty: 5 });
    assert.equal(screen.x, 29);
    assert.equal(screen.y, 65);
    assert.equal(screen.width, 840);
    assert.ok(Math.abs(screen.height - 88.4) < 1e-8);
  }
});
