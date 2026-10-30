# =============================================================================
# SmartWMS V2 - akun database BACA-SAJA untuk pgAdmin (ARCHITECTURE D-36).
#
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-viewer.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\windows\setup-viewer.ps1 -NewPassword
#
# Membuat role "smartwms_viewer": hanya bisa SELECT di database produksi, semua transaksi
# read-only. Dipakai untuk melihat data / membuat laporan tanpa risiko mengubah data.
# Password ditampilkan SEKALI di layar dan disimpan di C:\SmartWMS\config\secrets.env.
# =============================================================================
param([switch]$NewPassword)

. "$PSScriptRoot\common.ps1"
Assert-Admin

$conn = Get-DbConnection $SW.MigrateEnv 'DATABASE_URL_OWNER'
$secrets = Read-EnvFile $SW.Secrets
$fresh = $NewPassword -or -not $secrets.Contains('VIEWER_PW')
$pw = $null
if ($fresh) { $pw = New-Secret 20 } else { $pw = $secrets['VIEWER_PW'] }

Write-Step "Akun baca-saja $($SW.ViewerRole)"
$pgPw = Read-PostgresPassword
$env:SMARTWMS_VIEWER_PW = $pw
try {
  Invoke-Pg 'psql.exe' @('-h', $conn.Host, '-p', $conn.Port, '-U', 'postgres', '-d', 'postgres', '-q',
    '-v', "viewer_role=$($SW.ViewerRole)", '-v', "dbname=$($conn.Db)", '-v', "owner_role=$($SW.OwnerRole)",
    '-f', (Join-Path $PSScriptRoot 'viewer.sql')) $pgPw 'Membuat akun baca-saja'
} finally { Remove-Item Env:SMARTWMS_VIEWER_PW -ErrorAction SilentlyContinue }

if ($fresh) { Write-EnvFile $SW.Secrets ([ordered]@{ VIEWER_PW = $pw }) 'Password role PostgreSQL produksi SmartWMS - RAHASIA' }
Set-Acl2 $SW.Secrets @("${SID_ADMINS}:(F)", "${SID_SYSTEM}:(F)")

Write-Step 'Data koneksi pgAdmin (catat di tempat aman)'
Write-Info "Host     : localhost"
Write-Info "Port     : $($conn.Port)"
Write-Info "Database : $($conn.Db)"
Write-Info "Username : $($SW.ViewerRole)"
if ($fresh) { Write-Info "Password : $pw" }
else { Write-Info "Password : (tidak berubah - lihat VIEWER_PW di $($SW.Secrets))" }
