# =============================================================================
# SmartWMS V2 - fungsi & setelan bersama script server Windows.
# Dipakai dengan dot-source:  . "$PSScriptRoot\common.ps1"
# Target: Windows PowerShell 5.1 (bawaan Windows 11) - file ini sengaja ASCII saja.
# Panduan: docs/v2/DEPLOY-LOKAL.md
# =============================================================================

Set-StrictMode -Version 3
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest jauh lebih cepat tanpa progress bar

# --- Lokasi & nama (ARCHITECTURE D-12, D-32, D-33) ----------------------------
$SW = [ordered]@{
  Root        = 'C:\SmartWMS'
  ServiceId   = 'SmartWMS'
  DbName      = 'smartwms'
  OwnerRole   = 'smartwms_prod_owner'
  AppRole     = 'smartwms_prod_app'
  PgVersion   = '18'
  RepoUrl     = 'https://github.com/iyunn/smart-wmsV2.git'
  WinswUrl    = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'
}
$SW.Src        = "$($SW.Root)\src"        # clone khusus build produksi (bukan folder dev)
$SW.Releases   = "$($SW.Root)\releases"   # satu folder per rilis
$SW.App        = "$($SW.Root)\app"        # junction -> rilis yang sedang jalan
$SW.Config     = "$($SW.Root)\config"
$SW.Logs       = "$($SW.Root)\logs"
$SW.Bin        = "$($SW.Root)\bin"
$SW.Backups    = "$($SW.Root)\backups"
$SW.AppEnv     = "$($SW.Config)\smartwms.env"   # dibaca service (akun LocalService)
$SW.MigrateEnv = "$($SW.Config)\migrate.env"    # hanya Administrator
$SW.Secrets    = "$($SW.Config)\secrets.env"    # hanya Administrator
$SW.PgService  = "postgresql-x64-$($SW.PgVersion)"
$SW.PgBin      = "C:\Program Files\PostgreSQL\$($SW.PgVersion)\bin"

# SID bawaan Windows (dipakai icacls; nama akun bisa berbeda per bahasa Windows)
$SID_ADMINS        = '*S-1-5-32-544'
$SID_SYSTEM        = '*S-1-5-18'
$SID_LOCAL_SERVICE = '*S-1-5-19'

# --- Tampilan ---------------------------------------------------------------
function Write-Step([string]$Message) { Write-Host ''; Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "    OK   $Message" -ForegroundColor Green }
function Write-Info([string]$Message) { Write-Host "         $Message" }
function Write-Warn([string]$Message) { Write-Host "    !!   $Message" -ForegroundColor Yellow }

# --- Pemeriksaan ------------------------------------------------------------
function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Jalankan dari PowerShell "Run as administrator" (lihat docs/v2/DEPLOY-LOKAL.md).'
  }
}

function Find-Exe([string]$Name, [string[]]$Fallback = @()) {
  $cmd = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { return $cmd.Source }
  foreach ($p in $Fallback) { if (Test-Path $p) { return $p } }
  return $null
}

# Jalankan program eksternal; gagal (exit code != 0) -> berhenti dengan pesan jelas.
# Output TIDAK dialihkan: di PowerShell 5.1, stderr yang dialihkan dengan
# ErrorActionPreference=Stop dianggap error walau programnya berhasil (npm/git menulis ke stderr).
function Invoke-Native([string]$FilePath, [string[]]$ArgumentList, [string]$What) {
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) { throw "$What gagal (exit code $LASTEXITCODE)." }
}

# --- File konfigurasi KEY=VALUE ---------------------------------------------
function Read-EnvFile([string]$Path) {
  $map = [ordered]@{}
  if (Test-Path $Path) {
    foreach ($line in Get-Content -LiteralPath $Path) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { $map[$Matches[1]] = $Matches[2].Trim() }
    }
  }
  return $map
}

# Tulis/ubah kunci tertentu, kunci lain yang sudah ada dipertahankan.
function Write-EnvFile([string]$Path, [System.Collections.IDictionary]$Values, [string]$Header) {
  $map = Read-EnvFile $Path
  foreach ($k in $Values.Keys) { $map[$k] = $Values[$k] }
  $lines = @("# $Header", '# Dibuat/diubah oleh deploy/windows/setup-server.ps1 - JANGAN di-commit.')
  foreach ($k in $map.Keys) { $lines += "$k=$($map[$k])" }
  # UTF-8 tanpa BOM (node --env-file tidak suka BOM)
  [IO.File]::WriteAllLines($Path, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
}

# Password acak huruf+angka (tidak perlu di-URL-encode di connection string)
function New-Secret([int]$Length = 32) {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
  $bytes = New-Object byte[] $Length
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# Hak akses file/folder: hapus warisan, beri hak eksplisit. $Grants contoh: @("$SID_ADMINS:(F)")
function Set-Acl2([string]$Path, [string[]]$Grants, [switch]$Inherit) {
  $suffix = ''
  if ($Inherit) { $suffix = '(OI)(CI)' }
  $args2 = @($Path, '/inheritance:r')
  foreach ($g in $Grants) {
    $parts = $g -split ':', 2
    $args2 += '/grant:r'
    $args2 += "$($parts[0]):$suffix$($parts[1])"
  }
  & icacls.exe @args2 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls gagal untuk $Path" }
}

# --- Service & kesehatan ----------------------------------------------------
function Get-AppPort {
  $envMap = Read-EnvFile $SW.AppEnv
  if ($envMap.Contains('PORT')) { return [int]$envMap['PORT'] }
  return 3000
}

function Wait-Health([int]$Port, [int]$TimeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 5 -UseBasicParsing
      if ($r.status -eq 'ok') { return $r }
    } catch { Start-Sleep -Seconds 2 }
    Start-Sleep -Milliseconds 500
  }
  return $null
}

function Get-CurrentRelease {
  if (-not (Test-Path $SW.App)) { return $null }
  $item = Get-Item -LiteralPath $SW.App -Force
  if ($item.LinkType -ne 'Junction') { throw "$($SW.App) ada tapi bukan junction - periksa manual." }
  return Split-Path -Leaf ([string]($item.Target | Select-Object -First 1))
}

# Arahkan C:\SmartWMS\app ke folder rilis. PENTING: junction dihapus dengan `rmdir`
# (cmd), bukan Remove-Item -Recurse - yang terakhir bisa ikut menghapus isi rilis.
function Set-CurrentRelease([string]$ReleaseName) {
  $target = Join-Path $SW.Releases $ReleaseName
  if (-not (Test-Path $target)) { throw "Rilis $ReleaseName tidak ditemukan di $($SW.Releases)." }
  if (Test-Path $SW.App) {
    cmd.exe /c rmdir "$($SW.App)" | Out-Null
    if (Test-Path $SW.App) { throw "Gagal melepas junction $($SW.App)." }
  }
  New-Item -ItemType Junction -Path $SW.App -Target $target | Out-Null
}

function Stop-AppService {
  $svc = Get-Service -Name $SW.ServiceId -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Stopped') {
    Stop-Service -Name $SW.ServiceId -Force
    $svc.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
  }
}

function Start-AppService {
  Start-Service -Name $SW.ServiceId
  (Get-Service -Name $SW.ServiceId).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
}

function Get-LanAddress {
  Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object {
      [pscustomobject]@{
        Adapter = $_.InterfaceAlias
        IPv4    = ($_.IPv4Address | Select-Object -First 1).IPAddress
        MAC     = $_.NetAdapter.MacAddress
        Profile = (Get-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).NetworkCategory
      }
    }
}
