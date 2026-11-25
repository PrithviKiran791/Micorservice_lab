<#
.SYNOPSIS
  Checks every "path:line" code reference in the viva documents: the quoted snippet must really appear on that line.
  Exit code 0 = all references are correct, 1 = at least one is wrong (a hint shows where the snippet moved to).

.DESCRIPTION
  A reference is a Markdown table row of the form:
      | concept | `relative/path/File.java:42` | `exact snippet` | Class.method | rubric row |
  The script reads those rows from the given files (default: every .md under docs/viva) and checks:
    1. the file exists,  2. the line number exists,  3. the snippet is on that line.

  .\scripts\verify-references.ps1
  .\scripts\verify-references.ps1 -Path docs\viva\CODE_REFERENCES.md
#>
param([string[]]$Path = @('docs\viva'))

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$pass = 0; $fail = 0; $total = 0

$files = foreach ($p in $Path) {
    $full = if ([IO.Path]::IsPathRooted($p)) { $p } else { Join-Path $root $p }
    if (Test-Path $full -PathType Container) { Get-ChildItem $full -Filter *.md -Recurse } elseif (Test-Path $full) { Get-Item $full } else { Write-Host "Not found: $p" -ForegroundColor Red; $fail++ }
}

$pattern = '\|\s*`([^`|]+?):(\d+)`\s*\|\s*`([^`]+)`\s*\|'
foreach ($doc in $files) {
    $docRel = $doc.FullName.Substring($root.Length + 1)
    foreach ($line in [IO.File]::ReadAllLines($doc.FullName)) {
        $m = [regex]::Match($line, $pattern)
        if (-not $m.Success) { continue }
        $total++
        $rel = $m.Groups[1].Value; $no = [int]$m.Groups[2].Value; $snippet = $m.Groups[3].Value
        $src = Join-Path $root $rel
        if (-not (Test-Path $src)) { $fail++; Write-Host "FAIL  ${rel}:$no  file does not exist  (in $docRel)" -ForegroundColor Red; continue }
        $lines = [IO.File]::ReadAllLines($src)
        if ($no -lt 1 -or $no -gt $lines.Count) { $fail++; Write-Host "FAIL  ${rel}:$no  file has only $($lines.Count) lines" -ForegroundColor Red; continue }
        if ($lines[$no - 1].Contains($snippet)) { $pass++; Write-Host "PASS  ${rel}:$no  $snippet" -ForegroundColor Green }
        else {
            $fail++
            $moved = for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].Contains($snippet)) { $i + 1; break } }
            $hint = if ($moved) { "snippet is now on line $moved" } else { "snippet no longer exists in the file" }
            Write-Host "FAIL  ${rel}:$no  $hint  [$snippet]" -ForegroundColor Red
        }
    }
}

Write-Host ""
if ($total -eq 0) { Write-Host "verify-references: no references found (nothing checked)" -ForegroundColor Yellow; exit 1 }
$color = if ($fail -eq 0) { 'Green' } else { 'Red' }
Write-Host ("verify-references: {0} references, {1} correct, {2} wrong" -f $total, $pass, $fail) -ForegroundColor $color
if ($fail -eq 0) { exit 0 } else { exit 1 }
