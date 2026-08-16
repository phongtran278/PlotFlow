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
