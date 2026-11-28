import { detectNativeLotShape } from "../floorplan/detectNativeLotShape.js";
import { resolveUnitsAgainstIndex, normalizeUnitCode } from "../floorplan/unitCodeCompat.js";
import { mergeTlHyphenIndex } from "../floorplan/mergeTlHyphenIndex.js";
import { cropToPagePoints } from "./overviewAutoShapeGeometry.js";

let manifestPromise;
function loadManifest() {
  if (!manifestPromise) manifestPromise=Promise.all(["/masterplan/generated/manifest.json?v=native-10427-v1","/masterplan/generated/tl-hyphen-index.json"].map(async url=>{
    const r=await fetch(url,{cache:"no-store"});
    if(!r.ok) throw Error("Masterplan manifest unavailable");
    return r.json();
  })).then(([m,t])=>mergeTlHyphenIndex(m,t)).catch(e=>{manifestPromise=null;throw e;});
  return manifestPromise;
}
export async function detectOverviewShape(rawCode, isCurrent) {
  const code=normalizeUnitCode(rawCode);
  const manifest=await loadManifest();
  if(!isCurrent()) return null;
  if(!manifest.nativeCoordinateSource) throw Error("Native Masterplan required");
  const page=manifest.pages["1"];
  const matches=resolveUnitsAgainstIndex([{unitCode:code}],manifest.index)[code]?.matches||[];
  let overrides={};
  try { overrides=JSON.parse(localStorage.getItem("plotflow-floorplan-overrides-v6")||"{}")||{}; } catch {}
  const index=Math.min(matches.length-1,Math.max(0,Math.trunc(Number(overrides[code]?.selectedMatchIndex)||0)));
  const match=matches[index];
  if(!match || Number(match.pageNumber||1)!==1) throw Error("Unit not located");
  const x=match.bbox?(Number(match.bbox.x0)+Number(match.bbox.x1))/2:Number(match.x)+Number(match.width)/2;
  const y=match.bbox?(Number(match.bbox.y0)+Number(match.bbox.y1))/2:Number(page.height)-Number(match.y)-Number(match.height)/2;
  const width=Number(page.width),height=Number(page.height);
  const detection = await detectNativeLotShape({
    __plotflowPrepared: true, pageNumber: 1, width, height, scale: 1, anchorX: x, anchorY: y, unitCode: code,
  }, isCurrent);
  if (!detection) return null;
  if (!detection.result.accepted) throw Error("No reliable closed boundary; use manual Highlight");
  return cropToPagePoints(detection.result.shape.points, detection.crop, { width, height });
}
