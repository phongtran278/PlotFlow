import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { attachMatchToPageRender, resolveUnitsAgainstIndex } from "../src/floorplan/pdfLocatorFacade.js";

const supplement = JSON.parse(fs.readFileSync(
  new URL("../public/masterplan/generated/tl-hyphen-index.json", import.meta.url),
  "utf8",
));

test("bundled TL hyphen index has 57 unique, bounded lot labels", () => {
  assert.equal(supplement.codePatternVersion, 2);
  assert.equal(supplement.count, 57);
  assert.equal(supplement.entries.length, 57);
  const codes = supplement.entries.map((entry) => entry.unitCode);
  assert.equal(new Set(codes).size, 57);
  assert.ok(codes.includes("TL-01"));
  assert.ok(codes.includes("TL-02"));
  assert.ok(codes.includes("TL-81"));
  for (const entry of supplement.entries) {
    assert.match(entry.unitCode, /^TL-\d{1,5}$/);
    const { x0, y0, x1, y1 } = entry.bbox;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0);
    assert.ok(x1 <= supplement.pageSize.width && y1 <= supplement.pageSize.height);
  }
});

test("hyphenated TL entries resolve through the existing unit resolver", () => {
  const entry = supplement.entries.find((item) => item.unitCode === "TL-01");
  const result = resolveUnitsAgainstIndex(
    [{ unitCode: "TL-01" }],
    { "TL-01": [entry] },
  );
  assert.equal(result["TL-01"].status, "ready");
  assert.equal(result["TL-01"].matches.length, 1);
});

test("bbox locator uses the exact text-box center at scaled viewport sizes", () => {
  const entry = supplement.entries.find((item) => item.unitCode === "TL-01");
  const scale = 2.5;
  const pageHeight = supplement.pageSize.height;
  const pageBase = {
    pageNumber: 1,
    width: supplement.pageSize.width * scale,
    height: pageHeight * scale,
    scale,
    __plotflowPrepared: true,
    viewport: {
      height: pageHeight * scale,
      convertToViewportPoint(x, y) {
        return [x * scale, (pageHeight - y) * scale];
      },
    },
  };
  const result = attachMatchToPageRender(pageBase, entry);
  const expectedX = ((entry.bbox.x0 + entry.bbox.x1) / 2) * scale;
  const expectedY = ((entry.bbox.y0 + entry.bbox.y1) / 2) * scale;
  assert.ok(Math.abs(result.anchorX - expectedX) < 0.001);
  assert.ok(Math.abs(result.anchorY - expectedY) < 0.001);
  assert.equal(result.anchorW, 0);
  assert.equal(result.anchorH, 0);
});
