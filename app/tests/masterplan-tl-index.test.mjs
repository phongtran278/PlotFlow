import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractUnitCodes, normalizeUnitCode } from "../src/floorplan/unitCode.js";
import { attachBboxMatchToPageRender } from "../src/floorplan/bboxLocator.js";
import { mergeTlHyphenIndex } from "../src/floorplan/mergeTlHyphenIndex.js";

const supplement = JSON.parse(fs.readFileSync(
  new URL("../public/masterplan/generated/tl-hyphen-index.json", import.meta.url),
  "utf8",
));

function makeManifest(index = {}) {
  return {
    index,
    pages: {
      "1": {
        width: supplement.pageSize.width,
        height: supplement.pageSize.height,
        sourceManifest: "hires-masterplan\\masterplan-42000px\\manifest.json",
        tiles: {
          sourceWidth: 42000,
          sourceHeight: 29709,
          tileSize: 512,
          levels: [1800, 2625, 5250, 10500, 21000, 42000].map((width) => ({ width })),
        },
      },
    },
  };
}

test("bundled TL hyphen index has 57 unique labels and a versioned runtime calibration", () => {
  assert.equal(supplement.codePatternVersion, 2);
  assert.equal(supplement.count, 57);
  assert.equal(supplement.entries.length, 57);
  assert.equal(supplement.coordinateCalibration.id, "vsp-masterplan-tiles-affine-v1");
  assert.equal(supplement.coordinateCalibration.sourcePdfSha256, supplement.sourceSha256);
  assert.equal(supplement.coordinateCalibration.runtimePdfSha256, "f47b1d378b20519e85e2574a6d45a45630839e21c2c968c744545e33ec639fb9");
  const codes = supplement.entries.map((entry) => entry.unitCode);
  assert.equal(new Set(codes).size, 57);
  assert.ok(codes.includes("TL-01"));
  assert.ok(codes.includes("TL-02"));
  assert.ok(codes.includes("TL-81"));
  assert.deepEqual(extractUnitCodes(codes.join(" ")).sort(), [...codes].sort());
  for (const entry of supplement.entries) {
    assert.equal(normalizeUnitCode(entry.unitCode), entry.unitCode);
    assert.match(entry.unitCode, /^TL-\d{1,5}$/);
    const { x0, y0, x1, y1 } = entry.bbox;
    assert.ok(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0);
    assert.ok(x1 <= supplement.pageSize.width && y1 <= supplement.pageSize.height);
  }
});

test("runtime merge calibrates supplemental and existing TL anchors to page-tile coordinates", () => {
  const manifest = makeManifest({
    "TL30-01": [{
      unitCode: "TL30-01",
      pageNumber: 1,
      x: 1178.0041715682055,
      y: 1376.5541256325937,
      width: 2.4592078106306325,
      height: 0.812995335809548,
    }],
    "TL31-02": [{
      unitCode: "TL31-02",
      pageNumber: 1,
      x: 1177.1412805018253,
      y: 1368.6342078160487,
      width: 2.45731901515177,
      height: 0.812995335809548,
    }],
    "AS10-01": [{ unitCode: "AS10-01", pageNumber: 1, x: 10, y: 20, width: 5, height: 2 }],
  });

  const merged = mergeTlHyphenIndex(manifest, supplement);
  const tl01 = merged.index["TL-01"][0];
  const tl30 = merged.index["TL30-01"][0];
  const tl31 = merged.index["TL31-02"][0];
  const as = merged.index["AS10-01"][0];
  const center = (box) => ({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 });

  assert.ok(Math.abs(center(tl01.bbox).x - 1298.1879) < 0.05);
  assert.ok(Math.abs(center(tl01.bbox).y - 965.3254) < 0.05);
  assert.ok(Math.abs(center(tl30.bbox).x - 1247.8463) < 0.05);
  assert.ok(Math.abs(center(tl30.bbox).y - 1059.8258) < 0.05);
  assert.ok(Math.abs(center(tl31.bbox).x - 1246.7328) < 0.05);
  assert.ok(Math.abs(center(tl31.bbox).y - 1069.6384) < 0.05);
  assert.equal(tl30.coordinateSpace, "runtime-page-top-left-points");
  assert.ok(tl30.sourceBbox, "original PDF bbox remains available for diagnostics");
  assert.equal(as.x, 10, "non-TL codes are not changed by the local TL calibration");
  assert.equal(as.bbox, undefined);
  assert.equal(Object.keys(merged.index).filter((code) => code.startsWith("TL-")).length, 57);
  assert.equal(merged.tlHyphenIndex.count, 57);
  assert.equal(merged.coordinateTransformId, supplement.coordinateCalibration.id);
});

test("bbox locator uses the calibrated text-box center at scaled viewport sizes", () => {
  const merged = mergeTlHyphenIndex(makeManifest(), supplement);
  const entry = merged.index["TL-01"][0];
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
  const result = attachBboxMatchToPageRender(pageBase, entry);
  const expectedX = ((entry.bbox.x0 + entry.bbox.x1) / 2) * scale;
  const expectedY = ((entry.bbox.y0 + entry.bbox.y1) / 2) * scale;
  assert.ok(Math.abs(result.anchorX - expectedX) < 0.001);
  assert.ok(Math.abs(result.anchorY - expectedY) < 0.001);
  assert.equal(result.anchorW, 0);
  assert.equal(result.anchorH, 0);
  assert.equal(result.unitCode, "TL-01");
});

test("runtime merge is idempotent and rejects a different tile source", () => {
  const merged = mergeTlHyphenIndex(makeManifest(), supplement);
  assert.equal(mergeTlHyphenIndex(merged, supplement), merged);

  const wrongTiles = makeManifest();
  wrongTiles.pages["1"].tiles.sourceWidth = 41000;
  assert.throws(() => mergeTlHyphenIndex(wrongTiles, supplement), /không khớp page-tile source/);
});

test("runtime merge rejects TL anchors outside the calibrated source region", () => {
  const manifest = makeManifest({
    "TL999-01": [{
      unitCode: "TL999-01",
      pageNumber: 1,
      x: 2500,
      y: 1300,
      width: 4,
      height: 1,
    }],
  });
  assert.throws(() => mergeTlHyphenIndex(manifest, supplement), /ngoài vùng hiệu chuẩn/);
});

test("Detail opens the shipped native manifest and preserves native lot coordinates", async (t) => {
  const { openVectorPdf, buildFloorplanIndex } = await import("../src/floorplan/pdfLocatorFacade.js");
  const manifest = JSON.parse(fs.readFileSync(
    new URL("../public/masterplan/generated/manifest.json", import.meta.url), "utf8",
  ));
  t.mock.method(globalThis, "fetch", async (url) => {
    const file = new URL(url, "https://staging.example").pathname;
    assert.ok(["/masterplan/generated/manifest.json", "/masterplan/generated/tl-hyphen-index.json"].includes(file));
    return Response.json(file.endsWith("/manifest.json") ? manifest : supplement);
  });
  const doc = await openVectorPdf("/masterplan/masterplan.pdf");
  assert.equal(doc.__plotflowRasterOnly, true);
  const index = await buildFloorplanIndex(doc);
  assert.equal(Object.keys(index).length, 10427);
  for (const code of ["AS48A-54", "AS80-03", "AS69-18", "AS70-17", "TL12-05", "TL12-51", "TL-01", "TL-81", "TL30-01", "TL31-02"]) {
    assert.ok(index[code]?.length, code);
    assert.deepEqual(index[code], manifest.index[code]);
  }
  manifest.nativeCoordinateSource.coordinateMode = "unexpected";
  await assert.rejects(() => openVectorPdf("/masterplan/masterplan.pdf"), /Native Masterplan source mismatch/);
});
