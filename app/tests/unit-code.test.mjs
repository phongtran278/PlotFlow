import test from "node:test";
import assert from "node:assert/strict";
import { extractUnitCodes, normalizeUnitCode } from "../src/floorplan/unitCode.js";

test("recognizes hyphenated TL lot codes alongside existing lot-code formats", () => {
  assert.deepEqual(
    extractUnitCodes("TL-01 TL-02 TL-81 TL30-01 TL31-02 AS10-01"),
    ["TL-01", "TL-02", "TL-81", "TL30-01", "TL31-02", "AS10-01"],
  );
});

test("normalizes spacing and case before extracting lot codes", () => {
  assert.equal(normalizeUnitCode(" tl - 01 "), "TL-01");
  assert.deepEqual(
    extractUnitCodes(" tl - 01 / tl30 - 02 "),
    ["TL-01", "TL30-02"],
  );
});

test("extracts multiple codes from a single PDF text item and preserves repeated hits", () => {
  assert.deepEqual(
    extractUnitCodes("TL-01 · TL30-01 · TL-01"),
    ["TL-01", "TL30-01", "TL-01"],
  );
});

test("does not accept malformed or embedded code fragments", () => {
  assert.deepEqual(extractUnitCodes("XTL-01 TL- TL-ABC TL30- AS10-"), []);
});
