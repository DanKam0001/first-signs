# First Signs live trial on this PC: real server/ + the TV app in a browser + this PC's webcam as "the phone".
#
#   powershell -ExecutionPolicy Bypass -File tv\scripts\live-trial.ps1            # localhost, webcam
#   powershell -ExecutionPolicy Bypass -File tv\scripts\live-trial.ps1 -Tunnel    # also a cloudflared https URL for a real phone
#
# Keys in the TV window: arrows = D-pad, Enter = OK, Escape = Back. Close the two server windows to stop.
# -NoBrowser -Hidden: start everything without any visible window (used for headless checks).
param([switch]$Tunnel, [switch]$NoBrowser, [switch]$Hidden, [int]$WebPort = 8091)
$ErrorActionPreference = 'Stop'
$tv = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $tv
$server = Join-Path $root 'server'

function PortOpen($port) {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $port); $c.Close(); return $true } catch { return $false }
}

# 1. Server on 8788 (reuse one that is already running).
if (PortOpen 8788) {
  Write-Host '[live-trial] server/ already running on :8788 - reusing it'
} else {
  if (-not (Test-Path (Join-Path $server 'node_modules'))) { Push-Location $server; npm install; Pop-Location }
  $script = if ($Tunnel) { 'live' } else { 'start' }
  $envCmd = if ($Tunnel) { '' } else { '$env:PUBLIC_URL=''http://localhost:8788''; ' }
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "$envCmd Set-Location '$server'; npm run $script" -WindowStyle $(if ($Hidden) { 'Hidden' } else { 'Normal' })
  Write-Host "[live-trial] starting server/ (npm run $script) in a new window..."
  for ($i = 0; $i -lt 60 -and -not (PortOpen 8788); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (PortOpen 8788)) { throw 'server/ did not come up on :8788 - check its window' }
}

# 2. TV web build (export once if missing), served on $WebPort.
if (-not (Test-Path (Join-Path $tv 'dist-web\index.html'))) {
  Write-Host '[live-trial] exporting the TV web build (one time, ~1 min)...'
  Push-Location $tv; npm run export:web; Pop-Location
}
if (-not (PortOpen $WebPort)) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$tv'; node scripts/serve-web.js --port $WebPort" -WindowStyle $(if ($Hidden) { 'Hidden' } else { 'Minimized' })
  for ($i = 0; $i -lt 20 -and -not (PortOpen $WebPort); $i++) { Start-Sleep -Milliseconds 300 }
}

# 3. Open the TV window.
$tvUrl = "http://localhost:$WebPort/?server=ws://localhost:8788/ws"
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $NoBrowser) {
  if ($chrome) { Start-Process $chrome -ArgumentList '--new-window', $tvUrl } else { Start-Process $tvUrl }
}

Write-Host ''
Write-Host "  TV window : $tvUrl"
Write-Host '  Phone     : on the TV pairing screen press "Use this PC''s webcam" (opens http://localhost:8788/p/<code>),'
Write-Host '              or open http://localhost:8788/p/<4-digit code shown on the TV> in a second window and allow the camera.'
if ($Tunnel) { Write-Host '              Real phone: scan the QR on the TV (it encodes the https tunnel URL printed in the server window).' }
Write-Host '  Keys      : arrows = D-pad, Enter = OK, Escape = Back'
Write-Host '  Health    : http://localhost:8788/healthz'
