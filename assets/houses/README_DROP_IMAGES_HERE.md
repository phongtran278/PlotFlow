# DROP HOUSE IMAGES HERE

Bỏ ảnh mẫu nhà trực tiếp vào thư mục này.

Tên file phải theo `HOUSE_ASSET_16_MODELS.csv` hoặc quy chuẩn trong `HOUSE_ASSET_CHECKLIST.md`.

Sau khi thêm / đổi tên ảnh:

```bash
cd app
npm run setup
npm run dev
```

PlotFlow sẽ tự quét `assets/houses/` và sinh catalog. Không cần thêm entry bằng tay trong code.

Nếu một căn có biến thể riêng, thêm suffix sau loại hình, ví dụ:
- `CH59_LK_XE_KHE.jpg`
- `CH59_LK_CAN_GOC.jpg`
- `CH53_LK_SHOPHOUSE.jpg`
