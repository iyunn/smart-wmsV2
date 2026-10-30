# =============================================================================
# SmartWMS V2 - cek cepat kondisi server (tidak mengubah apa pun).
#   powershell -ExecutionPolicy Bypass -File deploy\windows\status.ps1
# Jalankan sebagai Administrator agar folder C:\SmartWMS (log, backup) bisa dibaca.
# =============================================================================
. "$PSScriptRoot\common.ps1"

Write-Step 'Service'
foreach ($name in @($SW.ServiceId, $SW.PgService)) {
  $s = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($s) { Write-Info ('{0,-22} {1,-8} (start: {2})' -f $name, $s.Status, $s.StartType) }
  else { Write-Warn "$name tidak terpasang" }
}

Write-Step 'Aplikasi'
$port = 3000
if (Test-Path $SW.AppEnv) { $port = Get-AppPort }
$current = $null
try { $current = Get-CurrentRelease } catch { Write-Warn $_.Exception.Message }
Write-Info "Rilis aktif : $current"
try {
  $h = Invoke-RestMethod -Uri "http://localhost:$port/api/health" -TimeoutSec 5 -UseBasicParsing
  Write-Ok "Health: $($h.status), database $($h.db), rilis $($h.release)"
} catch {
  Write-Warn "http://localhost:$port/api/health tidak menjawab ($($_.Exception.Message))"
}
$lan = @(Get-LanAddress)
foreach ($a in $lan) {
  if ("$($a.Profile)" -eq 'Public') {
    Write-Info "Adapter    : $($a.Adapter) $($a.IPv4) - profil Public, port $port TERTUTUP di jaringan ini (benar untuk Wi-Fi/internet umum)"
  } else {
    Write-Info "URL LAN    : http://$($a.IPv4):$port  ($($a.Adapter), profil $($a.Profile))"
  }
}
if (-not ($lan | Where-Object { "$($_.Profile)" -ne 'Public' })) {
  Write-Warn 'Tidak ada jaringan Private/Domain -> PC lain tidak bisa akses. Untuk LAN kantor (Ethernet):'
  Write-Warn "  Set-NetConnectionProfile -InterfaceAlias 'Ethernet' -NetworkCategory Private   (jangan untuk Wi-Fi umum)"
}

Write-Step 'Backup'
$cfg = Read-EnvFile $SW.BackupEnv
$bdir = $SW.Backups
if ($cfg.Contains('BACKUP_DIR') -and $cfg['BACKUP_DIR']) { $bdir = $cfg['BACKUP_DIR'] }
$last = $null
try { $last = Get-Content -LiteralPath (Join-Path $bdir 'last-backup.json') -Raw -ErrorAction Stop | ConvertFrom-Json } catch { }
if ($last) {
  $age = (Get-Date) - [datetime]$last.time
  $msg = 'Terakhir  : {0} ({1:N0} jam lalu, {2:N1} MB)' -f ([datetime]$last.time).ToString('yyyy-MM-dd HH:mm'), $age.TotalHours, ($last.sizeBytes / 1MB)
  if ($age.TotalHours -gt 26) { Write-Warn "$msg - LEBIH DARI SEHARI" } else { Write-Ok $msg }
  if ($last.offsiteDir) {
    if ($last.offsite) {
      $oage = (Get-Date) - [datetime]$last.offsite.time
      $omsg = 'Luar disk : {0} ({1:N0} hari lalu)' -f $last.offsite.file, $oage.TotalDays
      if ($oage.TotalDays -gt 8) { Write-Warn "$omsg - colokkan/hubungkan tujuan luar disk" } else { Write-Ok $omsg }
    } else { Write-Warn "Luar disk : $($last.offsiteDir) belum pernah tersalin" }
  } else { Write-Warn 'Luar disk : belum diatur (setup-backup.ps1 -OffsiteDir ...)' }
} else {
  Write-Warn 'Belum ada backup (jalankan setup-backup.ps1)'
}
$task = Get-ScheduledTask -TaskName $SW.BackupTask -ErrorAction SilentlyContinue
if ($task) {
  $ti = Get-ScheduledTaskInfo -TaskName $SW.BackupTask
  Write-Info ('Jadwal    : berikutnya {0}, hasil terakhir {1}' -f $ti.NextRunTime, $(if ($ti.LastTaskResult -eq 0) { 'OK' } else { "kode $($ti.LastTaskResult)" }))
} else { Write-Warn "Task '$($SW.BackupTask)' belum dibuat" }

Write-Step 'Disk'
$drive = Get-PSDrive -Name ($SW.Root.Substring(0, 1))
Write-Info ('{0}: bebas {1:N1} GB dari {2:N1} GB' -f $drive.Name, ($drive.Free / 1GB), (($drive.Used + $drive.Free) / 1GB))

Write-Step 'Log terbaru'
$log = Get-ChildItem -LiteralPath $SW.Logs -Filter '*.err.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($log) { Write-Info "$($log.FullName) (5 baris terakhir):"; Get-Content -LiteralPath $log.FullName -Tail 5 | ForEach-Object { Write-Info "  $_" } }
else { Write-Info '(belum ada log error)' }
