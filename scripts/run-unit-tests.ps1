<#
.SYNOPSIS
  Runs the JUnit tests of every service (mvn test, JDK 17) and prints a table: tests run, failures, errors, seconds.
  Exit code 0 = every service passed.

.DESCRIPTION
  Docker Desktop must be running: responder, incident and notification tests start a throw-away PostgreSQL
  container with Testcontainers. The raw Maven output of each service is saved to docs/evidence/unit-tests-<service>.txt.

  .\scripts\run-unit-tests.ps1
#>
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$services = 'auth-service', 'api-gateway', 'responder-service', 'incident-service', 'notification-service', 'discovery-service'

$jdk = @($env:JAVA_HOME,
         (Get-ChildItem 'C:\Program Files\Eclipse Adoptium\jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName),
         (Get-ChildItem 'C:\Program Files\Java\jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)) |
       Where-Object { $_ -and (Test-Path "$_\bin\java.exe") -and ((& "$_\bin\java.exe" -version 2>&1 | Out-String) -match 'version "17') } |
       Select-Object -First 1
if (-not $jdk) { Write-Host 'JDK 17 not found.' -ForegroundColor Red; exit 2 }
$env:JAVA_HOME = $jdk; $env:Path = "$jdk\bin;$env:Path"
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Docker is not running (Testcontainers needs it).' -ForegroundColor Red; exit 2 }

New-Item -ItemType Directory -Force (Join-Path $root 'docs\evidence') | Out-Null
$rows = @(); $failed = 0
foreach ($s in $services) {
    Write-Host "mvn test: $s" -ForegroundColor Cyan
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Push-Location (Join-Path $root $s)
    $out = mvn -B clean test 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    Pop-Location
    $sw.Stop()
    $clean = $out | ForEach-Object { $_ -replace '\x1b\[[0-9;]*[A-Za-z]', '' }
    $keep = $clean | Where-Object { $_ -match '^\[(INFO|ERROR|WARNING)\] (Tests run|Running|BUILD|Failures|Errors|.*FAIL)' -or $_ -match '^\[ERROR\]' }
    [IO.File]::WriteAllLines((Join-Path $root "docs\evidence\unit-tests-$s.txt"), @("# mvn -B clean test in $s (JDK 17), $(Get-Date -Format 'dd MMM yyyy HH:mm')") + $keep, (New-Object Text.UTF8Encoding($false)))
    $sum = $clean | Where-Object { $_ -match '^\[(INFO|ERROR)\] Tests run: \d+, Failures: \d+, Errors: \d+, Skipped: \d+$' } | Select-Object -Last 1
    if ($sum -match 'Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)') { $run = [int]$matches[1]; $f = [int]$matches[2]; $e = [int]$matches[3] } else { $run = 0; $f = 0; $e = 0 }
    if ($code -ne 0) { $failed++ }
    $rows += [pscustomobject]@{ Service = $s; Tests = $run; Failures = $f; Errors = $e; Seconds = [int]$sw.Elapsed.TotalSeconds; Result = $(if ($code -eq 0) { 'PASS' } else { 'FAIL' }) }
}
Write-Host "`n=== JUnit summary" -ForegroundColor Cyan
$rows | ForEach-Object { Write-Host ("{0,-22} tests={1,3} failures={2} errors={3} {4,4}s  {5}" -f $_.Service, $_.Tests, $_.Failures, $_.Errors, $_.Seconds, $_.Result) -ForegroundColor $(if ($_.Result -eq 'PASS') { 'Green' } else { 'Red' }) }
Write-Host ("TOTAL tests: {0}" -f (($rows | Measure-Object Tests -Sum).Sum))
if ($failed -eq 0) { Write-Host 'ALL UNIT TESTS PASSED' -ForegroundColor Green; exit 0 }
Write-Host "$failed service(s) FAILED" -ForegroundColor Red
exit 1
