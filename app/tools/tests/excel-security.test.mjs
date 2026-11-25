import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

test('Excel roundtrip preserves Vietnamese text, unit codes, numeric values and empty cells', () => {
  const rows=[
    {'Mã căn':'CH-071','Diện tích':125.75,'Giá bán':12345678900,'Ghi chú':'Sân vườn – góc','Thanh toán':0.15},
    {'Mã căn':'00015','Diện tích':81,'Giá bán':0,'Ghi chú':'','Thanh toán':0},
    {'Mã căn':'CH-019','Diện tích':90.5,'Giá bán':9000000000,'Ghi chú':'Liền kề','Thanh toán':0.3}
  ];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Giỏ hàng');
  const exported=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const parsed=XLSX.read(exported,{type:'array'});
  assert.deepEqual(parsed.SheetNames,['Giỏ hàng']);
  const actual=XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]],{defval:''});
  assert.deepEqual(actual,rows);
  assert.equal(typeof actual[0]['Giá bán'],'number');
  assert.equal(typeof actual[1]['Mã căn'],'string');
});
test('Excel workbook multiple sheets and blank cells remain compatible',()=>{
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Mã căn','Giá'],['00001',null],['CH02',42]]),'Dữ liệu');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Mẫu nhà'],['CH71']]),'Mẫu nhà');
  const data=XLSX.read(XLSX.write(wb,{type:'array',bookType:'xlsx'}),{type:'array'});
  assert.deepEqual(data.SheetNames,['Dữ liệu','Mẫu nhà']);
  assert.deepEqual(XLSX.utils.sheet_to_json(data.Sheets['Dữ liệu'],{defval:''}),[{'Mã căn':'00001','Giá':''},{'Mã căn':'CH02','Giá':42}]);
});
