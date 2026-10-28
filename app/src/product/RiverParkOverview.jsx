import { useEffect, useMemo, useRef, useState } from "react";

const BLOCKS = [
  ["C1",.94,.65],["C2",.75,.18],["C3",.75,.71],["C4",.63,.33],
  ["C5",.63,.55],["C6",.55,.55],["C7",.55,.31],["C8",.47,.55],
  ["C9",.47,.31],["C10",.39,.55],["C11",.39,.31],["C12",.30,.71],
  ["C13",.33,.55],["C14",.26,.55],["C15",.20,.55],["C16",.26,.38],
  ["C17",.27,.28],["C18",.27,.17]
];
const BLOCK_MAP = Object.fromEntries(BLOCKS.map(([code,x,y]) => [code,{x,y}]));
const ASSET = "/assets/projects/la-home-river-park/masterplan.webp";
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export default function RiverParkOverview() {
  const [query,setQuery]=useState("");
  const [scale,setScale]=useState(1);
  const [focus,setFocus]=useState({x:.5,y:.5});
  const [missing,setMissing]=useState(false);
  const [localAsset,setLocalAsset]=useState(null);
  useEffect(()=>()=>{if(localAsset) URL.revokeObjectURL(localAsset);},[localAsset]);
  const [drag,setDrag]=useState(null);
  const viewport=useRef(null);
  const parsed=useMemo(()=>{
    const normalized=query.trim().toUpperCase().replace(/\s+/g,"");
    const match=normalized.match(/^(C(?:1[0-8]|[1-9]))(?:[-/.]?(\d+))?$/);
    return match ? {block:match[1],lot:match[2]||null,...BLOCK_MAP[match[1]]} : null;
  },[query]);
  const jump=(entry=parsed)=>{
    if(!entry)return;
    setScale(3.5);
    setFocus({x:entry.x,y:entry.y});
  };
  function wheel(event) {
    if(!event.ctrlKey && !event.metaKey)return;
    event.preventDefault();
    setScale(s=>clamp(s*(event.deltaY<0?1.18:1/1.18),1,8));
  }
  function move(event) {
    if(!drag || !viewport.current)return;
    const r=viewport.current.getBoundingClientRect();
    setFocus({x:clamp(drag.x-(event.clientX-drag.clientX)/(r.width*scale),0,1),y:clamp(drag.y-(event.clientY-drag.clientY)/(r.height*scale),0,1)});
  }
  return <main className="pf-riverpark">
    <div className="pf-riverpark-bar">
      <div><strong>LA HOME – RIVER PARK</strong><small>Masterplan · C1–C18</small></div>
      <form onSubmit={e=>{e.preventDefault();jump();}}>
        <input aria-label="Tìm dãy hoặc mã lô" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nhập C17 hoặc C17-12" />
        <button type="submit" disabled={!parsed}>Tìm & zoom</button>
      </form>
      <div className="pf-riverpark-zoom">
        <button onClick={()=>setScale(s=>clamp(s/1.5,1,8))}>−</button><span>{Math.round(scale*100)}%</span><button onClick={()=>setScale(s=>clamp(s*1.5,1,8))}>+</button>
        <button onClick={()=>{setScale(1);setFocus({x:.5,y:.5});}}>Vừa khung</button>
      </div>
    </div>
    <div className="pf-riverpark-info">{parsed?.lot ? "Đã xác định dãy "+parsed.block+". Chưa có tọa độ chính xác cho lô số "+parsed.lot+"; chỉ zoom đến dãy, không suy đoán vị trí lô." : parsed ? "Chọn Tìm & zoom để tới dãy "+parsed.block+"." : "Chọn một dãy trên bản đồ hoặc tìm theo mã. Giữ Ctrl và lăn chuột để zoom."}</div>
    <div ref={viewport} className="pf-riverpark-viewport" onWheel={wheel} onPointerMove={move} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)} onPointerLeave={()=>setDrag(null)} onPointerDown={e=>{if(scale<=1)return;viewport.current?.setPointerCapture(e.pointerId);setDrag({clientX:e.clientX,clientY:e.clientY,...focus});}}>
      {missing && !localAsset ? <div className="pf-riverpark-missing"><div><p>Ảnh masterplan chưa được đưa vào kho assets GitHub.</p><label>Chọn ảnh mặt bằng WebP / PNG để xem ngay trên máy này <input type="file" accept="image/webp,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0];if(file){setLocalAsset(URL.createObjectURL(file));setMissing(false);}}}/></label><p>Ảnh tải cục bộ sẽ không tự đồng bộ sang thiết bị khác.</p></div></div> : <div className="pf-riverpark-map" style={{transform:"translate("+((.5-focus.x)*scale*100)+"%, "+((.5-focus.y)*scale*100)+"%) scale("+scale+")"}}>
        <img src={localAsset || ASSET} onError={()=>setMissing(true)} alt="Tổng mặt bằng River Park" draggable={false}/>
        {BLOCKS.map(([code,x,y])=><button key={code} className="pf-riverpark-pin" style={{left:(x*100)+"%",top:(y*100)+"%"}} onPointerDown={e=>e.stopPropagation()} onClick={()=>{setQuery(code);jump({x,y});}} aria-label={"Zoom đến dãy "+code}>{code}</button>)}
      </div>}
    </div>
    <div className="pf-riverpark-footer">Nguồn: bản vẽ mặt bằng River Park A3 do chủ workspace cung cấp. Chưa có bảng hàng xác minh để định vị từng lô và trạng thái giao dịch.</div>
  </main>;
}
