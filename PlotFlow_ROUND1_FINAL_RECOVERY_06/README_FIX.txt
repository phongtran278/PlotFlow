PLOTFLOW ROUND 1 — FINAL RECOVERY 06

Lỗi được sửa:
1) src/components/FloorplanFineTune.jsx bị thiếu trong Final Merged Patch.
2) src/data/assetLibrary.js cũng bị thiếu và sẽ là lỗi kế tiếp sau khi sửa FloorplanFineTune.
3) Bổ sung lại src/main.jsx + src/index.css để tránh lỗi entry Vite.

Cách chạy:
cd /Users/mac/Documents/PlotFlow/PlotFlow_ROUND1_FINAL_RECOVERY_06
chmod +x APPLY_RECOVERY_06.command
./APPLY_RECOVERY_06.command

Sau đó:
cd /Users/mac/Documents/PlotFlow/app
./tools/sync_assets.command
npm run dev

Không cần localStorage.clear(). Script backup các file cũ trước khi đè.
