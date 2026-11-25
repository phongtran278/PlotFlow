import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {normalizeRow,parseCSV,parseWorkbookUnits,getGoogleSheetCSVUrl} from '../src/core/sales/unitImport.js';

test('Vietnamese and legacy field aliases preserve existing unit contract',()=>{
 const row=normalizeRow({'Mã căn':' 00015 ','LOẠI HÌNH SẢN PHẨM':' Liền kề ','SỐ TẦNG':4,'DT ĐẤT M2':125.5,'DTXD M2':200,'Giá TT chuẩn':12345678900,'Giá TT sớm':0,'Mã mẫu nhà':' CH-71 ','Tên mẫu nhà':' Nhật Bản ','TIÊU CHUẨN BÀN GIAO':' Hoàn thiện '});
 assert.equal(row.unitCode,'00015');assert.equal(row.type,'Liền kề');assert.equal(row.floors,4);assert.equal(row.landArea,125.5);assert.equal(row.constructionArea,200);assert.equal(row.priceStandard,12345678900);assert.equal(row.priceEarly,0);assert.equal(row.houseModel,'CH-71');assert.equal(row.architectureCode,'CH-71');assert.equal(row.architectureLabel,'Nhật Bản');assert.equal(row.handover,'Hoàn thiện');
});
test('canonical fields take precedence, including explicit empty strings and zero',()=>{
 const row=normalizeRow({unitCode:'CH-01',MA_CAN:'other',priceStandard:0,TIEN_DO_CHUAN:50,houseModel:'',houseName:'fallback',landArea:0,DT_DAT_M2:99});
 assert.equal(row.unitCode,'CH-01');assert.equal(row.priceStandard,0);assert.equal(row.houseModel,'');assert.equal(row.landArea,0);
 assert.equal(normalizeRow({}).unitCode,'');assert.equal(normalizeRow({}).priceStandard,'');
});
test('existing 30/36-month alias compatibility is preserved without changing payment rules',()=>{
 assert.deepEqual([normalizeRow({VAY_70_30T:30}).price30,normalizeRow({VAY_70_30T:30}).price36],[30,30]);
 assert.deepEqual([normalizeRow({VAY_70_36T:36}).price30,normalizeRow({VAY_70_36T:36}).price36],[36,36]);
 const r=normalizeRow({price30:30,price36:36});assert.equal(r.price30,30);assert.equal(r.price36,36);
});
test('Excel import prioritizes nonempty UNITS sheet, retains leading zeros and ignores blank codes',()=>{
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['MA_CAN'],['A'],['B'],['C']]),'Other');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Mã căn','Giá TT chuẩn'],['00015','12345678900'],['','999']]),' units ');
 const result=parseWorkbookUnits(wb,XLSX);
 assert.equal(result.sheetName,' units ');assert.equal(result.units.length,1);assert.equal(result.units[0].unitCode,'00015');assert.equal(result.units[0].priceStandard,'12345678900');
});
test('Excel falls back to sheet with most valid units and returns empty for no units',()=>{
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Note'],['none']]),'UNITS');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['MA_CAN'],['P-01']]),'A');
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['MA_CAN'],['P-01'],['P-02']]),'B');
 assert.equal(parseWorkbookUnits(wb,XLSX).sheetName,'B');
 assert.deepEqual(parseWorkbookUnits(XLSX.utils.book_new(),XLSX),{units:[],sheetName:''});
});
test('CSV import processes the first worksheet and filters invalid unit codes',async()=>{
 const units=await parseCSV('MA_CAN,TIEN_DO_CHUAN,LOAI_HINH_SAN_PHAM\nQA-01,12345678900,Liền kề\n,123,Khác\nQA-02,0,Song lập\n');
 assert.deepEqual(units.map(u=>u.unitCode),['QA-01','QA-02']);assert.equal(units[0].priceStandard,12345678900);assert.equal(units[1].priceStandard,0);assert.equal(units[0].type,'Liền kề');
});
test('Google Sheets CSV URL conversion is pure and preserves existing query rules',()=>{
 assert.equal(getGoogleSheetCSVUrl(' https://docs.google.com/spreadsheets/d/fixture-id/edit#gid=42 '),'https://docs.google.com/spreadsheets/d/fixture-id/export?format=csv&gid=42');
 assert.equal(getGoogleSheetCSVUrl('https://docs.google.com/spreadsheets/d/fixture-id/edit'),'https://docs.google.com/spreadsheets/d/fixture-id/export?format=csv&gid=0');
 const url='https://docs.google.com/spreadsheets/d/fixture-id/pub?output=csv';assert.equal(getGoogleSheetCSVUrl(url),url);
 assert.throws(()=>getGoogleSheetCSVUrl(' '),/nhập link/);assert.throws(()=>getGoogleSheetCSVUrl('not-a-sheet'),/không hợp lệ/);
});
test('independent import calls do not share mutable row data across synthetic projects',()=>{
 const a=normalizeRow({unitCode:'QA-01',priceStandard:100}),b=normalizeRow({unitCode:'QA-01',priceStandard:200});
 a.priceStandard=300;assert.equal(b.priceStandard,200);
});
