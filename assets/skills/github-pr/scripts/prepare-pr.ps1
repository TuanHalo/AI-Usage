<#
.SYNOPSIS
    Pre-flight helper for GitHub PR creation: checks branch, remote tracking, commit log, and gh CLI status.
#>

param(
    [string]$BaseBranch = "main"
)

Write-Host "=== GitHub PR Pre-flight Diagnostics ===" -ForegroundColor Cyan

# 1. Current Branch
$currentBranch = (git branch --show-current).Trim()
Write-Host "Active Branch: $currentBranch" -ForegroundColor Yellow

if ($currentBranch -eq "main" -or $currentBranch -eq "master") {
    Write-Host "[WARNING] You are currently on default branch '$currentBranch'." -ForegroundColor Red
    Write-Host "          Best practice is to create a feature branch first:" -ForegroundColor DarkGray
    Write-Host "          git checkout -b feat/your-feature-name" -ForegroundColor DarkGray
}

# 2. Uncommitted changes
$status = git status --short
if ($status) {
    Write-Host "[WARNING] Uncommitted changes detected in working tree:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
} else {
    Write-Host "[OK] Working tree clean" -ForegroundColor Green
}

# 3. Commits to include in PR
$commits = git log "$BaseBranch..HEAD" --oneline 2>$null
if (-not $commits) {
    Write-Host "[INFO] No commits found between '$BaseBranch' and '$currentBranch'." -ForegroundColor Yellow
} else {
    Write-Host "`nCommits in PR against '$BaseBranch':" -ForegroundColor Cyan
    $commits | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
}

# 4. Check gh CLI
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if ($ghInstalled) {
    Write-Host "`n[OK] GitHub CLI ('gh') is available." -ForegroundColor Green
    gh auth status 2>&1 | Out-String | Write-Host -ForegroundColor DarkGray
} else {
    Write-Host "`n[INFO] GitHub CLI ('gh') not detected on PATH." -ForegroundColor Yellow
    Write-Host "       Direct compare URL will be generated as fallback." -ForegroundColor DarkGray
}

