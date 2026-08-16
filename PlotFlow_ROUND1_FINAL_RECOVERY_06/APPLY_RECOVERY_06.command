#!/bin/zsh
set -e
TARGET="/Users/mac/Documents/PlotFlow/app"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)/COPY_INTO_APP"
BACKUP="$TARGET/_backup_before_recovery_06_$(date +%Y%m%d_%H%M%S)"

if [ ! -d "$TARGET" ]; then
  echo "✕ Không tìm thấy app tại: $TARGET"
  exit 1
fi

mkdir -p "$BACKUP"
for rel in \
  src/App.jsx \
  src/App.css \
  src/main.jsx \
  src/index.css \
  src/components/PosterCanvas.jsx \
  src/components/UnitInfoCard.jsx \
  src/components/FloorplanFineTune.jsx \
  src/components/AssetPicker.jsx \
  src/components/LotHighlightEditor.jsx \
  src/data/assetLibrary.js \
  src/data/assetCatalog.js \
  src/data/brandConfig.js \
  src/floorplan/pdfLocator.js \
  tools/sync_assets.command; do
  if [ -f "$TARGET/$rel" ]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$TARGET/$rel" "$BACKUP/$rel"
  fi
done

mkdir -p "$TARGET/src/components" "$TARGET/src/data" "$TARGET/src/floorplan" "$TARGET/public/assets/ui" "$TARGET/tools"
cp -R "$PATCH_DIR"/. "$TARGET"/
chmod +x "$TARGET/tools/sync_assets.command" 2>/dev/null || true

echo "✓ Recovery 06 applied"
echo "Backup: $BACKUP"
echo "Next:"
echo "  cd $TARGET"
echo "  ./tools/sync_assets.command"
echo "  npm run dev"
