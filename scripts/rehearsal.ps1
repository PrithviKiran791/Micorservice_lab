<#
.SYNOPSIS
  Full demo rehearsal from a clean cluster: delete the namespace, deploy, then run every check and print a summary.
  Exit code 0 = every step passed.

.DESCRIPTION
  1. kubectl delete ns resqnet            (skip with -NoClean)
  2. scripts\deploy-minikube.ps1          (jars + images are rebuilt only with -Rebuild)
  3. scripts\smoke-test.ps1
  4. scripts\demo-resilience.ps1          (scales responder-service to 0 and back)
  5. Postman collection folders 0-5 run with newman (npx downloads it once; free npm package)
  6. scripts\load-test.ps1                (skip with -SkipLoadTest)
  7. scripts\verify-references.ps1
  It starts one "kubectl port-forward" to the gateway for steps 3-6 and stops it at the end.

  .\scripts\rehearsal.ps1
  .\scripts\rehearsal.ps1 -Rebuild            # also rebuild jars and images first
  .\scripts\rehearsal.ps1 -NoClean -SkipLoadTest
#>
param(
    [switch]$NoClean,
    [switch]$Rebuild,
    [switch]$SkipLoadTest,
    [string]$BaseUrl = 'http://localhost:8080'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\lib.ps1"
$results = New-Object System.Collections.Generic.List[object]
$ps = 'powershell'
$psArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File')

function Run-Step([string]$Name, [scriptblock]$Action) {
    Write-Section $Name
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $global:LASTEXITCODE = 0
    & $Action | Out-Host      # show the step output live; only the exit code is kept
    $code = $LASTEXITCODE
    $sw.Stop()
    $results.Add([pscustomobject]@{ Step = $Name; Result = $(if ($code -eq 0) { 'PASS' } else { "FAIL (exit $code)" }); Seconds = [int]$sw.Elapsed.TotalSeconds })
    return $code
}

$total = [Diagnostics.Stopwatch]::StartNew()
try {
    if (-not $NoClean) {
        $null = Run-Step 'Delete namespace resqnet (clean cluster)' { kubectl delete ns resqnet --wait=true; $global:LASTEXITCODE = 0 }
    }
    $deployArgs = if ($Rebuild) { @() } else { @('-SkipBuild', '-SkipImages') }
    $code = Run-Step 'Deploy to Minikube' { & $ps @psArgs "$PSScriptRoot\deploy-minikube.ps1" @deployArgs }
    if ($code -ne 0) { throw 'deploy failed - stopping' }

    # one shared port-forward for the remaining steps
    $script:Base = $BaseUrl
    if (-not (Ensure-Gateway $BaseUrl)) { throw 'gateway not reachable' }
    Start-Sleep 15   # let every service finish registering with Eureka

    $null = Run-Step 'smoke-test.ps1' { & $ps @psArgs "$PSScriptRoot\smoke-test.ps1" -BaseUrl $BaseUrl }
    $null = Run-Step 'demo-resilience.ps1' { & $ps @psArgs "$PSScriptRoot\demo-resilience.ps1" -BaseUrl $BaseUrl }
    $null = Run-Step 'Postman collection (newman, folders 0-5)' {
        Push-Location $root
        npx.cmd -y newman run postman\ResQNet-Lite.postman_collection.json --folder '0 - Health' --folder '1 - Security' --folder '2 - Auth' --folder '3 - Incidents' --folder '4 - Notifications' --folder '5 - Responders' --reporters cli --color off
        $c = $LASTEXITCODE
        Pop-Location
        $global:LASTEXITCODE = $c
    }
    if (-not $SkipLoadTest) { $null = Run-Step 'load-test.ps1 (20 users in parallel)' { & $ps @psArgs "$PSScriptRoot\load-test.ps1" -BaseUrl $BaseUrl } }
    $null = Run-Step 'verify-references.ps1' { & $ps @psArgs "$PSScriptRoot\verify-references.ps1" }
}
catch { Write-Host "`nSTOPPED: $_" -ForegroundColor Red; $results.Add([pscustomobject]@{ Step = "aborted: $_"; Result = 'FAIL'; Seconds = 0 }) }
finally { Stop-Gateway }

$total.Stop()
Write-Host "`n=== Rehearsal summary ($([int]$total.Elapsed.TotalMinutes) min)" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("{0,-46} {1,-14} {2,5} s" -f $_.Step, $_.Result, $_.Seconds) -ForegroundColor $(if ($_.Result -eq 'PASS') { 'Green' } else { 'Red' }) }
$failed = @($results | Where-Object { $_.Result -ne 'PASS' }).Count
if ($failed -eq 0) { Write-Host "`nREHEARSAL PASSED" -ForegroundColor Green; exit 0 }
Write-Host "`nREHEARSAL FAILED ($failed step(s))" -ForegroundColor Red
exit 1
