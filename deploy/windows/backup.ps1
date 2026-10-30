# =============================================================================
# SmartWMS V2 - backup database produksi (ARCHITECTURE D-35).
#
#   Otomatis : Task Scheduler "SmartWMS Backup Harian" (dibuat setup-backup.ps1) & deploy.ps1
#   Manual   : powershell -ExecutionPolicy Bypass -File deploy\windows\backup.ps1 -Tag manual
#
# 1. pg_dump format custom -> <folder backup>\smartwms_<tanggal>_<tag>.dump
#    (ditulis ke .partial dulu, dicek dengan pg_restore --list, baru diganti nama)
# 2. Hapus backup lebih lama dari KEEP_DAYS (default 14 hari; 3 terbaru selalu disimpan)
# 3. Salinan luar disk (OFFSITE_DIR, mis. hardisk eksternal/folder PC lain): disalin bila
#    salinan terakhir di sana sudah >= 7 hari (atau -Offsite). Bila tujuan tidak terhubung,
#    dicatat sebagai peringatan dan dicoba lagi besok.
# 4. Catatan: C:\SmartWMS\logs\backup.log  &  <folder backup>\last-backup.json
# =============================================================================
param(
  [string]$Tag = 'harian',
  [switch]$Offsite            # paksa salin ke OFFSITE_DIR sekarang
)

. "$PSScriptRoot\common.ps1"
Assert-Admin

$cfg = Read-EnvFile $SW.BackupEnv
$dir = $SW.Backups
if ($cfg.Contains('BACKUP_DIR') -and $cfg['BACKUP_DIR']) { $dir = $cfg['BACKUP_DIR'] }
$keepDays = 14
if ($cfg.Contains('KEEP_DAYS')) { $keepDays = [int]$cfg['KEEP_DAYS'] }
$offsiteDir = $null
if ($cfg.Contains('OFFSITE_DIR') -and $cfg['OFFSITE_DIR']) { $offsiteDir = $cfg['OFFSITE_DIR'] }
$offsiteKeepDays = 56
if ($cfg.Contains('OFFSITE_KEEP_DAYS')) { $offsiteKeepDays = [int]$cfg['OFFSITE_KEEP_DAYS'] }
$minKeep = 3

$log = Join-Path $SW.Logs 'backup.log'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$conn = Get-DbConnection $SW.MigrateEnv 'DATABASE_URL_OWNER'
$safeTag = ($Tag -replace '[^A-Za-z0-9_-]', '-')
$name = 'smartwms_{0}_{1}.dump' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $safeTag
$final = Join-Path $dir $name
$partial = "$final.partial"
$statusFile = Join-Path $dir 'last-backup.json'

Write-Step "Backup database $($conn.Db) -> $final"
try {
  # --- 1. Dump + verifikasi --------------------------------------------------
  Invoke-Pg 'pg_dump.exe' @('-h', $conn.Host, '-p', $conn.Port, '-U', $conn.User, '-d', $conn.Db,
    '--format=custom', '--compress=6', '--file', $partial) $conn.Password 'pg_dump'
  $null = Get-PgOutput 'pg_restore.exe' @('--list', $partial) '' 'Verifikasi backup (pg_restore --list)'
  Move-Item -LiteralPath $partial -Destination $final
  $size = (Get-Item -LiteralPath $final).Length
  Write-Log $log ('OK   {0} ({1:N1} MB)' -f $name, ($size / 1MB))

  # --- 2. Retensi lokal ------------------------------------------------------
  $cut = (Get-Date).AddDays(-$keepDays)
  $files = @(Get-ChildItem -LiteralPath $dir -Filter 'smartwms_*.dump' | Sort-Object LastWriteTime -Descending)
  foreach ($f in ($files | Select-Object -Skip $minKeep | Where-Object { $_.LastWriteTime -lt $cut })) {
    Remove-Item -LiteralPath $f.FullName -Force
    Write-Log $log "HAPUS (> $keepDays hari) $($f.Name)"
  }

  # --- 3. Salinan luar disk ----------------------------------------------------
  $offsiteInfo = $null
  if ($offsiteDir) {
    if (Test-Path -LiteralPath $offsiteDir) {
      $last = Get-ChildItem -LiteralPath $offsiteDir -Filter 'smartwms_*.dump' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
      $due = $Offsite -or (-not $last) -or ($last.LastWriteTime -lt (Get-Date).AddDays(-6.5))
      if ($due) {
        $dest = Join-Path $offsiteDir $name
        Copy-Item -LiteralPath $final -Destination $dest
        if ((Get-Item -LiteralPath $dest).Length -ne $size) { throw "Salinan luar disk tidak utuh: $dest" }
        Write-Log $log "LUAR DISK  $dest"
        $offCut = (Get-Date).AddDays(-$offsiteKeepDays)
        $offFiles = @(Get-ChildItem -LiteralPath $offsiteDir -Filter 'smartwms_*.dump' | Sort-Object LastWriteTime -Descending)
        foreach ($f in ($offFiles | Select-Object -Skip 2 | Where-Object { $_.LastWriteTime -lt $offCut })) {
          Remove-Item -LiteralPath $f.FullName -Force
          Write-Log $log "HAPUS luar disk (> $offsiteKeepDays hari) $($f.Name)"
        }
        $offsiteInfo = @{ time = (Get-Date).ToString('o'); file = $dest }
      } else {
        $offsiteInfo = @{ time = $last.LastWriteTime.ToString('o'); file = $last.FullName }
      }
    } else {
      Write-Log $log "PERINGATAN  folder luar disk $offsiteDir tidak terhubung - salinan mingguan tertunda"
    }
  }

  $status = [ordered]@{
    time = (Get-Date).ToString('o'); file = $final; sizeBytes = $size; tag = $safeTag
    offsite = $offsiteInfo; offsiteDir = $offsiteDir
  }
  [IO.File]::WriteAllText($statusFile, ($status | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
  Write-Ok 'Backup selesai'
}
catch {
  Write-Log $log "GAGAL  $($_.Exception.Message)"
  throw
}
finally {
  if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue }
}
