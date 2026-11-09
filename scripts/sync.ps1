<#
.SYNOPSIS
    Orchestrates the synchronization of canonical AI assets to local tool configurations.

.PARAMETER Target
    Target tool: 'all', 'antigravity', 'cursor', 'claude', or 'gemini'. Default: 'all'.

.PARAMETER AssetType
    Asset type to sync: 'all', 'skills', or 'rules'. Default: 'all'.

.PARAMETER DryRun
    Simulate transformations without writing files to disk.

.PARAMETER ValidateOnly
    Run validation only without syncing.

.EXAMPLE
    .\scripts\sync.ps1 -Target antigravity
    .\scripts\sync.ps1 -DryRun
    .\scripts\sync.ps1 -ValidateOnly
#>

param(
    [ValidateSet("all", "antigravity", "cursor", "claude", "gemini")]
    [string]$Target = "all",

    [ValidateSet("all", "skills", "rules")]
    [string]$AssetType = "all",

    [switch]$DryRun,
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$AssetsDir = (Resolve-Path "$ScriptRoot\..\assets").Path

Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "      AI-Usage Multi-Tool Asset Synchronizer      " -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Target:    $Target"
Write-Host "AssetType: $AssetType"
Write-Host "DryRun:    $($DryRun.IsPresent)"
Write-Host "--------------------------------------------------"

# Step 1: Validate Canonical Assets
& "$ScriptRoot\utils\validate.ps1" -AssetsDir $AssetsDir
if (-not $?) {
    Write-Error "Validation failed. Aborting synchronization."
    exit 1
}

if ($ValidateOnly) {
    Write-Host "`n[OK] Asset validation completed (--ValidateOnly specified)." -ForegroundColor Green
    exit 0
}

Write-Host "`n[SYNC] Executing Tool Transformations..." -ForegroundColor Cyan

# Step 2: Run Selected Transforms
$transforms = @()

if ($Target -eq "all" -or $Target -eq "antigravity") {
    $transforms += @{ Name = "Antigravity"; Script = "$ScriptRoot\transforms\to-antigravity.ps1" }
}
if ($Target -eq "all" -or $Target -eq "cursor") {
    $transforms += @{ Name = "Cursor"; Script = "$ScriptRoot\transforms\to-cursor.ps1" }
}
if ($Target -eq "all" -or $Target -eq "claude") {
    $transforms += @{ Name = "Claude Code"; Script = "$ScriptRoot\transforms\to-claude-code.ps1" }
}
if ($Target -eq "all" -or $Target -eq "gemini") {
    $transforms += @{ Name = "Gemini CLI"; Script = "$ScriptRoot\transforms\to-gemini-cli.ps1" }
}

foreach ($t in $transforms) {
    Write-Host "`n[$($t.Name)]" -ForegroundColor Green
    & $t.Script -AssetsDir $AssetsDir -DryRun:$DryRun
}

Write-Host "`n==================================================" -ForegroundColor Magenta
Write-Host "[SUCCESS] Synchronization Finished Successfully!" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
