<#
.SYNOPSIS
  Failover demo: one of the two incident-service pods is deleted while requests keep flowing.
  Passes only if EVERY request still gets HTTP 200. Exit code 0 = all passed.

.DESCRIPTION
  1. Makes sure incident-service runs two ready pods (kubectl scale ... --replicas=2).
  2. Sends GET /api/incidents about 5 times per second for 30 seconds.
  3. After 3 seconds it deletes one of the two pods (kubectl delete pod).
  The gateway notices the dead copy by itself: GET requests that hit it are retried on the other copy
  (see api-gateway config/GatewayRoutes.java), so the caller sees no error. Kubernetes starts a replacement pod.
  Only GET is retried automatically; a POST sent in that same second can still fail once and should be repeated by the caller.

  .\scripts\demo-failover.ps1
#>
param([string]$BaseUrl = 'http://localhost:8080', [int]$Seconds = 30)

. "$PSScriptRoot\lib.ps1"
$script:Base = $BaseUrl
$ErrorActionPreference = 'Continue'

function Get-ReadyIncidentPods {
    $raw = kubectl -n resqnet get pod -l app=incident-service -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}'
    return @(("$raw" -split ' ') | Where-Object { $_ })
}

try {
    if (-not (Ensure-Gateway $BaseUrl)) { exit 2 }

    $user = New-TestUser 'failover'
    $null = Api POST '/api/auth/register' $user
    $token = (Api POST '/api/auth/login' $user).Json.token

    Write-Section '1. Two incident-service pods are running'
    kubectl -n resqnet scale deploy/incident-service --replicas=2 | Out-Null
    $ready = Wait-Until { (Get-ReadyIncidentPods).Count -ge 2 } 180 2000
    Check 'two incident-service pods are Ready' ([bool]$ready)
    Start-Sleep 8   # let both pods appear in the service registry
    $warm = 1..12 | ForEach-Object { (Api GET '/api/incidents' $null $token).Pod }
    $podsBefore = @($warm | Where-Object { $_ } | Sort-Object -Unique)
    Check 'requests are answered by both pods' ($podsBefore.Count -ge 2) "-> $($podsBefore -join ', ')"
    $victim = (kubectl -n resqnet get pod -l app=incident-service -o jsonpath='{.items[0].metadata.name}')

    Write-Section "2. Delete pod $victim while requests keep flowing ($Seconds s)"
    $codes = New-Object System.Collections.Generic.List[int]
    $slow = 0; $maxMs = 0; $deleted = $false
    $clock = [Diagnostics.Stopwatch]::StartNew()
    while ($clock.Elapsed.TotalSeconds -lt $Seconds) {
        if (-not $deleted -and $clock.Elapsed.TotalSeconds -ge 3) {
            kubectl -n resqnet delete pod $victim --wait=false | Out-Null
            Write-Host ("   t={0:N1}s  kubectl delete pod {1}" -f $clock.Elapsed.TotalSeconds, $victim) -ForegroundColor Yellow
            $deleted = $true
        }
        $r = Api GET '/api/incidents' $null $token
        $codes.Add($r.Code)
        if ($r.Ms -gt $maxMs) { $maxMs = $r.Ms }
        if ($r.Ms -gt 2000) { $slow++ }
        if ($r.Code -ne 200) { Write-Host ("   t={0:N1}s  HTTP {1} ({2} ms)" -f $clock.Elapsed.TotalSeconds, $r.Code, $r.Ms) -ForegroundColor Red }
        Start-Sleep -Milliseconds 200
    }
    $bad = @($codes | Where-Object { $_ -ne 200 }).Count
    Check "all $($codes.Count) requests during the failover returned HTTP 200" ($bad -eq 0) "-> $bad failed"
    Check 'no request was slow (every answer under 2 s)' ($slow -eq 0) "-> slowest $maxMs ms"

    Write-Section '3. Kubernetes replaced the pod'
    $ready = Wait-Until { (Get-ReadyIncidentPods).Count -ge 2 } 180 2000
    Check 'two Ready incident-service pods again' ([bool]$ready)
    $namesRaw = kubectl -n resqnet get pod -l app=incident-service -o jsonpath='{.items[*].metadata.name}'
    $names = @(("$namesRaw" -split ' ') | Where-Object { $_ })
    Check 'the deleted pod was replaced by a new one' ($names -notcontains $victim) "-> $($names -join ', ')"
    Start-Sleep 8
    $after = 1..12 | ForEach-Object { (Api GET '/api/incidents' $null $token).Pod }
    $podsAfter = @($after | Where-Object { $_ } | Sort-Object -Unique)
    Check 'both pods answer again' ($podsAfter.Count -ge 2) "-> $($podsAfter -join ', ')"
}
finally {
    Stop-Gateway
}
exit (Get-ExitCode 'demo-failover')
