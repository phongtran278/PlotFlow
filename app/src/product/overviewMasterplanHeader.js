// Shared native-coordinate geometry for Overview and Export.
// Measured on the canonical PDF at native scale. Green edge slopes from y=4411
// (left) to y=4252 (right); 4420 encloses the measured edge with a small margin.
// The full-width PNG is top-aligned, never stretched. Release requires alpha audit.
export const MASTERPLAN_HEADER_CALIBRATION = Object.freeze({ x: 0, y: 0, width: 42000, height: 4420 });
// Opaque paper backing prevents old PDF pixels showing through antialiased PNG edges.
export const MASTERPLAN_HEADER_BACKING_COLOR = "#ffffff";
export const MASTERPLAN_HEADER_SOURCE_SHA256 = "1a7f0462b384321487c8eaafc45e66853e797a4a5bb3198f633cb8d4d5ee1dfa";
export const MASTERPLAN_NATIVE = Object.freeze({ width: 42000, height: 29709 });
export const CANONICAL_MASTERPLAN_URL = "/masterplan/masterplan.pdf";
export const HEADER_PROJECT_ID = "vinhomes-saigon-park";
const HEADER_FILES = Object.freeze({
  "gian xay": "VSP_HEADER_GIAN_XAY_20261127_v01_cropped.png",
  "xay tho": "VSP_HEADER_XAY_THO_20261127_v01_cropped.png",
  "hoan thien": "VSP_HEADER_HOAN_THIEN_20261127_v01_cropped.png",
});
// Live sales sheets can use short handover labels rather than the default tab names.
const HEADER_GROUP_ALIASES = Object.freeze({
  "gian": "gian xay",
  "tho": "xay tho",
  "ht": "hoan thien",
});
const IMAGE = Object.freeze({ width: 16544, height: 1838 });

export function headerAsset(projectId, group) {
  if (projectId !== HEADER_PROJECT_ID) return null;
  const key = String(group ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
  const canonicalKey = Object.hasOwn(HEADER_GROUP_ALIASES, key) ? HEADER_GROUP_ALIASES[key] : key;
  if (!Object.hasOwn(HEADER_FILES, canonicalKey)) return null;
  return "/masterplan/headers/" + HEADER_FILES[canonicalKey];
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
  const covered = coverHeader(calibration);
  if (!covered || covered.width > MASTERPLAN_NATIVE.width + 1e-6
    || covered.height > MASTERPLAN_NATIVE.height) return null;
  // At page edges shift the uniform cover inside the page, not off-page.
  const rect = { ...covered,
    x: Math.max(0, Math.min(covered.x, MASTERPLAN_NATIVE.width - covered.width)),
    y: Math.max(0, Math.min(covered.y, MASTERPLAN_NATIVE.height - covered.height)),
  };
  const epsilon = 1e-6;
  if (rect.x > calibration.x + epsilon || rect.y > calibration.y + epsilon
    || rect.x + rect.width < calibration.x + calibration.width - epsilon
    || rect.y + rect.height < calibration.y + calibration.height - epsilon) return null;
  return { src, rect, backing: { rect: { ...calibration }, color: MASTERPLAN_HEADER_BACKING_COLOR } };
}

export function removeMasterplanHeader(stage) {
  stage?.querySelector(":scope > .pf-overview-masterplan-header")?.remove();
}

export function syncMasterplanHeader(stage, bounds, camera) {
  if (!stage) return;
  const spec = headerSpec(stage.dataset.overviewProjectId, stage.dataset.overviewGroup);
  const rect = spec && projectHeaderRect(spec.rect, bounds, camera);
  if (!rect) { removeMasterplanHeader(stage); return; }
  const backingRect = projectHeaderRect(spec.backing.rect, bounds, camera);
  if (!backingRect) { removeMasterplanHeader(stage); return; }
  let layer = stage.querySelector(":scope > .pf-overview-masterplan-header");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "pf-overview-masterplan-header";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "absolute", inset: "0", overflow: "hidden",
      pointerEvents: "none", zIndex: "2" });
    const backing = document.createElement("div");
    backing.className = "pf-overview-masterplan-header-backing";
    backing.style.position = "absolute";
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    Object.assign(img.style, { position: "absolute", maxWidth: "none",
      maxHeight: "none", objectFit: "fill", transform: "none" });
    layer.append(backing, img);
    stage.append(layer);
  }
  const [backing, img] = layer.children;
  function position(element, box) {
    Object.assign(element.style, { left: box.x + "px", top: box.y + "px",
      width: box.width + "px", height: box.height + "px" });
  }
  backing.style.backgroundColor = spec.backing.color;
  position(backing, backingRect);
  if (img.getAttribute("src") !== spec.src) img.setAttribute("src", spec.src);
  position(img, rect);
}
