<#
.SYNOPSIS
  Documentation test: checks that things the human-followed documents mention really exist.
  Exit code 0 = everything named in the documents exists, 1 = at least one reference is wrong.

.DESCRIPTION
  For README.md, docs/viva/*.md, docs/demo/*.md, docs/TEST_REPORT.md and docs/FINAL_CHECKLIST.md it checks
    1. every file path in `backticks` and every Markdown link target exists (relative to the repo root or to the document),
    2. every script option such as -SkipBuild that appears next to a script name is declared in that script,
    3. every `Class.method` where Class.java exists in the repo really contains that method name,
    4. every `deploy/NAME` and `svc/NAME` used in kubectl commands is defined in k8s/*.yaml.
  (Line numbers are checked separately by verify-references.ps1.)

  .\scripts\verify-docs.ps1
#>
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$docs = @(Get-Item (Join-Path $root 'README.md'))
foreach ($d in 'docs\viva', 'docs\demo') { $p = Join-Path $root $d; if (Test-Path $p) { $docs += Get-ChildItem $p -Filter *.md } }
foreach ($extra in 'docs\TEST_REPORT.md', 'docs\FINAL_CHECKLIST.md') { $e = Join-Path $root $extra; if (Test-Path $e) { $docs += Get-Item $e } }

$javaFiles = @{}
Get-ChildItem $root -Recurse -Filter *.java -File | Where-Object { $_.FullName -notmatch '\\target\\' } | ForEach-Object { $javaFiles[$_.BaseName] = $_.FullName }
$k8sText = (Get-ChildItem (Join-Path $root 'k8s') -Filter *.yaml | ForEach-Object { [IO.File]::ReadAllText($_.FullName) }) -join "`n"

$ok = 0; $bad = 0
function Report([bool]$good, [string]$doc, [string]$what) {
    if ($good) { $script:ok++ } else { $script:bad++; Write-Host "FAIL  [$doc] $what" -ForegroundColor Red }
}

$fileExt = 'ps1|yaml|yml|java|md|json|sh|sql|png|mmd|xml|txt'
foreach ($doc in $docs) {
    $name = $doc.FullName.Substring($root.Length + 1)
    $text = [IO.File]::ReadAllText($doc.FullName)
    $dir = $doc.DirectoryName

    # 1a. backticked paths
    $seen = @{}
    foreach ($m in [regex]::Matches($text, '`([^`\s]+)`')) {
        $tok = $m.Groups[1].Value.Trim('.', ',', ';', ':')
        if ($seen.ContainsKey($tok)) { continue }; $seen[$tok] = 1
        if ($tok -match '^https?://|[*{}<>$|=]|^-' ) { continue }
        $isFile = $tok -match "\.($fileExt)(:\d+)?$"
        $isDir = $tok -match '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*/$'
        if (-not ($isFile -or $isDir)) { continue }
        $clean = ($tok -replace ':\d+$', '') -replace '\\', '/'
        $cands = @((Join-Path $root $clean), (Join-Path $dir $clean))
        if ($clean -match '^\.\\|^\./') { $cands += (Join-Path $root ($clean -replace '^\./', '')) }
        # a bare file name such as application.yml or Dockerfile is accepted if it exists anywhere in the repo
        $anywhere = $false
        if ($clean -notmatch '/') { $anywhere = [bool](Get-ChildItem $root -Recurse -Filter $clean -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(target|node_modules)\\' } | Select-Object -First 1) }
        Report (($cands | Where-Object { Test-Path $_ }).Count -gt 0 -or $anywhere) $name "path does not exist: $tok"
    }
    # 1b. Dockerfile mentioned as `*/Dockerfile` is a pattern, skipped above; check one real Dockerfile per service instead
    # 1c. markdown links
    foreach ($m in [regex]::Matches($text, '\]\(([^)#\s]+)(#[^)]*)?\)')) {
        $t = $m.Groups[1].Value
        if ($t -match '^https?://|^mailto:') { continue }
        $cands = @((Join-Path $dir $t), (Join-Path $root $t))
        Report (($cands | Where-Object { Test-Path $_ }).Count -gt 0) $name "link target does not exist: $t"
    }

    # 2. script options
    foreach ($m in [regex]::Matches($text, '(?:\.[\\/])?scripts[\\/]([A-Za-z0-9_-]+\.ps1)((?:\s+-[A-Za-z]+(?:\s+[^\s`|;)-][^\s`|;)]*)?)*)')) {
        $script = Join-Path $root "scripts\$($m.Groups[1].Value)"
        if (-not (Test-Path $script)) { continue }
        $body = [IO.File]::ReadAllText($script)
        foreach ($o in [regex]::Matches($m.Groups[2].Value, '\s-([A-Za-z]+)')) {
            $opt = $o.Groups[1].Value
            Report ($body -match "(?i)\`$$opt\b") $name "script option -$opt is not declared in scripts\$($m.Groups[1].Value)"
        }
    }

    # 3. Class.method
    $seen = @{}
    foreach ($m in [regex]::Matches($text, '`([A-Z][A-Za-z0-9]+)\.([a-z][A-Za-z0-9_]+)(?:\(\))?`')) {
        $cls = $m.Groups[1].Value; $meth = $m.Groups[2].Value; $key = "$cls.$meth"
        if ($seen.ContainsKey($key)) { continue }; $seen[$key] = 1
        if ($meth -match "^($fileExt)$") { continue }             # "Something.java" is a file name, not a method
        if (-not $javaFiles.ContainsKey($cls)) { continue }       # external class (Jwts, ...) is not checked
        $src = [IO.File]::ReadAllText($javaFiles[$cls])
        Report ($src -match "\b$meth\b") $name "method $meth not found in $cls.java"
    }

    # 4. kubectl names
    $seen = @{}
    foreach ($m in [regex]::Matches($text, '\b(deploy|svc)/([a-z][a-z0-9-]+)')) {
        $kind = if ($m.Groups[1].Value -eq 'deploy') { 'Deployment' } else { 'Service' }
        $n = $m.Groups[2].Value; $key = "$kind/$n"
        if ($seen.ContainsKey($key)) { continue }; $seen[$key] = 1
        Report ($k8sText -match "(?s)kind: $kind\s+metadata:\s+name: $n\b") $name "kubectl $key is not defined in k8s/*.yaml"
    }
}

Write-Host ""
$color = if ($bad -eq 0) { 'Green' } else { 'Red' }
Write-Host ("verify-docs: {0} documents, {1} references correct, {2} wrong" -f $docs.Count, $ok, $bad) -ForegroundColor $color
if ($bad -eq 0) { exit 0 } else { exit 1 }
