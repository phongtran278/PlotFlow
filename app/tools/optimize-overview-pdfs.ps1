$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pdfDir = Join-Path $root "public\overview-masterplan"
$files = @("xay-tho.pdf", "hoan-thien.pdf", "gian-xay.pdf")

if (-not (Get-Command qpdf -ErrorAction SilentlyContinue)) {
  Write-Host "qpdf is required. Install once with:" -ForegroundColor Yellow
  Write-Host "  winget install --id QPDF.QPDF -e" -ForegroundColor Cyan
  exit 1
}

function Test-QpdfExit([string]$step, [string]$name) {
  $code = $LASTEXITCODE
  if ($code -eq 0) { return }
  if ($code -eq 3) {
    Write-Warning "$step completed with qpdf warnings for $name; validating output before replacement."
    return
  }
  throw "$step failed for $name (qpdf exit $code)"
}

function Test-QpdfFile([string]$path, [string]$name) {
  & qpdf --check $path
  $code = $LASTEXITCODE
  if ($code -eq 0) { return }
  if ($code -eq 3) {
    Write-Warning "qpdf --check reports warnings for $name, but no fatal error. Keeping output eligible for use."
    return
  }
  throw "Validation failed for $name (qpdf exit $code)"
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

  Write-Host "Processing $name" -ForegroundColor Green

  # Keep page 1 only. qpdf copies PDF objects; it does not rasterize vector/text content.
  & qpdf --empty --pages $source 1 -- $pageOne
  Test-QpdfExit "Page 1 extraction" $name
  if (-not (Test-Path $pageOne)) { throw "Page 1 output was not created for $name" }
  Test-QpdfFile $pageOne "$name page 1"

  # Lossless PDF structure/stream optimization. Vector paths and searchable text stay vector/text.
  & qpdf --object-streams=generate --stream-data=compress --recompress-flate --compression-level=9 $pageOne $optimized
  Test-QpdfExit "Lossless optimization" $name
  if (-not (Test-Path $optimized)) { throw "Optimized output was not created for $name" }
  Test-QpdfFile $optimized "$name optimized"

  # Preserve the first/original source backup. Re-running the tool must never destroy it.
  if (-not (Test-Path $backup)) {
    Copy-Item $source $backup
  }

  $before = [math]::Round((Get-Item $source).Length / 1MB, 2)
  Move-Item $optimized $source -Force
  Remove-Item $pageOne -Force
  $after = [math]::Round((Get-Item $source).Length / 1MB, 2)

  Write-Host "  $before MB -> $after MB | page 1 only | vector/text preserved" -ForegroundColor Cyan
}

Write-Host "Done. Inspect the three PDFs before git add." -ForegroundColor Green
Write-Host "Original backups are kept as *.source-backup.pdf and should NOT be committed." -ForegroundColor DarkGray
