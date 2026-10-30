# =============================================================================
# SmartWMS V2 - kembali ke rilis sebelumnya.
#
#   PowerShell "Run as administrator":
#     powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1                 # ke rilis sebelumnya
#     powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1 -Release <nama>  # ke rilis tertentu
#     powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1 -List            # lihat daftar rilis
#
# Hanya mengganti kode aplikasi. Migrasi database TIDAK dibatalkan - kalau rilis baru
# mengubah skema, kembalikan database dari backup (docs/v2/DEPLOY-LOKAL.md, "Restore").
# =============================================================================
param(
  [string]$Release,
  [switch]$List
)

. "$PSScriptRoot\common.ps1"
Assert-Admin

$current = Get-CurrentRelease
$all = @(Get-ChildItem -LiteralPath $SW.Releases -Directory | Sort-Object Name -Descending | ForEach-Object { $_.Name })
if ($all.Count -eq 0) { throw 'Belum ada rilis. Jalankan deploy.ps1.' }

if ($List) {
  Write-Step 'Rilis tersedia (terbaru di atas)'
  foreach ($r in $all) {
    $mark = '  '
    if ($r -eq $current) { $mark = '* ' }
    Write-Info "$mark$r"
  }
  Write-Info '(* = sedang jalan)'
  return
}

if (-not $Release) {
  $older = @($all | Where-Object { $_ -lt $current })
  if ($older.Count -eq 0) { throw "Tidak ada rilis yang lebih lama dari $current." }
  $Release = $older[0]
}
if ($all -notcontains $Release) { throw "Rilis '$Release' tidak ada. Lihat: rollback.ps1 -List" }
if ($Release -eq $current) { Write-Ok "Rilis $Release sudah aktif."; return }

Write-Step "Rollback $current -> $Release"
Stop-AppService
Set-CurrentRelease $Release
Start-AppService
$health = Wait-Health -Port (Get-AppPort) -TimeoutSec 90
if (-not $health) { throw "Rilis $Release tidak sehat - cek log di $($SW.Logs)." }
Write-Ok "Aktif: rilis $($health.release), database $($health.db)"
