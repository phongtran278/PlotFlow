import test from "node:test";
import assert from "node:assert/strict";
import { renderOverviewExportBase } from "../src/product/renderOverviewExportBase.js";
import { MASTERPLAN_HEADER_SOURCE_SHA256 } from "../src/product/overviewMasterplanHeader.js";

test("Overview export composes the prepared level edge-to-edge without opening a PDF", async t => {
  const requests = [], draws = [];
  let closed = 0;
  const canvas = { getContext: () => ({ drawImage: (_, ...rect) => draws.push(rect) }) };
  t.mock.method(globalThis, "fetch", async url => {
    requests.push(url);
    if (url.endsWith("/manifest.json")) return Response.json({
      nativeCoordinateSource: { pdfSha256: MASTERPLAN_HEADER_SOURCE_SHA256 },
      pages: { "1": { tiles: {
        sourceWidth: 42000, sourceHeight: 29709, base: "/tiles",
        levels: [{ width: 1800, height: 1273, cols: 4, rows: 3, tileSize: 512 }],
      } } },
    });
    assert.match(url, /^\/tiles\/1800\/\d_\d\.webp$/);
    return new Response("test tile");
  });
  const oldDocument = globalThis.document, oldBitmap = globalThis.createImageBitmap;
  globalThis.document = { createElement: () => canvas };
  globalThis.createImageBitmap = async () => ({ close: () => closed++ });
  try {
    assert.equal(await renderOverviewExportBase(1000), canvas);
    assert.deepEqual([canvas.width, canvas.height], [1000, 707]);
    assert.equal(closed, 12);
    assert.equal(requests.length, 13);
    assert.equal(draws.reduce((sum, [, , w, h]) => sum + w * h, 0), 707000);
    const [x,y,w,h] = draws.at(-1);
    assert.deepEqual([x+w,y+h], [1000,707]);
  } finally {
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap;
  }
});
