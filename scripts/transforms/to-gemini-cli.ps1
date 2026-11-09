<#
.SYNOPSIS
    Transforms canonical AI assets into Gemini CLI format (~/.gemini/GEMINI.md).
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets",
    [string]$TargetDir = "$env:USERPROFILE\.gemini",
    [switch]$DryRun
)

. "$PSScriptRoot\..\utils\yaml-parser.ps1"

$AssetsDir = (Resolve-Path $AssetsDir).Path
Write-Host "✨ Transforming canonical assets for Gemini CLI..." -ForegroundColor Cyan

$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml" -ErrorAction SilentlyContinue
if ($ruleFiles -and $ruleFiles.Count -gt 0) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    }
    $geminiContent = "# Global Instructions for Gemini CLI`n`n"
    foreach ($file in $ruleFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        $name = $parsed.Name
        $content = $parsed.Content

        if ($name -and $content) {
            $geminiContent += "<!-- Rule: $name -->`n$content`n`n---`n`n"
            Write-Host "  → Rule: $name" -ForegroundColor Yellow
        }
    }

    $outFile = "$TargetDir\GEMINI.md"
    Write-Host "    Target: $outFile" -ForegroundColor DarkGray
    if (-not $DryRun) {
        Set-Content -Path $outFile -Value $geminiContent -Encoding UTF8
    }
} else {
    Write-Host "  ℹ️ No rules to sync." -ForegroundColor DarkGray
}

Write-Host "✨ Gemini CLI sync completed." -ForegroundColor Green
