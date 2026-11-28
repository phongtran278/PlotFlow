import test from "node:test";
import assert from "node:assert/strict";
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
test("unverified calibration stays disabled; reject bleed outside page", () => {
  assert.equal(MASTERPLAN_HEADER_CALIBRATION, null);
  assert.equal(headerSpec(project, "Giãn xây"), null);
  assert.equal(headerSpec(project, "Giãn xây", { x: 0, y: 0, width: 100, height: 100 }), null);
  assert.ok(headerSpec(project, "Giãn xây", { x: 10000, y: 1000, width: 8000, height: 500 }));
  assert.equal(headerSpec("other", "Giãn xây", { x: 10000, y: 1000, width: 8000, height: 500 }), null);
});
