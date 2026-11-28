// Coordinates are normalized to the source page, independent of camera and viewport.
const finite = (...values) => values.every(Number.isFinite);
export function cropToPagePoints(points, crop, page) {
  if (!Array.isArray(points) || points.length < 3 || !finite(crop.x,crop.y,crop.w,crop.h,page.width,page.height) || crop.w<=0 || crop.h<=0 || page.width<=0 || page.height<=0) throw Error("Invalid crop geometry");
  const result = points.map(p => ({x:(crop.x+p.x*crop.w)/page.width,y:(crop.y+p.y*crop.h)/page.height}));
  if (points.some(p=>!finite(p.x,p.y)||p.x<0||p.x>1||p.y<0||p.y>1) || result.some(p=>p.x<0||p.x>1||p.y<0||p.y>1)) throw Error("Invalid polygon coordinates");
  return result;
}
export function pageToStage(p,b) {
  if (!finite(p.x,p.y,b.x,b.y,b.width,b.height,b.stageWidth,b.stageHeight)||b.width<=0||b.height<=0||b.stageWidth<=0||b.stageHeight<=0) throw Error("Invalid overview bounds");
  return {x:100*(b.x+p.x*b.width)/b.stageWidth,y:100*(b.y+p.y*b.height)/b.stageHeight};
}
export function stageToPage(p,b) {
  pageToStage({x:0,y:0},b);
  return {x:(p.x*b.stageWidth/100-b.x)/b.width,y:(p.y*b.stageHeight/100-b.y)/b.height};
}
export function addAutoShape(shapes,shape) {
  const existing=shapes.find(s=>s.unitCode===shape.unitCode && s.autoSource==="native-masterplan");
  return existing ? {shapes,id:existing.id} : {shapes:[...shapes,shape],id:shape.id};
}
