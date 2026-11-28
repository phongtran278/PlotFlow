// Shared native-coordinate geometry for Overview and Export.
// Keep disabled until the canonical PDF and all three alpha footprints are verified.
export const MASTERPLAN_HEADER_CALIBRATION = null;
export const MASTERPLAN_NATIVE = Object.freeze({ width: 42000, height: 29709 });
export const CANONICAL_MASTERPLAN_URL = "/masterplan/masterplan.pdf";
export const HEADER_PROJECT_ID = "vinhomes-saigon-park";
const HEADER_FILES = Object.freeze({
  "gian xay": "VSP_HEADER_GIAN_XAY_20261127_v01_cropped.png",
  "xay tho": "VSP_HEADER_XAY_THO_20261127_v01_cropped.png",
  "hoan thien": "VSP_HEADER_HOAN_THIEN_20261127_v01_cropped.png",
});
const IMAGE = Object.freeze({ width: 16544, height: 1838 });

export function headerAsset(projectId, group) {
  if (projectId !== HEADER_PROJECT_ID) return null;
  const key = String(group ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
  if (!Object.hasOwn(HEADER_FILES, key)) return null;
  return "/masterplan/headers/" + HEADER_FILES[key];
}

export function coverHeader(rect, image = IMAGE) {
  if (!rect || !image) return null;
  const { x, y, width, height } = rect;
  if (![x, y, width, height, image.width, image.height].every(Number.isFinite)
    || width <= 0 || height <= 0 || image.width <= 0 || image.height <= 0) return null;
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale, h = image.height * scale;
  return { x: x + (width - w) / 2, y: y + (height - h) / 2, width: w, height: h };
}

export function projectHeaderRect(rect, bounds, camera = { scale: 1, tx: 0, ty: 0 }) {
  if (!rect || !bounds || !camera) return null;
  const { scale, tx, ty } = camera;
  const fit = bounds.width / MASTERPLAN_NATIVE.width;
  if (![bounds.x, bounds.y, fit, scale, tx, ty].every(Number.isFinite) || fit <= 0 || scale <= 0) return null;
  return {
    x: tx + (bounds.x + rect.x * fit) * scale,
    y: ty + (bounds.y + rect.y * fit) * scale,
    width: rect.width * fit * scale,
    height: rect.height * fit * scale,
  };
}

export function headerSpec(projectId, group, calibration = MASTERPLAN_HEADER_CALIBRATION) {
  const src = headerAsset(projectId, group);
  if (!src || !calibration) return null;
  const rect = coverHeader(calibration);
  if (!rect || rect.x < 0 || rect.y < 0
    || rect.x + rect.width > MASTERPLAN_NATIVE.width
    || rect.y + rect.height > MASTERPLAN_NATIVE.height) return null;
  return { src, rect };
}

export function removeMasterplanHeader(stage) {
  stage?.querySelector(":scope > .pf-overview-masterplan-header")?.remove();
}

export function syncMasterplanHeader(stage, bounds, camera) {
  if (!stage) return;
  const spec = headerSpec(stage.dataset.overviewProjectId, stage.dataset.overviewGroup);
  const rect = spec && projectHeaderRect(spec.rect, bounds, camera);
  if (!rect) { removeMasterplanHeader(stage); return; }
  let img = stage.querySelector(":scope > .pf-overview-masterplan-header");
  if (!img) {
    img = document.createElement("img");
    img.className = "pf-overview-masterplan-header";
    img.alt = "";
    img.draggable = false;
    img.setAttribute("aria-hidden", "true");
    Object.assign(img.style, { position: "absolute", pointerEvents: "none", zIndex: "2",
      maxWidth: "none", maxHeight: "none", objectFit: "fill", transform: "none" });
    stage.append(img);
  }
  if (img.getAttribute("src") !== spec.src) img.setAttribute("src", spec.src);
  Object.assign(img.style, { left: rect.x + "px", top: rect.y + "px",
    width: rect.width + "px", height: rect.height + "px" });
}
