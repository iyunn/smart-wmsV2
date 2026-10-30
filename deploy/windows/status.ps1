# =============================================================================
# SmartWMS V2 - cek cepat kondisi server (tidak mengubah apa pun).
#   powershell -ExecutionPolicy Bypass -File deploy\windows\status.ps1
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
foreach ($a in @(Get-LanAddress)) { Write-Info "URL LAN    : http://$($a.IPv4):$port  ($($a.Adapter), profil $($a.Profile))" }

Write-Step 'Disk'
$drive = Get-PSDrive -Name ($SW.Root.Substring(0, 1))
Write-Info ('{0}: bebas {1:N1} GB dari {2:N1} GB' -f $drive.Name, ($drive.Free / 1GB), (($drive.Used + $drive.Free) / 1GB))

Write-Step 'Log terbaru'
$log = Get-ChildItem -LiteralPath $SW.Logs -Filter '*.err.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($log) { Write-Info "$($log.FullName) (5 baris terakhir):"; Get-Content -LiteralPath $log.FullName -Tail 5 | ForEach-Object { Write-Info "  $_" } }
else { Write-Info '(belum ada log error)' }
