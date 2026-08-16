# PlotFlow House Asset Pack

## Quy chuẩn tên file

Đặt file trực tiếp trong `assets/houses/` theo khóa kỹ thuật:

`CH{mã}_{LOẠI HÌNH}_{BIẾN THỂ}.{png|jpg|webp}`

PlotFlow chạy `npm run setup` sẽ tự sinh ID dạng `HOUSE_<TÊN_FILE_KHÔNG_EXT>`.

### Token chuẩn
- `LK` = Liền kề
- `SONG_LAP` = Song lập
- `DON_LAP` = Đơn lập
- `SHOPHOUSE` = Shophouse
- `XE_KHE` = Xẻ khe
- `CAN_GOC` = Căn góc
- `SAN_VUON` = Sân vườn (chỉ dùng nếu thực sự là một asset khác)

Tên phong cách như `TÂN CỔ ĐIỂN`, `HIỆN ĐẠI NHIỆT ĐỚI`, `HÀN QUỐC` chỉ là label hiển thị; KHÔNG dùng làm khóa match ảnh.

## Bộ asset cần cho 14 căn demo hiện tại

| File cần có | Kiến trúc hiển thị | Căn đang dùng |
|---|---|---|
| `CH53_LK.jpg` | Liền kề - Tân cổ điển | AS50-08, AS80-20, AS76-08 |
| `CH13_LK.jpg` | Liền kề - Đông Âu | AS63-19, AS86-45 |
| `CH59_LK.jpg` | Liền kề - Hiện đại nhiệt đới | TL32-19 |
| `CH15_LK.jpg` | Liền kề - Hàn Quốc | TL12-05, TL12-101 |
| `CH19_LK.jpg` | Liền kề - Hội An | TL7-25 |
| `CH59_LK_XE_KHE.jpg` | Liền kề - Hiện đại nhiệt đới | TL10-55 |
| `CH75_LK.jpg` | Liền kề - Hiện đại xanh | TL3-33, TL5-27 |
| `CH59_LK_CAN_GOC.jpg` | Liền kề - Hiện đại nhiệt đới | TL9-41 |
| `CH75_SONG_LAP.jpg` | Song lập - Hiện đại xanh | ĐLCV2-14 |

Bạn có thể dùng `.png`, `.jpg`, `.jpeg` hoặc `.webp`; phần stem trước extension phải theo đúng quy chuẩn.

## Workflow bổ sung nhanh
1. Tìm đúng ảnh facade/mẫu nhà.
2. Đổi tên theo bảng trên.
3. Bỏ trực tiếp vào `assets/houses/`.
4. Chạy `cd app && npm run setup`.
5. Reload PlotFlow. Nếu key đúng, trạng thái `MISSING HOUSE ASSET` sẽ tự biến mất và ảnh đúng được chèn lên poster.

## Về bản đồ kiến trúc tổng
Bản định vị kiến trúc có nhiều nhóm hơn bộ 14 căn demo. Checklist này ưu tiên các key thực sự cần cho demo hiện tại để bạn sourcing nhanh. Khi bổ sung các mẫu còn lại, tiếp tục cùng quy chuẩn `CH + loại hình + biến thể`; không cần đổi code.
