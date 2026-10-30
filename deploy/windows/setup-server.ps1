# =============================================================================
# SmartWMS V2 - setup PC server (SEKALI di awal; aman dijalankan ulang).
#
#   Jalankan di PowerShell "Run as administrator", dari folder repo:
#     powershell -ExecutionPolicy Bypass -File deploy\windows\setup-server.ps1
#
# Yang dikerjakan (docs/v2/DEPLOY-LOKAL.md, ROADMAP Tahap 6a):
#   1. Cek prasyarat (Windows, Node.js, Git, PostgreSQL 18)
#   2. Folder C:\SmartWMS\{releases,config,logs,bin,backups}
#   3. Kredensial database produksi (acak, disimpan di C:\SmartWMS\config, hanya Administrator)
#   4. Database `smartwms` + role produksi sendiri (D-32)
#   5. Setelan PostgreSQL (localhost saja, memori untuk RAM 8 GB) + restart PostgreSQL
#   6. Windows Service "SmartWMS" via WinSW, akun LocalService (belum dijalankan)
#   7. Firewall: port aplikasi hanya untuk jaringan Domain/Private
#   8. PC tidak tidur saat tersambung listrik
# Setelah ini: jalankan deploy.ps1 untuk build & menyalakan aplikasi.
# =============================================================================
param(
  [int]$Port = 3000,
  [switch]$NewCredentials   # buat ulang password role produksi (password lama tidak berlaku)
)

. "$PSScriptRoot\common.ps1"
Assert-Admin
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')

# --- 1. Prasyarat ------------------------------------------------------------
Write-Step 'Cek prasyarat'
$os = Get-CimInstance Win32_OperatingSystem
Write-Ok "$($os.Caption) (build $($os.BuildNumber))"

$node = Find-Exe 'node.exe' @('C:\Program Files\nodejs\node.exe')
if (-not $node) { throw 'Node.js tidak ditemukan. Pasang Node.js 24 LTS (installer Windows dari nodejs.org).' }
$nodeVer = (& $node -v).TrimStart('v')
if ([version]$nodeVer -lt [version]'22.12.0') { throw "Node.js $nodeVer terlalu lama - minimal 22.12 (disarankan 24 LTS)." }
Write-Ok "Node.js $nodeVer  ($node)"
if ($node -like "$env:USERPROFILE*" -or $node -like '*\AppData\*') {
  Write-Warn 'Node.js terpasang di folder user - akun service (LocalService) mungkin tidak bisa membacanya.'
  Write-Warn 'Disarankan pasang ulang dengan installer resmi ke C:\Program Files\nodejs.'
}

$git = Find-Exe 'git.exe' @('C:\Program Files\Git\cmd\git.exe', 'C:\msys64\usr\bin\git.exe', 'C:\msys64\ucrt64\bin\git.exe')
if (-not $git) { throw 'Git tidak ditemukan di PowerShell. Pasang Git for Windows: winget install Git.Git' }
Write-Ok "Git ($git)"

if (-not (Test-Path (Join-Path $SW.PgBin 'psql.exe'))) { throw "PostgreSQL $($SW.PgVersion) tidak ditemukan di $($SW.PgBin)." }
$pgSvc = Get-Service -Name $SW.PgService -ErrorAction SilentlyContinue
if (-not $pgSvc) { throw "Service $($SW.PgService) tidak ditemukan." }
if ($pgSvc.Status -ne 'Running') { Start-Service $SW.PgService; Write-Info "Service $($SW.PgService) dinyalakan." }
Write-Ok "PostgreSQL $($SW.PgVersion) (service $($SW.PgService))"

# --- 2. Folder ---------------------------------------------------------------
Write-Step "Folder $($SW.Root)"
foreach ($d in @($SW.Root, $SW.Releases, $SW.Config, $SW.Logs, $SW.Bin, $SW.Backups)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}
# Root & rilis: Administrator penuh, service hanya baca/jalankan
Set-Acl2 $SW.Root     @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)", "${SID_LOCAL_SERVICE}:(RX)") -Inherit
Set-Acl2 $SW.Logs     @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)", "${SID_LOCAL_SERVICE}:(M)") -Inherit
Set-Acl2 $SW.Config   @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)") -Inherit
& icacls.exe $SW.Config /grant "${SID_LOCAL_SERVICE}:(RX)" | Out-Null   # buka folder saja, tidak diwariskan ke file
Set-Acl2 $SW.Backups  @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)") -Inherit
Write-Ok 'releases, config, logs, bin, backups (hak akses dibatasi)'

# --- 3. Kredensial -------------------------------------------------------------
Write-Step 'Kredensial database produksi'
$secrets = Read-EnvFile $SW.Secrets
$fresh = $NewCredentials -or -not ($secrets.Contains('OWNER_PW') -and $secrets.Contains('APP_PW'))
if ($fresh) {
  $secrets = [ordered]@{ OWNER_PW = (New-Secret); APP_PW = (New-Secret) }
  Write-EnvFile $SW.Secrets $secrets 'Password role PostgreSQL produksi SmartWMS - RAHASIA'
  Write-Ok "Password baru dibuat -> $($SW.Secrets)"
} else {
  Write-Ok 'Memakai password yang sudah ada (pakai -NewCredentials untuk membuat ulang)'
}

# --- 4. Database ---------------------------------------------------------------
Write-Step "Database $($SW.DbName)"
Write-Info 'Masukkan password superuser "postgres" (yang dibuat saat instal PostgreSQL).'
$pgPwSecure = Read-Host -AsSecureString 'Password postgres'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPwSecure)
try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

$psql = Join-Path $SW.PgBin 'psql.exe'
try {
  $pgPort = (& $psql -h localhost -U postgres -d postgres -Atc 'show port')
  if ($LASTEXITCODE -ne 0) { throw 'Tidak bisa login sebagai postgres - password salah?' }
  $pgPort = [int]($pgPort | Select-Object -First 1)
  Write-Ok "Terhubung ke PostgreSQL (port $pgPort)"

  $env:SMARTWMS_OWNER_PW = $secrets['OWNER_PW']
  $env:SMARTWMS_APP_PW = $secrets['APP_PW']
  $setupArgs = @('-h', 'localhost', '-U', 'postgres', '-d', 'postgres', '-q',
    '-v', "dbname=$($SW.DbName)", '-v', "owner_role=$($SW.OwnerRole)", '-v', "app_role=$($SW.AppRole)",
    '-f', (Join-Path $PSScriptRoot 'setup-db.sql'))
  if ($fresh) { $setupArgs = @('-v', 'sync_pw=1') + $setupArgs }
  Invoke-Native $psql $setupArgs 'Setup database'

  # --- 5. Setelan PostgreSQL ---------------------------------------------------
  Write-Step 'Setelan PostgreSQL (D-34)'
  Invoke-Native $psql @('-h', 'localhost', '-U', 'postgres', '-d', 'postgres', '-q', '-f', (Join-Path $PSScriptRoot 'tune-postgres.sql')) 'Setelan PostgreSQL'
  Write-Info "Restart $($SW.PgService) (database dev ikut restart beberapa detik)..."
  Restart-Service -Name $SW.PgService -Force
  (Get-Service $SW.PgService).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
  Start-Sleep -Seconds 2
  $listen = (& $psql -h localhost -U postgres -d postgres -Atc 'show listen_addresses' | Select-Object -First 1)
  if ($listen -ne 'localhost') { throw "listen_addresses masih '$listen' - periksa postgresql.conf." }
  Write-Ok 'PostgreSQL hanya menerima koneksi dari PC ini (listen_addresses = localhost)'
}
finally {
  Remove-Item Env:PGPASSWORD, Env:SMARTWMS_OWNER_PW, Env:SMARTWMS_APP_PW -ErrorAction SilentlyContinue
}

# --- File environment aplikasi & migrasi -----------------------------------------
Write-Step 'File konfigurasi'
$appUrl = "postgres://$($SW.AppRole):$($secrets['APP_PW'])@localhost:$pgPort/$($SW.DbName)"
$ownerUrl = "postgres://$($SW.OwnerRole):$($secrets['OWNER_PW'])@localhost:$pgPort/$($SW.DbName)"
$appEnv = [ordered]@{
  NODE_ENV = 'production'
  PORT = "$Port"
  HOSTNAME = '0.0.0.0'
  DATABASE_URL = $appUrl
  NEXT_TELEMETRY_DISABLED = '1'
}
$current = Read-EnvFile $SW.AppEnv
if (-not $current.Contains('SESSION_TTL_HOURS')) { $appEnv['SESSION_TTL_HOURS'] = '12' }
if (-not $current.Contains('SESSION_COOKIE_SECURE')) { $appEnv['SESSION_COOKIE_SECURE'] = 'false' }
Write-EnvFile $SW.AppEnv $appEnv 'Environment service SmartWMS (produksi)'
Write-EnvFile $SW.MigrateEnv ([ordered]@{ DATABASE_URL_OWNER = $ownerUrl }) 'Koneksi migrasi produksi (owner) - hanya untuk deploy.ps1'
# Service hanya boleh MEMBACA smartwms.env; migrate.env & secrets.env hanya Administrator
Set-Acl2 $SW.AppEnv     @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)", "${SID_LOCAL_SERVICE}:(R)")
Set-Acl2 $SW.MigrateEnv @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)")
Set-Acl2 $SW.Secrets    @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)")
Write-Ok "$($SW.AppEnv)  (port aplikasi $Port)"
Write-Ok "$($SW.MigrateEnv)"

# --- 6. Windows Service (WinSW) -------------------------------------------------
Write-Step "Windows Service $($SW.ServiceId)"
$winsw = Join-Path $SW.Bin "$($SW.ServiceId).exe"
if (-not (Test-Path $winsw)) {
  Write-Info "Unduh WinSW v2.12.0 dari GitHub resmi..."
  Invoke-WebRequest -Uri $SW.WinswUrl -OutFile $winsw -UseBasicParsing
}
$sig = (Get-FileHash $winsw -Algorithm SHA256).Hash
Write-Ok "WinSW: $winsw"
Write-Info "SHA256 $sig"

$xmlPath = Join-Path $SW.Bin "$($SW.ServiceId).xml"
$xml = @"
<service>
  <id>$($SW.ServiceId)</id>
  <name>SmartWMS V2</name>
  <description>SmartWMS V2 - Next.js (standalone) di port $Port. Dikelola deploy/windows/*.ps1</description>
  <executable>$node</executable>
  <arguments>--env-file="$($SW.AppEnv)" "$($SW.App)\server.js"</arguments>
  <workingdirectory>$($SW.App)</workingdirectory>
  <startmode>Automatic</startmode>
  <depend>$($SW.PgService)</depend>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <onfailure action="restart" delay="2 min"/>
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15 sec</stoptimeout>
  <logpath>$($SW.Logs)</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
  <serviceaccount>
    <domain>NT AUTHORITY</domain>
    <user>LocalService</user>
  </serviceaccount>
</service>
"@
[IO.File]::WriteAllText($xmlPath, $xml, (New-Object Text.UTF8Encoding($false)))

$existing = Get-Service -Name $SW.ServiceId -ErrorAction SilentlyContinue
if ($existing) {
  Write-Info 'Service sudah ada - dipasang ulang dengan konfigurasi terbaru.'
  Stop-AppService
  Invoke-Native $winsw @('uninstall') 'Uninstall service lama'
  Start-Sleep -Seconds 2
}
Invoke-Native $winsw @('install') 'Install service'
Write-Ok "Service $($SW.ServiceId) terpasang (otomatis menyala saat Windows start, akun LocalService)"
if (-not (Test-Path $SW.App)) { Write-Info 'Belum dijalankan - aplikasi dipasang oleh deploy.ps1.' }

# --- 7. Firewall ---------------------------------------------------------------
Write-Step 'Firewall'
$ruleName = "SmartWMS V2 (TCP $Port)"
Get-NetFirewallRule -DisplayName 'SmartWMS V2 (TCP *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port `
  -Action Allow -Profile Domain, Private -Description 'SmartWMS V2 - akses LAN kantor' | Out-Null
Write-Ok "Inbound TCP $Port diizinkan untuk profil jaringan Domain & Private (bukan Public)"

$pgRules = Get-NetFirewallPortFilter -Protocol TCP -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq "$pgPort" } | Get-NetFirewallRule -ErrorAction SilentlyContinue |
  Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' }
foreach ($r in @($pgRules)) {
  if ($r) { Write-Warn "Rule firewall '$($r.DisplayName)' membuka port PostgreSQL $pgPort. Tidak berbahaya (PostgreSQL hanya localhost), tapi boleh dinonaktifkan." }
}

$lan = @(Get-LanAddress)
foreach ($a in $lan) {
  if ($a.Profile -eq 'Public') {
    Write-Warn "Jaringan '$($a.Adapter)' berprofil Public -> PC lain tidak bisa akses. Ubah ke Private:"
    Write-Warn "  Settings > Network & internet > $($a.Adapter) > Network profile type: Private network"
  }
}

# --- 8. Daya ------------------------------------------------------------------
Write-Step 'Pengaturan daya'
& powercfg.exe /change standby-timeout-ac 0
& powercfg.exe /change hibernate-timeout-ac 0
Write-Ok 'PC tidak sleep/hibernate saat tersambung listrik (layar tetap boleh mati)'

# --- Ringkasan -----------------------------------------------------------------
Write-Step 'Selesai'
foreach ($a in $lan) {
  Write-Info "Adapter $($a.Adapter): IP $($a.IPv4), MAC $($a.MAC), profil $($a.Profile)"
}
Write-Info 'Langkah berikutnya:'
Write-Info '  1. Buat DHCP reservation di router untuk MAC di atas (IP tidak berubah).'
Write-Info "  2. powershell -ExecutionPolicy Bypass -File $repoRoot\deploy\windows\deploy.ps1"
