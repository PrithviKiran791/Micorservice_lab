<#
.SYNOPSIS
  Gives the gateway a temporary PUBLIC https URL (a free Cloudflare "quick tunnel" to your laptop) for the demo.

.DESCRIPTION
  What it does:
    1. makes sure the gateway is reachable locally (starts "kubectl port-forward svc/api-gateway 8080:8080" if needed),
    2. starts tools\cloudflared\cloudflared.exe:  cloudflared tunnel --url http://127.0.0.1:8080
       (a free quick tunnel: no account, no cost; the address looks like https://random-words.trycloudflare.com and
        CHANGES every time you start it),
    3. waits until the public address answers, prints it, and keeps the tunnel open
       (until Ctrl+C, or for -Minutes N, or it runs one smoke test through the public address with -Check),
    4. always stops the tunnel (and the port-forward it started) at the end.

  Honest description of what this is: a tunnel to the Minikube cluster running ON YOUR LAPTOP. It is not cloud hosting.
  The laptop must stay on and connected, and anyone who has the link can use the system, INCLUDING the demo admin
  login (admin / Admin@123). Start it only for the demo and stop it afterwards.

  The cloudflared.exe is NOT in Git (tools/ is ignored). Official download used:
  https://github.com/cloudflare/cloudflared/releases  (cloudflared-windows-amd64.exe, SHA-256 checked, signed by Cloudflare, Inc.)

  .\scripts\start-public-url.ps1               # keep it open until Ctrl+C
  .\scripts\start-public-url.ps1 -Minutes 30   # keep it open for 30 minutes
  .\scripts\start-public-url.ps1 -Check        # open it, run scripts\smoke-test.ps1 against the public URL, close it
#>
param(
    [int]$Minutes = 0,
    [switch]$Check,
    [int]$LocalPort = 8080
)

. "$PSScriptRoot\lib.ps1"
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'tools\cloudflared\cloudflared.exe'
if (-not (Test-Path $exe)) {
    Write-Host "cloudflared.exe not found at $exe" -ForegroundColor Red
    Write-Host "Download cloudflared-windows-amd64.exe from https://github.com/cloudflare/cloudflared/releases (official), save it as tools\cloudflared\cloudflared.exe" -ForegroundColor Yellow
    exit 2
}

# Reads a text file that another process is still writing to (a plain ReadAllText would fail with "in use").
function Read-SharedText([string]$Path) {
    try {
        $fs = New-Object IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        $sr = New-Object IO.StreamReader($fs)
        $text = $sr.ReadToEnd(); $sr.Dispose(); $fs.Dispose()
        return $text
    } catch { return '' }
}
$local = "http://localhost:$LocalPort"
$tunnel = $null
$exitCode = 0
$errLog = Join-Path $env:TEMP "cloudflared-$PID.err"
$outLog = Join-Path $env:TEMP "cloudflared-$PID.out"

try {
    if (-not (Ensure-Gateway $local)) { exit 2 }

    Write-Host "Starting the Cloudflare quick tunnel..." -ForegroundColor Cyan
    $tunnel = Start-Process $exe -ArgumentList "tunnel --no-autoupdate --url http://127.0.0.1:$LocalPort" -PassThru -WindowStyle Hidden -RedirectStandardError $errLog -RedirectStandardOutput $outLog

    $url = $null
    for ($i = 0; $i -lt 40 -and -not $url; $i++) {
        Start-Sleep 1
        if (Test-Path $errLog) {
            $m = [regex]::Match((Read-SharedText $errLog), 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($m.Success) { $url = $m.Value }
        }
        if ($tunnel.HasExited) { break }
    }
    if (-not $url) { Write-Host 'The tunnel did not give an address. Last log lines:' -ForegroundColor Red; (Read-SharedText $errLog) -split "`n" | Select-Object -Last 8; $exitCode = 1; exit 1 }

    # the public name needs a few seconds before it answers
    $up = $false
    for ($i = 0; $i -lt 45 -and -not $up; $i++) {
        try { $up = ((Invoke-WebRequest "$url/actuator/health" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) } catch { Start-Sleep 2 }
    }
    if (-not $up) { Write-Host "Tunnel started but $url does not answer yet." -ForegroundColor Red; exit 1 }

    Write-Host ""
    Write-Host "PUBLIC URL:  $url" -ForegroundColor Green
    Write-Host "   health:   $url/actuator/health"
    Write-Host "   API:      $url/api/...   (log in with POST $url/api/auth/login)"
    Write-Host "This is a tunnel to YOUR laptop. Anyone with the link can use it, including the demo admin login. Stop it after the demo." -ForegroundColor Yellow
    Write-Host ""

    if ($Check) {
        Write-Host "Running scripts\smoke-test.ps1 against the public URL..." -ForegroundColor Cyan
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'smoke-test.ps1') -BaseUrl $url
        $exitCode = $LASTEXITCODE
    }
    elseif ($Minutes -gt 0) {
        Write-Host "Keeping the tunnel open for $Minutes minute(s)..."
        Start-Sleep -Seconds ($Minutes * 60)
    }
    else {
        Write-Host "Tunnel is open. Press Ctrl+C to close it."
        while (-not $tunnel.HasExited) { Start-Sleep 5 }
    }
}
finally {
    if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue; Write-Host "Tunnel closed." }
    Remove-Item $errLog, $outLog -Force -ErrorAction SilentlyContinue
    Stop-Gateway
}
exit $exitCode
