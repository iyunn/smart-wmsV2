# =============================================================================
# SmartWMS V2 - pasang backup otomatis (ARCHITECTURE D-35). Aman dijalankan ulang.
#
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-backup.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-backup.ps1 -OffsiteDir E:\Backup-SmartWMS
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-backup.ps1 -At 12:15 -KeepDays 30
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-backup.ps1 -OffsiteDir none   # matikan salinan luar disk
#
# - Menyimpan setelan di C:\SmartWMS\config\backup.env
# - Task Scheduler "SmartWMS Backup Harian": setiap hari jam -At, akun SYSTEM, tetap jalan bila
#   PC sempat mati di jam itu (dijalankan begitu PC menyala lagi)
# - Script yang dijalankan task: C:\SmartWMS\src\deploy\windows\backup.ps1 (ikut ter-update
#   setiap deploy.ps1) - jadi jalankan deploy.ps1 versi 6b dulu sebelum script ini.
# - Langsung menjalankan backup pertama untuk menguji.
# =============================================================================
param(
  [string]$At = '18:30',
  [string]$BackupDir,
  [string]$OffsiteDir,
  [int]$KeepDays = 0,
  [switch]$NoRunNow
)

. "$PSScriptRoot\common.ps1"
Assert-Admin

$taskScript = Join-Path $SW.Src 'deploy\windows\backup.ps1'
if (-not (Test-Path $taskScript)) {
  throw "Belum ada $taskScript. Push perubahan Tahap 6b ke GitHub lalu jalankan deploy.ps1 dulu."
}

# --- Setelan ---------------------------------------------------------------------
Write-Step 'Setelan backup'
$cfg = Read-EnvFile $SW.BackupEnv
$values = [ordered]@{}
if ($BackupDir) { $values['BACKUP_DIR'] = $BackupDir } elseif (-not $cfg.Contains('BACKUP_DIR')) { $values['BACKUP_DIR'] = $SW.Backups }
if ($KeepDays -gt 0) { $values['KEEP_DAYS'] = "$KeepDays" } elseif (-not $cfg.Contains('KEEP_DAYS')) { $values['KEEP_DAYS'] = '14' }
if ($OffsiteDir) {
  if ($OffsiteDir -eq 'none') { $values['OFFSITE_DIR'] = '' } else { $values['OFFSITE_DIR'] = $OffsiteDir }
} elseif (-not $cfg.Contains('OFFSITE_DIR')) { $values['OFFSITE_DIR'] = '' }
if (-not $cfg.Contains('OFFSITE_KEEP_DAYS')) { $values['OFFSITE_KEEP_DAYS'] = '56' }
Write-EnvFile $SW.BackupEnv $values 'Setelan backup SmartWMS (setup-backup.ps1)'
$cfg = Read-EnvFile $SW.BackupEnv
Set-Acl2 $SW.BackupEnv @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)")

$dir = $cfg['BACKUP_DIR']
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
if ($dir -ne $SW.Backups) { Set-Acl2 $dir @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)") -Inherit }
Write-Ok "Folder backup : $dir (simpan $($cfg['KEEP_DAYS']) hari)"
if ($cfg['OFFSITE_DIR']) {
  $o = $cfg['OFFSITE_DIR']
  if (Test-Path -LiteralPath $o) { Write-Ok "Luar disk     : $o (salinan mingguan, simpan $($cfg['OFFSITE_KEEP_DAYS']) hari)" }
  else { Write-Warn "Luar disk     : $o BELUM terhubung - salinan dibuat begitu tersedia." }
  if ($o.StartsWith('\\')) { Write-Warn 'Folder jaringan: task berjalan sebagai SYSTEM, jadi folder bersama harus memberi akses ke akun komputer ini (DOMAIN\NAMA-PC$) - lebih mudah pakai hardisk eksternal.' }
} else {
  Write-Warn 'Salinan luar disk BELUM diatur (PRD A9). Contoh: -OffsiteDir E:\Backup-SmartWMS (hardisk eksternal).'
}

# --- Task Scheduler ---------------------------------------------------------------
Write-Step "Task Scheduler: $($SW.BackupTask)"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$taskScript`" -Tag harian"
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName $SW.BackupTask -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Description 'Backup harian database SmartWMS (deploy/windows/backup.ps1)' -Force | Out-Null
Write-Ok "Setiap hari jam $At (akun SYSTEM; bila PC mati di jam itu, jalan saat PC menyala)"

# --- Uji jalan sekarang ------------------------------------------------------------
if (-not $NoRunNow) {
  Write-Step 'Menjalankan backup pertama lewat Task Scheduler'
  Start-ScheduledTask -TaskName $SW.BackupTask
  $deadline = (Get-Date).AddMinutes(5)
  Start-Sleep -Seconds 3
  while ((Get-ScheduledTask -TaskName $SW.BackupTask).State -eq 'Running' -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
  $info = Get-ScheduledTaskInfo -TaskName $SW.BackupTask
  if ($info.LastTaskResult -eq 0) {
    Write-Ok 'Backup pertama berhasil'
    Get-Content -LiteralPath (Join-Path $SW.Logs 'backup.log') -Tail 3 | ForEach-Object { Write-Info $_ }
  } else {
    Write-Warn "Backup pertama gagal (kode $($info.LastTaskResult)). Lihat $($SW.Logs)\backup.log"
    exit 1
  }
}
