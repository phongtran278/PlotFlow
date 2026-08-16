# PlotFlow House Asset Pack — 16 nhóm kiến trúc

Nguồn: bản `260611_TMB dinh vi mau nha_DA VH Saigon Park.jpg`.

## Quy chuẩn tên file

Đặt file trực tiếp trong `assets/houses/` theo khóa kỹ thuật:

`CH{mã}_{LOẠI HÌNH}_{BIẾN THỂ}.{png|jpg|jpeg|webp}`

PlotFlow chạy `npm run setup` sẽ tự sinh ID dạng `HOUSE_<TÊN_FILE_KHÔNG_EXT>`.

### Token chuẩn
- `LK` = Liền kề
- `SONG_LAP` = Biệt thự song lập / song lập
- `DON_LAP` = Biệt thự đơn lập / đơn lập
- `SHOPHOUSE` = Shophouse
- `XE_KHE` = Xẻ khe
- `CAN_GOC` = Căn góc
- `SAN_VUON` = Sân vườn, chỉ dùng khi thực sự có asset riêng

Tên phong cách như `TÂN CỔ ĐIỂN`, `HIỆN ĐẠI NHIỆT ĐỚI`, `HÀN QUỐC` chỉ là label hiển thị; KHÔNG dùng làm khóa match ảnh.

## 16 nhóm mẫu nhà trên bản định vị kiến trúc

| STT | Tên trên bản kiến trúc | Mã | File chuẩn |
|---:|---|---|---|
| 01 | Mẫu BT Song lập Tân cổ điển | CH-53 | `CH53_SONG_LAP.jpg` |
| 02 | Mẫu Liền kề Tân cổ điển | CH-53 | `CH53_LK.jpg` |
| 03 | Mẫu Liền kề Cổ điển | CH-08 | `CH08_LK.jpg` |
| 04 | Mẫu BT Song lập Cổ điển | CH-08 | `CH08_SONG_LAP.jpg` |
| 05 | Mẫu BT Song lập Nhật Bản đương đại | CH-71 | `CH71_SONG_LAP.jpg` |
| 06 | Mẫu Liền kề Nhật Bản đương đại | CH-71 | `CH71_LK.jpg` |
| 07 | Mẫu Liền kề Hiện đại nhiệt đới | CH-59 | `CH59_LK.jpg` |
| 08 | Mẫu BT Đơn lập Hiện đại nhiệt đới | CH-59 | `CH59_DON_LAP.jpg` |
| 09 | Mẫu BT Song lập Hiện đại nhiệt đới | CH-59 | `CH59_SONG_LAP.jpg` |
| 10 | Mẫu Liền kề Hiện đại xanh | CH-52 | `CH52_LK.jpg` |
| 11 | Mẫu Liền kề Hiện đại xanh | CH-75 | `CH75_LK.jpg` |
| 12 | Mẫu BT Song lập Hiện đại xanh | CH-75 | `CH75_SONG_LAP.jpg` |
| 13 | Mẫu Liền kề Nhật Bản | CH-29 | `CH29_LK.jpg` |
| 14 | Mẫu Liền kề Hàn Quốc | CH-15 | `CH15_LK.jpg` |
| 15 | Mẫu Liền kề Hội An | CH-19 | `CH19_LK.jpg` |
| 16 | Mẫu Liền kề Đông Âu | CH-13 | `CH13_LK.jpg` |

## Biến thể thương mại / hình học

Bản định vị 16 nhóm xác định **mẫu kiến trúc gốc**. Nếu một căn có hình facade riêng vì `XẺ KHE`, `CĂN GÓC`, `SHOPHOUSE` hoặc biến thể khác, thêm suffix vào đúng mẫu gốc:

- `CH59_LK_XE_KHE.jpg`
- `CH59_LK_CAN_GOC.jpg`
- `CH53_LK_SHOPHOUSE.jpg`

PlotFlow ưu tiên asset biến thể khi dữ liệu căn yêu cầu biến thể đó. Nếu chưa có, app phải báo `MISSING HOUSE ASSET` thay vì lấy hình gần giống.

## Asset ưu tiên cho 14 căn demo hiện tại

- `CH53_LK.jpg` — AS50-08, AS80-20, AS76-08
- `CH13_LK.jpg` — AS63-19, AS86-45
- `CH59_LK.jpg` — TL32-19
- `CH15_LK.jpg` — TL12-05, TL12-101
- `CH19_LK.jpg` — TL7-25
- `CH59_LK_XE_KHE.jpg` — TL10-55
- `CH75_LK.jpg` — TL3-33, TL5-27
- `CH59_LK_CAN_GOC.jpg` — TL9-41
- `CH75_SONG_LAP.jpg` — ĐLCV2-14

## Workflow bổ sung nhanh

1. Tìm đúng ảnh facade/mẫu nhà theo legend.
2. Đổi tên đúng `CH + loại hình + biến thể`.
3. Bỏ trực tiếp vào `assets/houses/`.
4. Chạy `cd app && npm run setup`.
5. Reload PlotFlow.
6. Nếu key đúng, cảnh báo `MISSING HOUSE ASSET` tự biến mất và ảnh đúng được chèn lên poster.
