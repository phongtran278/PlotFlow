export const FLOORPLAN_ZOOM_MIN = 50;
export const FLOORPLAN_ZOOM_MAX = 2000;
export const FLOORPLAN_FRAME_WIDTH = 506;
export const FLOORPLAN_FRAME_HEIGHT = 390;
export const FLOORPLAN_FRAME_ASPECT = FLOORPLAN_FRAME_WIDTH / FLOORPLAN_FRAME_HEIGHT;

export function resolvePdfSourceUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Bạn chưa nhập link PDF.");

  let url;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : undefined;
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    throw new Error("Link PDF không hợp lệ.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PlotFlow chỉ hỗ trợ link http/https hoặc PDF trong project.");
  }

  const driveMatch = url.href.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    || url.href.match(/[?&]id=([^&]+)/);
  if (driveMatch) return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  return url.href;
}

export function calculateCropRect(pageRender, view, aspect = FLOORPLAN_FRAME_ASPECT) {
  const zoom = Math.max(FLOORPLAN_ZOOM_MIN, Math.min(FLOORPLAN_ZOOM_MAX, Number(view?.zoom) || 100));
  const pageWidthAtScale1 = pageRender.width / pageRender.scale;
  const baseWidthAtScale1 = Math.min(pageWidthAtScale1 * 0.38, 980 / 1.7);
  const cropWAtScale1 = baseWidthAtScale1 / (zoom / 100);

  let cropW = cropWAtScale1 * pageRender.scale;
  let cropH = cropW / aspect;
  if (cropH > pageRender.height) {
    cropH = pageRender.height;
    cropW = cropH * aspect;
  }
  if (cropW > pageRender.width) {
    cropW = pageRender.width;
    cropH = cropW / aspect;
  }

  const centerX = pageRender.anchorX + (Number(view?.offsetX) || 0);
  const centerY = pageRender.anchorY + (Number(view?.offsetY) || 0);
  const x = Math.max(0, Math.min(pageRender.width - cropW, centerX - cropW / 2));
  const y = Math.max(0, Math.min(pageRender.height - cropH, centerY - cropH / 2));
  return { x, y, w: cropW, h: cropH };
}
