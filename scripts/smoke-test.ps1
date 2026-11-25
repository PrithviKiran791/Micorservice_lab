<#
.SYNOPSIS
  Quick end-to-end check of the whole system through the API gateway. Prints PASS/FAIL per step and sets the exit code
  (0 = everything passed, 1 = at least one failure).

.DESCRIPTION
  Covers: health, security (401 / 403 / forged header / internal not routed), register, login, report an incident
  (synchronous call to responder-service), the asynchronous notification, admin dispatch/resolve rules, validation errors.
  Safe to run many times: it creates fresh users and resolves the incident it creates, so the responder is freed again.
  If the gateway is not reachable it starts "kubectl port-forward svc/api-gateway" by itself.

  .\scripts\smoke-test.ps1
  .\scripts\smoke-test.ps1 -BaseUrl http://localhost:8080
#>
param([string]$BaseUrl = 'http://localhost:8080')

. "$PSScriptRoot\lib.ps1"
$script:Base = $BaseUrl
$ErrorActionPreference = 'Continue'

try {
    if (-not (Ensure-Gateway $BaseUrl)) { exit 2 }

    Write-Section '1. Health and gateway security'
    $r = Api GET '/actuator/health';                         Check 'GET /actuator/health (public)' ($r.Code -eq 200) "-> $($r.Code)"
    $r = Api GET '/api/incidents';                           Check 'GET /api/incidents without token is rejected' ($r.Code -eq 401) "-> $($r.Code)"
    $r = Api GET '/api/incidents' $null 'garbage.token.value'; Check 'GET /api/incidents with a garbage token is rejected' ($r.Code -eq 401) "-> $($r.Code)"
    $r = Api POST '/internal/responders/assign' @{ incidentId = 1; incidentType = 'FIRE' } ; Check 'POST /internal/... is not routed by the gateway' ($r.Code -eq 401 -or $r.Code -eq 404) "-> $($r.Code)"

    Write-Section '2. Register and login'
    $user = New-TestUser 'smoke'
    $r = Api POST '/api/auth/register' $user;                Check 'register a new user' ($r.Code -eq 201 -and $r.Json.role -eq 'USER') "-> $($r.Code) role=$($r.Json.role)"
    $r = Api POST '/api/auth/register' $user;                Check 'register the same username again' ($r.Code -eq 409 -and $r.Json.code -eq 'USERNAME_TAKEN') "-> $($r.Code) $($r.Json.code)"
    $evil = New-TestUser 'smokeevil'; $evil.role = 'ADMIN'
    $r = Api POST '/api/auth/register' $evil;               Check 'registering with role ADMIN still gives USER' ($r.Code -eq 201 -and $r.Json.role -eq 'USER') "-> role=$($r.Json.role)"
    $r = Api POST '/api/auth/login' @{ username = $user.username; password = 'wrong-password' }; Check 'login with a wrong password' ($r.Code -eq 401 -and $r.Json.code -eq 'INVALID_CREDENTIALS') "-> $($r.Code)"
    $r = Api POST '/api/auth/login' $user;                   Check 'login' ($r.Code -eq 200 -and $r.Json.token) "-> $($r.Code)"
    $userToken = $r.Json.token
    $r = Api POST '/api/auth/login' @{ username = 'admin'; password = 'Admin@123' }; Check 'admin login (seeded account)' ($r.Code -eq 200 -and $r.Json.user.role -eq 'ADMIN') "-> $($r.Code)"
    $adminToken = $r.Json.token
    $r = Api GET '/api/auth/me' $null $userToken;            Check 'GET /api/auth/me' ($r.Code -eq 200 -and $r.Json.username -eq $user.username) "-> $($r.Code)"

    Write-Section '3. Report an incident (synchronous call incident -> responder)'
    $body = @{ type = 'MEDICAL'; severity = 'CRITICAL'; description = 'Smoke test: person collapsed'; locationText = 'Main Library, Gate 2' }
    $r = Api POST '/api/incidents' $body $userToken
    Check 'POST /api/incidents returns 201 with a status' ($r.Code -eq 201 -and ($r.Json.status -eq 'ASSIGNED' -or $r.Json.status -eq 'PENDING')) "-> $($r.Code) $($r.Json.status)"
    $incident = $r.Json
    if ($incident.status -eq 'ASSIGNED') { Check 'an ambulance is assigned' ($incident.assignedResponder.type -eq 'AMBULANCE') "-> $($incident.assignedResponder.name)" }
    $r = Api GET "/api/incidents/$($incident.id)" $null $userToken; Check 'owner can read the incident' ($r.Code -eq 200 -and $r.Json.id -eq $incident.id) "-> $($r.Code)"
    $r = Api GET '/api/incidents' $null $userToken;          Check 'USER list contains only own incidents' ($r.Code -eq 200 -and @($r.Json).Count -eq 1) "-> count=$(@($r.Json).Count)"

    Write-Section '4. Asynchronous event -> notification'
    $note = Wait-Until { $n = Api GET '/api/notifications' $null $userToken; if (@($n.Json).Count -ge 1) { $n.Json } } 20
    $expected = if ($incident.status -eq 'ASSIGNED') { 'INCIDENT_ASSIGNED' } else { 'INCIDENT_PENDING' }
    Check 'a notification arrives through RabbitMQ' ($null -ne $note -and @($note).Count -ge 1) "-> $(@($note).Count) notification(s)"
    if ($note) {
        Check "notification type is $expected and mentions the incident" ($note[0].type -eq $expected -and $note[0].message -like "*#$($incident.id)*") "-> $($note[0].message)"
        $r = Api PATCH "/api/notifications/$($note[0].id)/read" $null $userToken; Check 'owner marks the notification as read' ($r.Code -eq 200 -and $r.Json.read -eq $true) "-> $($r.Code)"
    }

    Write-Section '5. Roles: USER versus ADMIN'
    $r = Api POST "/api/incidents/$($incident.id)/dispatch" $null $userToken; Check 'USER on admin endpoint /dispatch' ($r.Code -eq 403 -and $r.Json.code -eq 'FORBIDDEN') "-> $($r.Code)"
    $r = Api POST "/api/incidents/$($incident.id)/dispatch" $null $userToken @{ 'X-User-Role' = 'ADMIN'; 'X-User-Id' = '1' }
    Check 'USER with a forged X-User-Role: ADMIN header is still refused' ($r.Code -eq 403) "-> $($r.Code)"
    $r = Api POST "/api/incidents/$($incident.id)/resolve" $null $userToken;  Check 'USER on admin endpoint /resolve' ($r.Code -eq 403) "-> $($r.Code)"
    $other = New-TestUser 'smoke2'
    $null = Api POST '/api/auth/register' $other
    $otherToken = (Api POST '/api/auth/login' $other).Json.token
    $r = Api GET "/api/incidents/$($incident.id)" $null $otherToken;          Check "another user cannot read this user's incident" ($r.Code -eq 403) "-> $($r.Code)"
    $r = Api GET '/api/notifications' $null $otherToken;                      Check "another user sees none of these notifications" ($r.Code -eq 200 -and @($r.Json).Count -eq 0) "-> count=$(@($r.Json).Count)"
    $r = Api GET '/api/incidents' $null $adminToken;                          Check 'ADMIN list includes the incident' ($r.Code -eq 200 -and (@($r.Json | Where-Object { $_.id -eq $incident.id }).Count -eq 1)) "-> $($r.Code)"

    Write-Section '6. Admin dispatch and resolve'
    if ($incident.status -eq 'PENDING') {
        $r = Api POST "/api/incidents/$($incident.id)/dispatch" $null $adminToken
        Check 'ADMIN dispatches the PENDING incident' ($r.Code -eq 200 -and $r.Json.status -eq 'ASSIGNED') "-> $($r.Code) $($r.Json.status)"
    } else {
        $r = Api POST "/api/incidents/$($incident.id)/dispatch" $null $adminToken
        Check 'dispatching an incident that is not PENDING gives 409' ($r.Code -eq 409 -and $r.Json.code -eq 'INVALID_STATE') "-> $($r.Code) $($r.Json.code)"
    }
    $r = Api POST "/api/incidents/$($incident.id)/resolve" $null $adminToken; Check 'ADMIN resolves the incident (responder is freed)' ($r.Code -eq 200 -and $r.Json.status -eq 'RESOLVED') "-> $($r.Code) $($r.Json.status)"
    $r = Api POST "/api/incidents/$($incident.id)/resolve" $null $adminToken; Check 'resolving twice gives 409' ($r.Code -eq 409) "-> $($r.Code)"
    $r = Api GET '/api/incidents/999999' $null $adminToken;                   Check 'unknown incident id gives 404' ($r.Code -eq 404 -and $r.Json.code -eq 'NOT_FOUND') "-> $($r.Code)"

    Write-Section '7. Responders and validation'
    $r = Api GET '/api/responders' $null $userToken;                          Check 'GET /api/responders (any logged-in user)' ($r.Code -eq 200 -and @($r.Json).Count -ge 9) "-> count=$(@($r.Json).Count)"
    $r = Api GET '/api/responders?status=AVAILABLE&type=AMBULANCE' $null $userToken; Check 'responders can be filtered' ($r.Code -eq 200) "-> count=$(@($r.Json).Count)"
    $r = Api POST '/api/incidents' @{ severity = 'LOW'; description = ''; locationText = 'x' } $userToken
    Check 'invalid incident gives 400 with field details' ($r.Code -eq 400 -and $r.Json.code -eq 'VALIDATION_ERROR' -and @($r.Json.details).Count -ge 2) "-> $($r.Code) details=$(@($r.Json.details).Count)"
    $r = Api POST '/api/auth/register' @{ username = 'a b'; password = 'short' }; Check 'invalid registration gives 400' ($r.Code -eq 400) "-> $($r.Code)"
}
finally {
    Stop-Gateway
}
exit (Get-ExitCode 'smoke-test')
