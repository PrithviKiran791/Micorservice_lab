# Shared helpers for the test and demo scripts. Dot-source it:   . "$PSScriptRoot\lib.ps1"
# Windows PowerShell 5.1 compatible, ASCII only, no extra tools (Invoke-WebRequest + kubectl).

$script:PassCount = 0
$script:FailCount = 0
$script:ForwardProcess = $null
$script:Namespace = 'resqnet'

function Write-Section($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }

# ---- gateway access -----------------------------------------------------------------------------
# If the gateway does not answer on $BaseUrl, start "kubectl port-forward" ourselves (and stop it in Stop-Gateway).
function Ensure-Gateway([string]$BaseUrl) {
    if (Test-Gateway $BaseUrl) { return $true }
    $port = ([uri]$BaseUrl).Port
    Write-Host "Gateway not reachable on $BaseUrl - starting: kubectl port-forward svc/api-gateway ${port}:8080"
    $script:ForwardProcess = Start-Process kubectl -ArgumentList "-n $($script:Namespace) port-forward svc/api-gateway ${port}:8080" -PassThru -WindowStyle Hidden
    for ($i = 0; $i -lt 20; $i++) { Start-Sleep 1; if (Test-Gateway $BaseUrl) { return $true } }
    Write-Host "Cannot reach the gateway. Is the cluster deployed? (.\scripts\deploy-minikube.ps1)" -ForegroundColor Red
    return $false
}
function Test-Gateway([string]$BaseUrl) {
    try { $r = Invoke-WebRequest "$BaseUrl/actuator/health" -UseBasicParsing -TimeoutSec 3; return ($r.StatusCode -eq 200) } catch { return $false }
}
function Stop-Gateway {
    if ($script:ForwardProcess -and -not $script:ForwardProcess.HasExited) { Stop-Process -Id $script:ForwardProcess.Id -Force -ErrorAction SilentlyContinue }
}

# ---- HTTP ------------------------------------------------------------------------------------------------
# Returns an object: Code (HTTP status, 0 = no answer), Json (parsed body or $null), Ms, Pod (X-Served-By)
function Api([string]$Method, [string]$Path, $Body = $null, [string]$Token = '', [hashtable]$Headers = @{}) {
    $h = @{}
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    if ($Token) { $h['Authorization'] = "Bearer $Token" }
    $p = @{ Uri = "$($script:Base)$Path"; Method = $Method; UseBasicParsing = $true; Headers = $h; TimeoutSec = 30 }
    if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json); $p.ContentType = 'application/json' }
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $code = 0; $content = ''; $pod = ''
    try {
        $r = Invoke-WebRequest @p
        $code = [int]$r.StatusCode; $content = $r.Content; $pod = [string]$r.Headers['X-Served-By']
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $code = [int]$resp.StatusCode
            try { $content = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch { }
        }
    }
    $sw.Stop()
    $json = $null
    if ($content) { try { $json = $content | ConvertFrom-Json } catch { } }
    return [pscustomobject]@{ Code = $code; Json = $json; Ms = $sw.ElapsedMilliseconds; Pod = $pod }
}

function Wait-Until([scriptblock]$Condition, [int]$TimeoutSec = 30, [int]$PollMs = 500) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
        $v = & $Condition
        if ($v) { return $v }
        Start-Sleep -Milliseconds $PollMs
    }
    return $null
}

function New-TestUser([string]$Prefix = 'smoke') {
    $name = "$Prefix$(Get-Random -Maximum 9999999)"
    return @{ username = $name; password = 'Pass@1234' }
}

# ---- reporting -------------------------------------------------------------------------------------------
function Check([string]$Name, [bool]$Ok, [string]$Detail = '') {
    if ($Ok) { $script:PassCount++; Write-Host ("PASS  {0,-70} {1}" -f $Name, $Detail) -ForegroundColor Green }
    else     { $script:FailCount++; Write-Host ("FAIL  {0,-70} {1}" -f $Name, $Detail) -ForegroundColor Red }
}

# Prints the summary and returns the process exit code (0 = all passed).
function Get-ExitCode([string]$Title) {
    Write-Host ""
    $color = if ($script:FailCount -eq 0) { 'Green' } else { 'Red' }
    Write-Host ("{0}: {1} passed, {2} failed" -f $Title, $script:PassCount, $script:FailCount) -ForegroundColor $color
    if ($script:FailCount -eq 0) { return 0 } else { return 1 }
}

function Wait-PodReady([string]$App, [int]$TimeoutSec = 180) {
    kubectl -n $script:Namespace wait --for=condition=Ready pod -l app=$App --timeout="${TimeoutSec}s" 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}
