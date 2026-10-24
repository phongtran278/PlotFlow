export const testPage = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PlotFlow · State API Test</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#19232e;background:#f7f8fa}*{box-sizing:border-box}
main{max-width:760px;margin:36px auto;padding:0 18px}header{margin-bottom:24px}h1{font-size:26px;letter-spacing:-.7px;margin:8px 0}
p{line-height:1.6;color:#536174}section{background:white;border:1px solid #e4e7ed;border-radius:16px;margin:12px 0;padding:20px}
button{border:0;border-radius:10px;background:#1765d8;color:white;padding:12px 16px;font-weight:650;cursor:pointer;margin:4px 5px 4px 0}
button:disabled{opacity:.4;cursor:not-allowed}.ghost{background:#eaf1ff;color:#1450ab}
label{display:block;margin:10px 0;font-size:14px}code,pre{font-family:ui-monospace,SFMono-Regular,monospace}
pre{padding:14px;border-radius:10px;background:#131c2b;color:#e5efff;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12px}
small{color:#64748b}.status{font-weight:650}.warning{color:#986b04}
</style></head><body><main>
<header><small>STAGING · Không dùng dữ liệu thật</small><h1>PlotFlow · Kiểm tra lưu dữ liệu</h1>
<p>Thử đọc, lưu một giá trị mẫu và xác nhận API ngăn ghi đè từ phiên bản cũ. Công cụ chỉ dành cho Worker thử nghiệm đã được bảo vệ bằng Cloudflare Access.</p></header>
<section><h2>1. Đọc dữ liệu</h2><button id="read">Đọc bản hiện tại</button><p id="readState" class="status">Chưa đọc</p></section>
<section><h2>2. Lưu bản thử nghiệm</h2>
<label><input type="checkbox" id="confirm"> Tôi xác nhận Secret AZURE_BLOB_URLS_JSON chỉ trỏ tới container plotflow-staging và đồng ý ghi dữ liệu mẫu.</label>
<button id="save" disabled>Lưu bản thử nghiệm</button>
<p id="saveState" class="status">Chưa lưu</p></section>
<section><h2>3. Thử chống ghi đè</h2><button id="conflict" disabled>Thử ghi bằng phiên bản cũ</button>
<p id="conflictState" class="status">Chưa thử</p></section>
<section><h2>Nhật ký kết quả</h2><pre id="log">Chưa có thao tác.</pre>
<small>Không hiển thị Azure SAS, JWT hoặc nội dung storage. Nếu báo 401/403, kiểm tra đăng nhập và quyền dự án.</small></section>
</main><script type="module">
const path='/v1/projects/vinhomes-saigon-park/state';
const $=id=>document.getElementById(id);
let baseline=null;let afterSave=false;let busy=false;
const log=(text)=>{$('log').textContent=new Date().toLocaleTimeString('vi-VN')+' · '+text+'\\n'+($('log').textContent==='Chưa có thao tác.'?'':$('log').textContent).slice(0,5000)};
function controls(){ $('save').disabled=busy||!baseline||afterSave||!$('confirm').checked; $('conflict').disabled=busy||!afterSave||!baseline; $('read').disabled=busy}
async function responseJSON(response){return response.json().catch(()=>({error:'invalid_response'}))}
async function read(){busy=true;controls();try{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
  const data=await responseJSON(response);
  const etag=response.headers.get('etag');
  if(!response.ok||!etag||data.projectId!=='vinhomes-saigon-park') throw Error('GET '+response.status+' '+(data.error||'missing_etag'));
  baseline={etag: /^0x[0-9a-f]+$/i.test(etag) ? '"'+etag+'"' : etag,state:data};afterSave=false;
  $('readState').textContent='Đã đọc thành công · ETag nhận được';
  $('saveState').textContent='Chưa lưu';$('conflictState').textContent='Chưa thử';
  log('GET 200, đã lấy phiên bản hiện tại. Không hiển thị dữ liệu.');
}catch(error){baseline=null;afterSave=false;$('readState').textContent='Không đọc được: '+error.message;log('GET thất bại: '+error.message)}
finally{busy=false;controls()}}
async function write(stale=false){if(!baseline||busy||(!stale&&(!$('confirm').checked||afterSave)))return;
busy=true;controls();
try{
  const next=structuredClone(baseline.state);
  if(!stale){next.storage['plotflow-staging-api-smoke-v1']=JSON.stringify({test:'state-write',at:new Date().toISOString()});next.updatedAt=new Date().toISOString();}
  else {next.storage['plotflow-staging-api-smoke-v1']=JSON.stringify({test:'stale-should-not-commit'});}
  const response=await fetch(path,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json','If-Match':baseline.etag},body:JSON.stringify(next)});
  const result=await responseJSON(response);
  if(stale){
    if(response.status===412&&result.error==='version_conflict'){$('conflictState').textContent='PASS · 412: API chặn ghi đè';log('PASS: stale If-Match → 412 version_conflict')}
    else {$('conflictState').textContent='FAIL · Nhận HTTP '+response.status;log('FAIL: stale update → HTTP '+response.status);}
  }else if(response.ok&&result.saved===true){
    afterSave=true;$('saveState').textContent='PASS · Dữ liệu thử đã lưu';
    log('PUT '+response.status+' thành công. Giữ nguyên ETag cũ để kiểm tra xung đột.');
  }else{$('saveState').textContent='Không lưu được · HTTP '+response.status;log('PUT '+response.status+' '+(result.error||'')+' '+(result.reason||''))}
}catch(error){log('Lỗi: '+error.message);(stale?$('conflictState'):$('saveState')).textContent='Lỗi: '+error.message}
finally{busy=false;controls()}}
$('read').addEventListener('click',read);$('save').addEventListener('click',()=>write(false));$('conflict').addEventListener('click',()=>write(true));$('confirm').addEventListener('change',controls);
</script></body></html>`;
