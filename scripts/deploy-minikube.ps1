<#
.SYNOPSIS
  Builds every service, builds its Docker image, loads the image into Minikube, applies k8s/ and waits for Ready.

.DESCRIPTION
  Minikube here uses the containerd runtime, so "minikube docker-env" does not work.
  Instead each image is built with Docker Desktop and copied in with "minikube image load".
  Run from anywhere:  .\scripts\deploy-minikube.ps1
  Options: -SkipBuild (reuse jars in target/), -SkipImages (reuse images already in Minikube).
#>
param(
    [switch]$SkipBuild,
    [switch]$SkipImages
)

# 'Continue' on purpose: in Windows PowerShell 5.1, native commands that print to stderr would abort the
# script under 'Stop'. Every important command below checks $LASTEXITCODE itself.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$ns = 'resqnet'

# service folder -> manifest file. A service is deployed only when its manifest exists.
$manifests = [ordered]@{
    'discovery-service'    = '15-discovery.yaml'
    'auth-service'         = '20-auth.yaml'
    'incident-service'     = '21-incident.yaml'
    'responder-service'    = '22-responder.yaml'
    'notification-service' = '23-notification.yaml'
    'frontend'             = '40-frontend.yaml'      # web UI: built by its own Dockerfile (npm), no Maven jar
    'api-gateway'          = '30-gateway.yaml'
}
$services = @($manifests.Keys | Where-Object { Test-Path (Join-Path $root "k8s\$($manifests[$_])") })

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "FAILED: $text" -ForegroundColor Red; exit 1 }

# ---- 1. preflight ------------------------------------------------------------------------------
Step 'Preflight: Docker, Minikube, kubectl'
docker info *> $null;                          if ($LASTEXITCODE -ne 0) { Fail 'Docker is not running. Start Docker Desktop.' }
$status = minikube status --format '{{.Host}}/{{.Kubelet}}/{{.APIServer}}' 2>$null
if ($status -ne 'Running/Running/Running') { Fail "Minikube is not running ($status). Run: minikube start --driver=docker --cpus=4 --memory=4096" }
$ctx = kubectl config current-context
if ($ctx -ne 'minikube') { Fail "kubectl context is '$ctx', expected 'minikube'." }
Write-Host "OK (context: $ctx)"

# ---- 2. JDK 17 + Maven build -----------------------------------------------------------------------
if (-not $SkipBuild) {
    Step 'Build jars with Maven (JDK 17)'
    $jdk = @($env:JAVA_HOME,
             (Get-ChildItem 'C:\Program Files\Eclipse Adoptium\jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName),
             (Get-ChildItem 'C:\Program Files\Java\jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)) |
           Where-Object { $_ -and (Test-Path "$_\bin\java.exe") -and ((& "$_\bin\java.exe" -version 2>&1 | Out-String) -match 'version "17') } |
           Select-Object -First 1
    if (-not $jdk) { Fail 'JDK 17 not found. Install it or set JAVA_HOME to a JDK 17.' }
    $env:JAVA_HOME = $jdk
    $env:Path = "$jdk\bin;$env:Path"
    Write-Host "Using JDK: $jdk"
    foreach ($s in ($services | Where-Object { $_ -ne 'frontend' })) {
        Write-Host "mvn package: $s"
        Push-Location (Join-Path $root $s)
        mvn -B -q clean package -DskipTests
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) { Fail "Maven build of $s failed" }
    }
}

# ---- 3. images --------------------------------------------------------------------------------------
if (-not $SkipImages) {
    Step 'Build Docker images and load them into Minikube'
    foreach ($s in $services) {
        $image = "resqnet/${s}:1.0"
        Write-Host "docker build: $image"
        docker build -q -t $image (Join-Path $root $s) | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail "docker build of $s failed" }
        Write-Host "minikube image load: $image"
        minikube image load $image
        if ($LASTEXITCODE -ne 0) { Fail "minikube image load of $image failed" }
    }
}

# ---- 4. apply manifests -----------------------------------------------------------------------------
Step 'Apply k8s/ manifests'
$existing = @(kubectl -n $ns get deploy -o name 2>$null)       # empty on a fresh cluster
kubectl apply -f (Join-Path $root 'k8s')
if ($LASTEXITCODE -ne 0) { Fail 'kubectl apply failed' }
if (-not $SkipImages) {
    foreach ($s in $services) {
        # a Deployment that already existed keeps running the OLD image until restarted
        if ($existing -contains "deployment.apps/$s") { kubectl -n $ns rollout restart "deploy/$s" | Out-Null }
    }
}

# ---- 5. wait ----------------------------------------------------------------------------------------
Step 'Wait for pods to become Ready'
foreach ($d in @('postgres', 'rabbitmq') + $services) {
    kubectl -n $ns rollout status "deploy/$d" --timeout=900s
    if ($LASTEXITCODE -ne 0) {
        kubectl -n $ns get pods
        Fail "deployment $d did not become Ready (see: kubectl -n $ns logs deploy/$d)"
    }
}
Step 'Result'
kubectl -n $ns get pods
Write-Host "`nReach the gateway with:  kubectl -n $ns port-forward svc/api-gateway 8080:8080" -ForegroundColor Green
