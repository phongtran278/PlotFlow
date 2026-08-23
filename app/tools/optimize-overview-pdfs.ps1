$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pdfDir = Join-Path $root "public\overview-masterplan"
$files = @("xay-tho.pdf", "hoan-thien.pdf", "gian-xay.pdf")

if (-not (Get-Command qpdf -ErrorAction SilentlyContinue)) {
  Write-Host "qpdf is required. Install once with:" -ForegroundColor Yellow
  Write-Host "  winget install --id QPDF.QPDF -e" -ForegroundColor Cyan
  exit 1
}

foreach ($name in $files) {
  $source = Join-Path $pdfDir $name
  if (-not (Test-Path $source)) {
    Write-Warning "Missing $name - skipped"
    continue
  }

  $stem = [System.IO.Path]::GetFileNameWithoutExtension($name)
  $pageOne = Join-Path $pdfDir "$stem.page1.tmp.pdf"
  $optimized = Join-Path $pdfDir "$stem.optimized.tmp.pdf"
  $backup = Join-Path $pdfDir "$stem.source-backup.pdf"

  if (Test-Path $pageOne) { Remove-Item $pageOne -Force }
  if (Test-Path $optimized) { Remove-Item $optimized -Force }
  if (Test-Path $backup) { Remove-Item $backup -Force }

  Write-Host "Processing $name" -ForegroundColor Green

  # Keep page 1 only. qpdf copies PDF objects; it does not rasterize vector/text content.
  & qpdf --empty --pages $source 1 -- $pageOne
  if ($LASTEXITCODE -ne 0) { throw "Failed to extract page 1 from $name" }

  # Lossless PDF structure/stream optimization. Vector paths and searchable text stay vector/text.
  & qpdf --object-streams=generate --stream-data=compress --recompress-flate --compression-level=9 $pageOne $optimized
  if ($LASTEXITCODE -ne 0) { throw "Failed to optimize $name" }

  Move-Item $source $backup
  Move-Item $optimized $source
  Remove-Item $pageOne -Force

  $before = [math]::Round((Get-Item $backup).Length / 1MB, 2)
  $after = [math]::Round((Get-Item $source).Length / 1MB, 2)
  Write-Host "  $before MB -> $after MB | page 1 only | vector preserved" -ForegroundColor Cyan
}

Write-Host "Done. Inspect the three PDFs before git add." -ForegroundColor Green
Write-Host "Backups are kept as *.source-backup.pdf and should NOT be committed." -ForegroundColor DarkGray
