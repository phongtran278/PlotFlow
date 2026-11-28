export function attachBboxMatchToPageRender(pageBase, match) {
  if (!pageBase?.__plotflowPrepared || !match?.bbox) return null;
  const box = match.bbox;
  const pageHeight = Number(pageBase.viewport.height) / Math.max(0.0001, Number(pageBase.scale) || 1);
  const centerX = (Number(box.x0) + Number(box.x1)) / 2;
  const centerYFromBottom = pageHeight - (Number(box.y0) + Number(box.y1)) / 2;
  const [anchorX, anchorY] = pageBase.viewport.convertToViewportPoint(centerX, centerYFromBottom);
  return {
    ...pageBase,
    anchorX,
    anchorY,
    anchorW: 0,
    anchorH: 0,
    __plotflowPrepared: true,
    unitCode: match.unitCode,
    locatorBounds: box,
  };
}
