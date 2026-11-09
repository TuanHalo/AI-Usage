<#
.SYNOPSIS
    Analyzes git working tree and groups modified files by architectural concern.
#>

param()

$statusLines = git status --short
if (-not $statusLines) {
    Write-Host "[INFO] Working tree clean. No changes to group." -ForegroundColor Green
    exit 0
}

$srcFiles = @()
$testFiles = @()
$docFiles = @()
$configFiles = @()
$otherFiles = @()

foreach ($line in $statusLines) {
    if ($line.Length -lt 3) { continue }
    $code = $line.Substring(0, 2).Trim()
    $file = $line.Substring(3).Trim()

    if ($file -match "(test|spec|\.test\.|\.spec\.)") {
        $testFiles += $file
    } elseif ($file -match "\.(md|txt|rst|adoc)$" -or $file -match "^(docs|doc)/") {
        $docFiles += $file
    } elseif ($file -match "(package\.json|tsconfig|\.eslintrc|cargo\.toml|go\.mod|\.github|\.env)") {
        $configFiles += $file
    } elseif ($file -match "\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|cs|rb|php)$") {
        $srcFiles += $file
    } else {
        $otherFiles += $file
    }
}

Write-Host "`n=== Atomic Commit File Grouping Analysis ===" -ForegroundColor Cyan

if ($srcFiles.Count -gt 0) {
    Write-Host "`n[Core / Feature Files] -> recommend: feat(...) or fix(...)" -ForegroundColor Yellow
    $srcFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
}

if ($testFiles.Count -gt 0) {
    Write-Host "`n[Test Files] -> recommend: test(...)" -ForegroundColor Green
    $testFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
}

if ($docFiles.Count -gt 0) {
    Write-Host "`n[Documentation Files] -> recommend: docs(...)" -ForegroundColor Blue
    $docFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
}

if ($configFiles.Count -gt 0) {
    Write-Host "`n[Config / Build Files] -> recommend: build(...) or chore(...)" -ForegroundColor Magenta
    $configFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
}

if ($otherFiles.Count -gt 0) {
    Write-Host "`n[Other Files]" -ForegroundColor DarkGray
    $otherFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
}

Write-Host "`nTip: Stage one group at a time using 'git add <paths>' then commit." -ForegroundColor Cyan

