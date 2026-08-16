#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$APP_DIR/.." && pwd)"
ASSET_SOURCE="$PROJECT_DIR/assets/"
ASSET_DEST="$APP_DIR/public/assets/"
MASTER_SOURCE="$PROJECT_DIR/masterplan/"
MASTER_DEST="$APP_DIR/public/masterplan/"

if [ ! -d "$ASSET_SOURCE" ]; then
  echo "✕ Không tìm thấy folder: $ASSET_SOURCE"
  echo "Cấu trúc mong đợi: PlotFlow/assets và PlotFlow/app"
  exit 1
fi

mkdir -p "$ASSET_DEST"
rsync -av --delete --exclude "ui/" "$ASSET_SOURCE" "$ASSET_DEST"

echo ""
echo "✓ Assets synced"
echo "FROM: $ASSET_SOURCE"
echo "TO:   $ASSET_DEST"

# Create stable ASCII aliases for assets whose Drive/Finder filename may carry
# Unicode escape sequences. Code references these aliases, not fragile raw names.
HOUSE_ALIAS_DIR="$ASSET_DEST/library/houses"
mkdir -p "$HOUSE_ALIAS_DIR"
CH59_SOURCE=$(find "$ASSET_SOURCE/houses" -maxdepth 1 -type f -iname '*59*' | head -n 1)
if [ -n "$CH59_SOURCE" ]; then
  cp -f "$CH59_SOURCE" "$HOUSE_ALIAS_DIR/HOUSE_CH59_LK_SAN_VUON.jpg"
  echo "✓ Canonical house alias: HOUSE_CH59_LK_SAN_VUON.jpg"
else
  echo "△ Không tìm thấy house CH-59 để tạo alias"
fi

mkdir -p "$MASTER_DEST"
if [ -d "$MASTER_SOURCE" ]; then
  MASTER_PDF=$(find "$MASTER_SOURCE" -maxdepth 1 -type f \( -iname '*.pdf' \) | head -n 1)
  if [ -n "$MASTER_PDF" ]; then
    cp -f "$MASTER_PDF" "$MASTER_DEST/masterplan.pdf"
    echo ""
    echo "✓ Masterplan synced + normalized"
    echo "FROM: $MASTER_PDF"
    echo "TO:   $MASTER_DEST/masterplan.pdf"
  else
    echo ""
    echo "△ Không tìm thấy PDF trong $MASTER_SOURCE"
  fi
else
  echo ""
  echo "△ Chưa có folder masterplan: $MASTER_SOURCE"
fi

echo ""
echo "✓ PlotFlow sync complete"
