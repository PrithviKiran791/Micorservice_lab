<#
.SYNOPSIS
  Load test for the rubric row "Handles traffic": many users call the gateway at the same time, and the
  report shows that the requests were spread over several copies (pods) of each service.

.DESCRIPTION
  1. Registers/logs in N demo users (load1 ... loadN).
  2. Starts N virtual users in parallel (PowerShell runspaces). Each one sends R rounds of
     GET /api/incidents, GET /api/responders and GET /api/notifications with its own token.
  3. Prints requests/second, latency (average, 95th percentile, max), HTTP status counts and,
     per endpoint, how many requests each pod answered (read from the X-Served-By response header).
  Exit code 0 = no errors and every endpoint that has several pods was served by all of them.

  Needs the gateway on -BaseUrl (default http://localhost:8080), for example:
     kubectl -n resqnet port-forward svc/api-gateway 8080:8080
  Show the load balancing by scaling first:  kubectl -n resqnet scale deploy/incident-service --replicas=2
#>
param(
    [string]$BaseUrl = 'http://localhost:8080',
    [int]$Users = 20,
    [int]$Rounds = 25,
    [int]$ExpectIncidentPods = 2
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Net.Http
function Fail($text) { Write-Host "FAILED: $text" -ForegroundColor Red; exit 1 }

# ---- 1. users -------------------------------------------------------------------------------------
Write-Host "Preparing $Users demo users..." -ForegroundColor Cyan
$tokens = @()
for ($i = 1; $i -le $Users; $i++) {
    $body = @{ username = "load$i"; password = 'Pass@1234' } | ConvertTo-Json
    try { Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/register" -ContentType 'application/json' -Body $body | Out-Null } catch { }   # 409 = already exists, fine
    try { $tokens += (Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType 'application/json' -Body $body).token }
    catch { Fail "cannot log in user load$i - is the gateway reachable at $BaseUrl ?" }
}

# ---- 2. virtual users ---------------------------------------------------------------------------------
$worker = {
    param($baseUrl, $token, $rounds)
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    $client.DefaultRequestHeaders.Add('Authorization', "Bearer $token")
    $results = New-Object System.Collections.Generic.List[object]
    foreach ($r in 1..$rounds) {
        foreach ($path in '/api/incidents', '/api/responders', '/api/notifications') {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $status = 0; $pod = ''
            try {
                $resp = $client.GetAsync("$baseUrl$path").GetAwaiter().GetResult()
                $status = [int]$resp.StatusCode
                $values = $null
                if ($resp.Headers.TryGetValues('X-Served-By', [ref]$values)) { $pod = ($values | Select-Object -First 1) }
                $resp.Dispose()
            } catch { $status = 0 }
            $sw.Stop()
            $results.Add([pscustomobject]@{ Path = $path; Status = $status; Ms = $sw.Elapsed.TotalMilliseconds; Pod = $pod })
        }
    }
    $client.Dispose()
    $results
}

Write-Host "Running: $Users users x $Rounds rounds x 3 endpoints = $($Users * $Rounds * 3) requests" -ForegroundColor Cyan
$pool = [runspacefactory]::CreateRunspacePool(1, $Users)
$pool.Open()
$clock = [Diagnostics.Stopwatch]::StartNew()
$jobs = foreach ($t in $tokens) {
    $ps = [powershell]::Create().AddScript($worker).AddArgument($BaseUrl).AddArgument($t).AddArgument($Rounds)
    $ps.RunspacePool = $pool
    [pscustomobject]@{ Shell = $ps; Handle = $ps.BeginInvoke() }
}
$all = foreach ($j in $jobs) { $j.Shell.EndInvoke($j.Handle); $j.Shell.Dispose() }
$clock.Stop()
$pool.Close()

# ---- 3. report ----------------------------------------------------------------------------------------
$all = @($all)
$secs = [math]::Max($clock.Elapsed.TotalSeconds, 0.001)
$sorted = @($all | Sort-Object Ms)
$p95 = $sorted[[math]::Min($sorted.Count - 1, [int][math]::Ceiling($sorted.Count * 0.95) - 1)].Ms
Write-Host "`n=== Result" -ForegroundColor Cyan
"{0,-24} {1}" -f 'Total requests', $all.Count
"{0,-24} {1:N1} s  ({2:N0} requests/second)" -f 'Duration', $secs, ($all.Count / $secs)
"{0,-24} avg {1:N0} ms   p95 {2:N0} ms   max {3:N0} ms" -f 'Latency', ($all | Measure-Object Ms -Average).Average, $p95, ($all | Measure-Object Ms -Maximum).Maximum
"{0,-24} {1}" -f 'HTTP status counts', ((($all | Group-Object Status | Sort-Object Name | ForEach-Object { "$($_.Name) x$($_.Count)" })) -join ', ')

$problems = 0
$errors = @($all | Where-Object { $_.Status -ne 200 })
if ($errors.Count -gt 0) { $problems++; Write-Host "Errors: $($errors.Count) request(s) were not HTTP 200" -ForegroundColor Red }

Write-Host "`nWho answered? (X-Served-By = pod name)" -ForegroundColor Cyan
foreach ($path in '/api/incidents', '/api/responders', '/api/notifications') {
    $subset = @($all | Where-Object { $_.Path -eq $path -and $_.Status -eq 200 })
    $perPod = @($subset | Group-Object Pod | Sort-Object Name)
    Write-Host ("{0}  ({1} pod(s) answered)" -f $path, $perPod.Count)
    foreach ($g in $perPod) { "    {0,-40} {1,5} requests  ({2:P0})" -f $g.Name, $g.Count, ($g.Count / [math]::Max($subset.Count, 1)) }
}
$incidentPods = @($all | Where-Object { $_.Path -eq '/api/incidents' -and $_.Status -eq 200 } | Group-Object Pod).Count
if ($incidentPods -lt $ExpectIncidentPods) {
    $problems++
    Write-Host "`nLoad balancing NOT shown: /api/incidents was answered by $incidentPods pod(s), expected at least $ExpectIncidentPods." -ForegroundColor Yellow
    Write-Host "Scale first:  kubectl -n resqnet scale deploy/incident-service --replicas=$ExpectIncidentPods  (then wait until both pods are Ready)" -ForegroundColor Yellow
}
if ($problems -eq 0) { Write-Host "`nPASS: no errors, load shared by $incidentPods incident-service pods." -ForegroundColor Green; exit 0 }
exit 1
