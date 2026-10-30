# =============================================================================
# SmartWMS V2 - restore database dari backup (ARCHITECTURE D-35).
#
#   Uji restore (AMAN, tidak menyentuh produksi):
#     powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1
#     powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1 -File D:\...\smartwms_....dump
#   -> dipulihkan ke database terpisah "smartwms_restore_test", jumlah baris dibandingkan dengan
#      produksi, lalu database uji dihapus (pakai -Keep untuk membiarkannya).
#
#   Restore PRODUKSI (data sekarang DIGANTI isi backup):
#     powershell -ExecutionPolicy Bypass -File deploy\windows\restore.ps1 -Production -File <file.dump>
#   -> backup pengaman dulu, stop aplikasi, database dibuat ulang, isi backup dipulihkan, start.
#
# Butuh password superuser "postgres" (membuat/menghapus database).
# =============================================================================
param(
  [string]$File,
  [switch]$Production,
  [switch]$Keep
)

. "$PSScriptRoot\common.ps1"
Assert-Admin

$cfg = Read-EnvFile $SW.BackupEnv
$dir = $SW.Backups
if ($cfg.Contains('BACKUP_DIR') -and $cfg['BACKUP_DIR']) { $dir = $cfg['BACKUP_DIR'] }
if (-not $File) {
  $newest = Get-ChildItem -LiteralPath $dir -Filter 'smartwms_*.dump' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $newest) { throw "Tidak ada file backup di $dir." }
  $File = $newest.FullName
}
if (-not (Test-Path -LiteralPath $File)) { throw "File $File tidak ditemukan." }
$item = Get-Item -LiteralPath $File

$conn = Get-DbConnection $SW.MigrateEnv 'DATABASE_URL_OWNER'
$secrets = Read-EnvFile $SW.Secrets
$log = Join-Path $SW.Logs 'backup.log'
$target = $SW.RestoreTestDb
if ($Production) { $target = $conn.Db }

Write-Step 'Restore database'
Write-Info ('File   : {0} ({1:N1} MB, {2})' -f $item.FullName, ($item.Length / 1MB), $item.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))
Write-Info "Tujuan : $target"
$null = Get-PgOutput 'pg_restore.exe' @('--list', $item.FullName) '' 'File backup rusak / bukan backup pg_dump'
Write-Ok 'File backup terbaca'

if ($Production) {
  Write-Warn "Database PRODUKSI '$target' akan DIGANTI dengan isi backup ini."
  Write-Warn 'Semua perubahan sesudah waktu backup akan hilang.'
  $answer = Read-Host 'Ketik RESTORE (huruf besar) untuk melanjutkan'
  if ($answer -cne 'RESTORE') { Write-Info 'Dibatalkan.'; return }
}

$pgPw = Read-PostgresPassword
$pgArgs = @('-h', $conn.Host, '-p', $conn.Port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q')
$null = Get-PgOutput 'psql.exe' ($pgArgs + @('-Atc', 'select 1')) $pgPw 'Login postgres (password salah?)'

$restoreArgs = @('-h', $conn.Host, '-p', $conn.Port, '-U', $conn.User, '-d', $target,
  '--no-owner', '--single-transaction', '--exit-on-error', $item.FullName)

if (-not $Production) {
  # --- Uji restore ke database terpisah ---------------------------------------------
  Invoke-Pg 'psql.exe' ($pgArgs + @('-c', "drop database if exists $target with (force)",
    '-c', "create database $target owner $($conn.User) encoding 'UTF8' template template0")) $pgPw 'Membuat database uji'
  Invoke-Pg 'pg_restore.exe' $restoreArgs $conn.Password 'pg_restore'
  # Setelan per-database tidak ikut pg_dump -> pasang lagi (zona waktu UTC, ARCHITECTURE D-22)
  Invoke-Pg 'psql.exe' ($pgArgs + @('-c', "alter database $target set timezone to 'UTC'")) $pgPw 'Setelan zona waktu'
  Write-Ok "Isi backup berhasil dipulihkan ke $target"

  $prodCounts = Get-PgOutput 'psql.exe' @('-h', $conn.Host, '-p', $conn.Port, '-U', $conn.User, '-d', $conn.Db, '-Atc', $SQL_ROW_COUNTS) $conn.Password 'Hitung baris produksi'
  $testCounts = Get-PgOutput 'psql.exe' @('-h', $conn.Host, '-p', $conn.Port, '-U', $conn.User, '-d', $target, '-Atc', $SQL_ROW_COUNTS) $conn.Password 'Hitung baris hasil restore'
  $p = @{}; foreach ($kv in ([string]$prodCounts).Split(' ')) { $a = $kv.Split('='); if ($a.Count -eq 2) { $p[$a[0]] = $a[1] } }
  Write-Step 'Jumlah baris: hasil restore vs produksi sekarang'
  $diff = 0
  foreach ($kv in ([string]$testCounts).Split(' ')) {
    $a = $kv.Split('='); if ($a.Count -ne 2) { continue }
    $now = '-'; if ($p.ContainsKey($a[0])) { $now = $p[$a[0]] }
    $mark = '   '; if ($now -ne $a[1]) { $mark = ' * '; $diff++ }
    Write-Info ('{0}{1,-24} backup {2,8}   produksi {3,8}' -f $mark, $a[0], $a[1], $now)
  }
  if ($diff -gt 0) { Write-Info "(* = berbeda; wajar bila ada input data sesudah waktu backup)" }
  Write-Log $log "UJI RESTORE OK  $($item.Name) -> $target ($diff tabel berbeda dari produksi)"

  if (-not $Keep) {
    Invoke-Pg 'psql.exe' ($pgArgs + @('-c', "drop database $target with (force)")) $pgPw 'Hapus database uji'
    Write-Ok "Database uji $target dihapus (pakai -Keep untuk menyimpannya)"
  } else {
    Write-Ok "Database uji $target disimpan - lihat di pgAdmin, hapus bila selesai."
  }
  return
}

# --- Restore produksi ---------------------------------------------------------------
Write-Step 'Backup pengaman sebelum restore'
& (Join-Path $PSScriptRoot 'backup.ps1') -Tag 'pra-restore'

Write-Step 'Restore produksi'
Stop-AppService
Write-Ok 'Aplikasi berhenti'
try {
  Invoke-Pg 'psql.exe' ($pgArgs + @('-c', "drop database if exists $target with (force)")) $pgPw 'Hapus database produksi lama'
  # Buat ulang database + hak akses (role sudah ada, password tidak diubah)
  $env:SMARTWMS_OWNER_PW = $secrets['OWNER_PW']; $env:SMARTWMS_APP_PW = $secrets['APP_PW']
  try {
    Invoke-Pg 'psql.exe' @('-h', $conn.Host, '-p', $conn.Port, '-U', 'postgres', '-d', 'postgres', '-q',
      '-v', "dbname=$target", '-v', "owner_role=$($SW.OwnerRole)", '-v', "app_role=$($SW.AppRole)",
      '-f', (Join-Path $PSScriptRoot 'setup-db.sql')) $pgPw 'Membuat ulang database'
  } finally { Remove-Item Env:SMARTWMS_OWNER_PW, Env:SMARTWMS_APP_PW -ErrorAction SilentlyContinue }
  Invoke-Pg 'pg_restore.exe' $restoreArgs $conn.Password 'pg_restore'
  Invoke-Pg 'psql.exe' ($pgArgs + @('-c', "alter database $target set timezone to 'UTC'")) $pgPw 'Setelan zona waktu'
  Write-Ok 'Isi backup dipulihkan'
  # Backup lama (sebelum migrasi 0004) tidak membawa kunci -> pasang lagi (D-38)
  try { $lock = Set-ImportLock "restore $($item.Name)"; Write-Ok "Kunci impor V1 aktif ($lock)" }
  catch { Write-Warn "Kunci impor V1 gagal dipasang: $($_.Exception.Message) - jalankan deploy.ps1" }
}
finally {
  Start-AppService
}
$health = Wait-Health -Port (Get-AppPort) -TimeoutSec 90
if (-not $health) { throw "Aplikasi tidak sehat setelah restore - cek $($SW.Logs)." }
Write-Log $log "RESTORE PRODUKSI OK  $($item.Name)"
Write-Ok "Aplikasi jalan lagi (rilis $($health.release), database $($health.db))"
Write-Info 'Akun baca-saja pgAdmin (bila dipakai): jalankan ulang setup-viewer.ps1 agar haknya terpasang lagi.'
