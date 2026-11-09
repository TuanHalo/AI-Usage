<#
.SYNOPSIS
    Robust automation script to create or update a GitHub Pull Request via GitHub CLI.

.PARAMETER Title
    The pull request title.

.PARAMETER Body
    The pull request description in Markdown.

.PARAMETER BodyFile
    Path to an existing markdown file containing the PR description.

.PARAMETER Base
    Target base branch (default: 'main').

.PARAMETER Head
    Source head branch (default: active branch).

.PARAMETER Draft
    Create the PR as a draft.

.PARAMETER UpdateExisting
    Update existing PR if one is already open for this head branch.
#>

param(
    [string]$Title,
    [string]$Body,
    [string]$BodyFile,
    [string]$Base = "main",
    [string]$Head,
    [switch]$Draft,
    [switch]$UpdateExisting = $true
)

$ErrorActionPreference = "Stop"

# 1. Resolve gh executable
$cmd = Get-Command gh -ErrorAction SilentlyContinue
$ghPath = if ($cmd) { $cmd.Source } else { $null }

if (-not $ghPath) {
    # Refresh PATH from system and user registry
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $cmd = Get-Command gh -ErrorAction SilentlyContinue
    if ($cmd) { $ghPath = $cmd.Source }
}

if (-not $ghPath) {
    $fallbackPaths = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        "C:\Program Files (x86)\GitHub CLI\gh.exe",
        "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
    )
    foreach ($p in $fallbackPaths) {
        if (Test-Path $p) {
            $ghPath = $p
            break
        }
    }
}

if (-not $ghPath) {
    Write-Host "[FAIL] GitHub CLI ('gh') is not installed or not found on PATH." -ForegroundColor Red
    Write-Host "       Install it using: winget install --id GitHub.cli -e --silent" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Using GitHub CLI: $ghPath" -ForegroundColor Green

# 2. Check Authentication
$env:GH_NO_UPDATE_NOTIFIER = "1"
$env:GH_PROMPT_DISABLED = "1"

$authCheck = cmd.exe /c " ""$ghPath"" auth status 2>&1 "
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] GitHub CLI is not authenticated." -ForegroundColor Red
    Write-Host "       Run: gh auth login --web" -ForegroundColor Yellow
    exit 2
}

# 3. Determine Head Branch
if (-not $Head) {
    $Head = (git branch --show-current).Trim()
}

if (-not $Head) {
    Write-Host "[FAIL] Could not determine active branch." -ForegroundColor Red
    exit 1
}

if ($Head -eq "main" -or $Head -eq "master") {
    Write-Host "[FAIL] Active branch is '$Head'. Cannot create PR from default branch into default branch." -ForegroundColor Red
    Write-Host "       Checkout a feature branch first: git checkout -b feat/your-feature" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Source Branch (Head): $Head" -ForegroundColor Cyan
Write-Host "[OK] Target Branch (Base): $Base" -ForegroundColor Cyan

# 4. Check for Unpushed Commits & Remote Tracking
$unpushed = git log "origin/$Head..$Head" --oneline 2>$null
if ($unpushed) {
    Write-Host "[SYNC] Pushing unpushed commits to origin/$Head..." -ForegroundColor Cyan
    git push -u origin $Head
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Failed to push branch to remote." -ForegroundColor Red
        exit 1
    }
}

# 5. Check If PR Already Exists
$existingPrJson = & $ghPath pr list --head $Head --base $Base --json number,url,title,state 2>$null | Out-String
$existingPr = $null
if ($existingPrJson -and $existingPrJson.Trim() -ne "[]") {
    $existingPr = ($existingPrJson | ConvertFrom-Json)[0]
}

# 6. Prepare Body File safely (immune to PowerShell quoting/escaping)
$tempBodyFile = $null
try {
    if ($BodyFile -and (Test-Path $BodyFile)) {
        $actualBodyFile = (Resolve-Path $BodyFile).Path
    } elseif ($Body) {
        $tempBodyFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "gh-pr-body-$([System.Guid]::NewGuid().ToString('N')).md")
        [System.IO.File]::WriteAllText($tempBodyFile, $Body, [System.Text.Encoding]::UTF8)
        $actualBodyFile = $tempBodyFile
    } else {
        # Default fallback body if omitted
        $tempBodyFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "gh-pr-body-$([System.Guid]::NewGuid().ToString('N')).md")
        $defaultBody = "## Summary`nAutomated PR generated from branch $Head."
        [System.IO.File]::WriteAllText($tempBodyFile, $defaultBody, [System.Text.Encoding]::UTF8)
        $actualBodyFile = $tempBodyFile
    }

    if (-not $Title) {
        # Auto-detect title from last commit on branch
        $Title = (git log -1 --pretty=format:%s).Trim()
    }

    # 7. Create or Update PR
    if ($existingPr) {
        Write-Host "`n[INFO] PR #$($existingPr.number) already exists for branch '$Head':" -ForegroundColor Yellow
        Write-Host "       $($existingPr.url)" -ForegroundColor White

        if ($UpdateExisting) {
            Write-Host "[UPDATE] Updating PR title and description..." -ForegroundColor Cyan
            & $ghPath pr edit $existingPr.number --title $Title --body-file $actualBodyFile
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[SUCCESS] Updated PR #$($existingPr.number): $($existingPr.url)" -ForegroundColor Green
            }
        }
        return @{
            Action = "Existing"
            Number = $existingPr.number
            Url    = $existingPr.url
            Title  = $Title
        }
    } else {
        Write-Host "`n[CREATE] Creating Pull Request on GitHub..." -ForegroundColor Cyan
        $argsList = @(
            "pr", "create",
            "--base", $Base,
            "--head", $Head,
            "--title", $Title,
            "--body-file", $actualBodyFile
        )
        if ($Draft) {
            $argsList += "--draft"
        }

        $prUrl = & $ghPath @argsList
        if ($LASTEXITCODE -eq 0 -and $prUrl) {
            Write-Host "`n==================================================" -ForegroundColor Green
            Write-Host "[SUCCESS] Pull Request Created Successfully!" -ForegroundColor Green
            Write-Host "URL: $prUrl" -ForegroundColor White
            Write-Host "==================================================" -ForegroundColor Green
            return @{
                Action = "Created"
                Url    = $prUrl.Trim()
                Title  = $Title
            }
        } else {
            Write-Host "[FAIL] Failed to create Pull Request." -ForegroundColor Red
            exit 1
        }
    }
}
finally {
    if ($tempBodyFile -and (Test-Path $tempBodyFile)) {
        Remove-Item $tempBodyFile -Force -ErrorAction SilentlyContinue
    }
}
