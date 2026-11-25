<#
.SYNOPSIS
  The resilience demo: responder-service goes down, the rest of the system keeps answering, then it comes back.
  Prints PASS/FAIL per step and sets the exit code (0 = all passed).

.DESCRIPTION
  1. Normal state: a MEDICAL incident is ASSIGNED.
  2. kubectl scale deploy/responder-service --replicas=0   (the service "crashes")
  3. A new incident is still accepted with 201 and status PENDING, quickly (timeout + circuit breaker + fallback).
     Login, listing incidents and notifications still work; GET /api/responders answers 503 (that service is down).
     A "waiting for a responder" notification still arrives (asynchronous event).
  4. kubectl scale deploy/responder-service --replicas=1   (it comes back)
  5. ADMIN dispatches the PENDING incident -> ASSIGNED, and the "assigned" notification arrives.
  The script always scales responder-service back to 1, even if a step fails, and resolves the incidents it created.

  .\scripts\demo-resilience.ps1
#>
param([string]$BaseUrl = 'http://localhost:8080')

. "$PSScriptRoot\lib.ps1"
$script:Base = $BaseUrl
$ErrorActionPreference = 'Continue'
$createdIncidents = @()
$adminToken = ''

try {
    if (-not (Ensure-Gateway $BaseUrl)) { exit 2 }

    $user = New-TestUser 'demo'
    $null = Api POST '/api/auth/register' $user
    $userToken = (Api POST '/api/auth/login' $user).Json.token
    $adminToken = (Api POST '/api/auth/login' @{ username = 'admin'; password = 'Admin@123' }).Json.token
    $fire = @{ type = 'FIRE'; severity = 'MEDIUM'; description = 'Demo: smoke from chemistry lab'; locationText = 'Science Block' }

    Write-Section '1. Normal state'
    $r = Api POST '/api/incidents' $fire $userToken
    Check 'incident is ASSIGNED while everything is up' ($r.Code -eq 201 -and $r.Json.status -eq 'ASSIGNED') "-> $($r.Code) $($r.Json.status) $($r.Json.assignedResponder.name)"
    if ($r.Json.id) { $createdIncidents += $r.Json.id }
    $r = Api GET '/api/responders' $null $userToken;  Check 'GET /api/responders works' ($r.Code -eq 200) "-> $($r.Code)"

    Write-Section '2. responder-service goes DOWN (scale to 0)'
    kubectl -n resqnet scale deploy/responder-service --replicas=0 | Out-Null
    $gone = Wait-Until { (kubectl -n resqnet get pod -l app=responder-service --no-headers 2>$null | Measure-Object).Count -eq 0 } 90 1000
    Check 'responder-service has no pods any more' ([bool]$gone)
    Start-Sleep 6   # give the service registry a moment to drop it (the system works without this wait, it is just tidier)

    Write-Section '3. The other services still answer'
    $r = Api POST '/api/incidents' $fire $userToken
    Check 'new incident is accepted: 201 with status PENDING' ($r.Code -eq 201 -and $r.Json.status -eq 'PENDING') "-> $($r.Code) $($r.Json.status)"
    Check 'the answer came back quickly (fallback, under 3 s)' ($r.Ms -lt 3000) "-> $($r.Ms) ms"
    $pending = $r.Json
    if ($pending.id) { $createdIncidents += $pending.id }
    $r = Api POST '/api/incidents' $fire $userToken;  Check 'a second incident is also PENDING (circuit breaker may be open now)' ($r.Code -eq 201 -and $r.Json.status -eq 'PENDING') "-> $($r.Code) $($r.Json.status) in $($r.Ms) ms"
    if ($r.Json.id) { $createdIncidents += $r.Json.id }
    $r = Api GET '/api/responders' $null $userToken;  Check 'GET /api/responders gives 503 (expected: that service is down)' ($r.Code -eq 503) "-> $($r.Code)"
    $r = Api POST '/api/auth/login' $user;            Check 'login still works' ($r.Code -eq 200) "-> $($r.Code)"
    $r = Api GET '/api/incidents' $null $userToken;   Check 'listing incidents still works' ($r.Code -eq 200 -and @($r.Json).Count -ge 3) "-> count=$(@($r.Json).Count)"
    $r = Api GET "/api/incidents/$($pending.id)" $null $userToken; Check 'reading a PENDING incident still works' ($r.Code -eq 200 -and $r.Json.status -eq 'PENDING') "-> $($r.Code)"
    $note = Wait-Until { $n = Api GET '/api/notifications' $null $userToken; if (@($n.Json | Where-Object { $_.type -eq 'INCIDENT_PENDING' }).Count -ge 1) { $n.Json } } 20
    Check 'the "waiting for a responder" notification arrived (RabbitMQ)' ($null -ne $note) "-> $(@($note | Where-Object { $_.type -eq 'INCIDENT_PENDING' }).Count) pending notification(s)"
    $r = Api POST "/api/incidents/$($pending.id)/resolve" $null $adminToken; Check 'resolving a PENDING incident is refused (409)' ($r.Code -eq 409) "-> $($r.Code)"

    Write-Section '4. responder-service comes BACK (scale to 1)'
    kubectl -n resqnet scale deploy/responder-service --replicas=1 | Out-Null
    $ready = Wait-PodReady 'responder-service' 180
    Check 'responder-service pod is Ready again' $ready

    Write-Section '5. Dispatch the waiting incident'
    $dispatched = Wait-Until { $d = Api POST "/api/incidents/$($pending.id)/dispatch" $null $adminToken; if ($d.Json.status -eq 'ASSIGNED') { $d } } 90 2000
    Check 'ADMIN dispatch turns the PENDING incident into ASSIGNED' ($null -ne $dispatched) "-> $($dispatched.Json.status) $($dispatched.Json.assignedResponder.name)"
    $note = Wait-Until { $n = Api GET '/api/notifications' $null $userToken; if (@($n.Json | Where-Object { $_.incidentId -eq $pending.id -and $_.type -eq 'INCIDENT_ASSIGNED' }).Count -ge 1) { $n.Json } } 20
    Check 'the "assigned" notification arrived' ($null -ne $note)
    $r = Api GET '/api/responders' $null $userToken;  Check 'GET /api/responders works again' ($r.Code -eq 200) "-> $($r.Code)"
}
finally {
    # Always leave the cluster healthy and tidy.
    $replicas = kubectl -n resqnet get deploy responder-service -o jsonpath='{.spec.replicas}' 2>$null
    if ($replicas -ne '1') { Write-Host "`nCleanup: scaling responder-service back to 1" -ForegroundColor Yellow; kubectl -n resqnet scale deploy/responder-service --replicas=1 | Out-Null; $null = Wait-PodReady 'responder-service' 180 }
    if ($adminToken) {
        Start-Sleep 12   # let the breaker/registry settle so the cleanup calls reach responder-service
        foreach ($id in $createdIncidents) { $null = Api POST "/api/incidents/$id/resolve" $null $adminToken }
    }
    Stop-Gateway
}
exit (Get-ExitCode 'demo-resilience')
