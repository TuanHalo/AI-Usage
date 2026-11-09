<#
.SYNOPSIS
    Transforms canonical AI assets into Claude Code format (~/.claude/CLAUDE.md).
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets",
    [string]$TargetDir = "$env:USERPROFILE\.claude",
    [switch]$DryRun
)

. "$PSScriptRoot\..\utils\yaml-parser.ps1"

$AssetsDir = (Resolve-Path $AssetsDir).Path
Write-Host "🧠 Transforming canonical assets for Claude Code..." -ForegroundColor Cyan

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
}

$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml"
$claudeContent = "# Global Instructions for Claude Code`n`n"

foreach ($file in $ruleFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $name = $parsed.Name
    $content = $parsed.Content

    if ($name -and $content) {
        $claudeContent += "<!-- Section: $name -->`n$content`n`n---`n`n"
        Write-Host "  → Rule: $name" -ForegroundColor Yellow
    }
}

$outFile = "$TargetDir\CLAUDE.md"
Write-Host "    Target: $outFile" -ForegroundColor DarkGray
if (-not $DryRun) {
    Set-Content -Path $outFile -Value $claudeContent -Encoding UTF8
}

Write-Host "✨ Claude Code sync completed." -ForegroundColor Green
