# =============================================================================
# SmartWMS V2 - deploy / update aplikasi produksi.
#
#   PowerShell "Run as administrator":
#     powershell -ExecutionPolicy Bypass -File deploy\windows\deploy.ps1            # rilis branch main
#     powershell -ExecutionPolicy Bypass -File deploy\windows\deploy.ps1 -Ref v2.0.0
#
# Alur (ARCHITECTURE D-33):
#   1. Ambil kode dari GitHub ke C:\SmartWMS\src (clone terpisah - folder dev tidak disentuh;
#      yang dirilis = yang sudah di-push, bukan perubahan lokal yang belum di-commit)
#   2. npm ci + next build (standalone)
#   3. Salin hasil build ke C:\SmartWMS\releases\<tanggal>-<commit>
#   4. Backup database (bila backup.ps1 sudah ada - Tahap 6b)
#   5. Stop service -> migrasi database -> arahkan C:\SmartWMS\app ke rilis baru -> start
#   6. Cek /api/health; gagal -> otomatis kembali ke rilis sebelumnya
#   7. Simpan 3 rilis terakhir, hapus yang lebih lama
# =============================================================================
param(
  [string]$Ref = 'main',      # branch atau tag di GitHub
  [int]$Keep = 3,             # jumlah rilis yang disimpan untuk rollback
  [switch]$SkipBackup         # lewati backup sebelum migrasi (tidak disarankan)
)

. "$PSScriptRoot\common.ps1"
Assert-Admin

if (-not (Test-Path $SW.AppEnv) -or -not (Test-Path $SW.MigrateEnv)) {
  throw 'Konfigurasi belum ada. Jalankan setup-server.ps1 dulu.'
}
if (-not (Get-Service -Name $SW.ServiceId -ErrorAction SilentlyContinue)) {
  throw "Service $($SW.ServiceId) belum terpasang. Jalankan setup-server.ps1 dulu."
}
$node = Find-Exe 'node.exe' @('C:\Program Files\nodejs\node.exe')
$npm  = Find-Exe 'npm.cmd'  @('C:\Program Files\nodejs\npm.cmd')
$git  = Find-Exe 'git.exe'  @('C:\Program Files\Git\cmd\git.exe', 'C:\msys64\usr\bin\git.exe', 'C:\msys64\ucrt64\bin\git.exe')
if (-not ($node -and $npm -and $git)) { throw 'node.exe / npm.cmd / git.exe tidak ditemukan di PATH.' }
$port = Get-AppPort
$started = Get-Date

# --- 1. Kode sumber ---------------------------------------------------------------
Write-Step "Ambil kode $($SW.RepoUrl) ($Ref)"
$gitBase = @('-c', "safe.directory=$($SW.Src -replace '\\','/')", '-C', $SW.Src)
if (-not (Test-Path (Join-Path $SW.Src '.git'))) {
  Invoke-Native $git @('clone', '--quiet', $SW.RepoUrl, $SW.Src) 'git clone'
}
Invoke-Native $git ($gitBase + @('fetch', '--quiet', '--prune', '--tags', 'origin')) 'git fetch'
$target = "origin/$Ref"
& $git @gitBase rev-parse --verify --quiet "$target^{commit}" | Out-Null
if ($LASTEXITCODE -ne 0) { $target = $Ref }   # tag
Invoke-Native $git ($gitBase + @('checkout', '--quiet', '--force', '--detach', $target)) "git checkout $target"
Invoke-Native $git ($gitBase + @('clean', '--quiet', '-fdx', '-e', 'node_modules')) 'git clean'
$commit = (& $git @gitBase rev-parse --short HEAD).Trim()
$subject = (& $git @gitBase log -1 --format=%s).Trim()
Write-Ok "$commit  $subject"

# --- 2. Build ------------------------------------------------------------------------
Write-Step 'npm ci + build (beberapa menit)'
Push-Location $SW.Src
try {
  $env:NEXT_TELEMETRY_DISABLED = '1'
  Invoke-Native $npm @('ci', '--no-audit', '--no-fund') 'npm ci'
  Invoke-Native $npm @('run', 'build') 'next build'
} finally {
  Pop-Location
}
$standalone = Join-Path $SW.Src '.next\standalone'
if (-not (Test-Path (Join-Path $standalone 'server.js'))) { throw 'Build tidak menghasilkan .next\standalone\server.js (cek output: "standalone" di next.config.ts).' }
Write-Ok 'Build selesai'

# --- 3. Folder rilis --------------------------------------------------------------------
$release = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $commit
$relDir = Join-Path $SW.Releases $release
Write-Step "Rilis $release"
function Copy-Tree([string]$From, [string]$To) {
  & robocopy.exe $From $To /E /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy $From gagal (exit $LASTEXITCODE)." }   # 0-7 = berhasil
}
Copy-Tree $standalone $relDir
Copy-Tree (Join-Path $SW.Src '.next\static') (Join-Path $relDir '.next\static')
if (Test-Path (Join-Path $SW.Src 'public')) { Copy-Tree (Join-Path $SW.Src 'public') (Join-Path $relDir 'public') }
$info = [ordered]@{ release = $release; commit = $commit; ref = $Ref; subject = $subject; builtAt = (Get-Date).ToString('o') }
[IO.File]::WriteAllText((Join-Path $relDir 'release.json'), ($info | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
# Next.js menulis cache runtime di .next\cache -> akun service perlu hak ubah di situ saja
$cacheDir = Join-Path $relDir '.next\cache'
New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
& icacls.exe $cacheDir /grant "${SID_LOCAL_SERVICE}:(OI)(CI)(M)" | Out-Null
Write-Ok $relDir

# --- 4. Backup ----------------------------------------------------------------------------
$backupScript = Join-Path $PSScriptRoot 'backup.ps1'
if ($SkipBackup) {
  Write-Warn 'Backup dilewati (-SkipBackup).'
} elseif (Test-Path $backupScript) {
  Write-Step 'Backup database sebelum migrasi'
  & $backupScript -Tag "predeploy-$commit"
} else {
  Write-Warn 'backup.ps1 belum ada (Tahap 6b) - migrasi berjalan tanpa backup otomatis.'
}

# --- 5. Ganti rilis -----------------------------------------------------------------------
$previous = Get-CurrentRelease
Write-Step 'Stop service, migrasi, ganti rilis'
Stop-AppService
Write-Ok 'Service berhenti'

Push-Location $SW.Src
try {
  Invoke-Native $node @("--env-file=$($SW.MigrateEnv)", '--import', 'tsx', 'src/server/db/migrate.ts', 'latest') 'Migrasi database'
} catch {
  Pop-Location
  if ($previous) { Start-AppService; Write-Warn "Migrasi gagal - service dinyalakan lagi dengan rilis lama ($previous)." }
  throw
}
Pop-Location
Write-Ok 'Migrasi database selesai'

Set-CurrentRelease $release
Start-AppService
Write-Info "Menunggu http://localhost:$port/api/health ..."
$health = Wait-Health -Port $port -TimeoutSec 90

# --- 6. Verifikasi / rollback --------------------------------------------------------------
if (-not $health -or $health.release -ne $release) {
  Write-Warn "Rilis baru tidak sehat (lihat log: $($SW.Logs))."
  if ($previous) {
    Stop-AppService
    Set-CurrentRelease $previous
    Start-AppService
    $back = Wait-Health -Port $port -TimeoutSec 60
    if ($back) { Write-Warn "Dikembalikan ke rilis $previous - aplikasi tetap jalan." }
    else { Write-Warn "Rilis lama $previous juga tidak sehat - cek log & PostgreSQL." }
    Write-Warn 'Catatan: migrasi database TIDAK dibatalkan otomatis.'
  }
  throw 'Deploy gagal.'
}
Write-Ok "Sehat: rilis $($health.release), database $($health.db)"

# --- 7. Bersih-bersih rilis lama ---------------------------------------------------------------
$all = Get-ChildItem -LiteralPath $SW.Releases -Directory | Sort-Object Name -Descending
$old = $all | Select-Object -Skip $Keep | Where-Object { $_.Name -ne $release -and $_.Name -ne $previous }
foreach ($d in $old) { Remove-Item -LiteralPath $d.FullName -Recurse -Force; Write-Info "Hapus rilis lama $($d.Name)" }

Write-Step 'Deploy selesai'
$mins = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
Write-Info "Rilis $release (commit $commit) aktif - $mins menit."
foreach ($a in @(Get-LanAddress)) { Write-Info "Buka dari PC lain: http://$($a.IPv4):$port" }
if ($previous) { Write-Info "Rollback bila perlu: powershell -ExecutionPolicy Bypass -File deploy\windows\rollback.ps1" }
