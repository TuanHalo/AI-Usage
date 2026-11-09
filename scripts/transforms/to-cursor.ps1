<#
.SYNOPSIS
    Transforms canonical AI assets into Cursor format (.mdc files).
    - Global Rules: ~/.cursor/rules/<name>.mdc
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets",
    [string]$TargetDir = "$env:USERPROFILE\.cursor\rules",
    [switch]$DryRun
)

. "$PSScriptRoot\..\utils\yaml-parser.ps1"

$AssetsDir = (Resolve-Path $AssetsDir).Path

Write-Host "⚡ Transforming canonical assets for Cursor..." -ForegroundColor Cyan

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
}

$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml"
foreach ($file in $ruleFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $name = $parsed.Name
    $desc = $parsed.Description
    $content = $parsed.Content
    $alwaysApply = $parsed.AlwaysApply
    $globs = $parsed.Globs

    if ($name -and $content) {
        $mdcContent = @"
---
description: $desc
alwaysApply: $alwaysApply
globs: $globs
---

$content
"@
        $outFile = "$TargetDir\$name.mdc"
        Write-Host "  → Rule: $name (.mdc)" -ForegroundColor Yellow
        Write-Host "    Target: $outFile" -ForegroundColor DarkGray

        if (-not $DryRun) {
            Set-Content -Path $outFile -Value $mdcContent -Encoding UTF8
        }
    }
}

Write-Host "✨ Cursor sync completed." -ForegroundColor Green
