<#
.SYNOPSIS
    Transforms canonical AI assets into Antigravity (AGY) format.
    - Skills: ~/.gemini/config/skills/<name>/SKILL.md
    - Rules: ~/.gemini/config/rules/AGENTS.md
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets",
    [string]$TargetDir = "$env:USERPROFILE\.gemini\config",
    [switch]$DryRun
)

. "$PSScriptRoot\..\utils\yaml-parser.ps1"

$AssetsDir = (Resolve-Path $AssetsDir).Path
$SkillsDest = "$TargetDir\skills"
$RulesDest = "$TargetDir\rules"

Write-Host "🤖 Transforming canonical assets for Antigravity..." -ForegroundColor Cyan

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $SkillsDest, $RulesDest | Out-Null
}

# 1. Transform Skills
$skillFiles = Get-ChildItem -Path "$AssetsDir\skills" -Filter "skill.yaml" -Recurse
foreach ($file in $skillFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $name = $parsed.Name
    $desc = $parsed.Description
    $content = $parsed.Content

    if ($name -and $content) {
        $skillMarkdown = @"
---
name: $name
description: >-
  $desc
---

$content
"@
        $skillDir = "$SkillsDest\$name"
        $skillOutFile = "$skillDir\SKILL.md"

        Write-Host "  → Skill: $name" -ForegroundColor Yellow
        Write-Host "    Target: $skillOutFile" -ForegroundColor DarkGray

        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
            Set-Content -Path $skillOutFile -Value $skillMarkdown -Encoding UTF8
        }
    }
}

# 2. Transform Rules
$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml"
$consolidatedRules = "# Global AI Rules (Synced from AI-Usage)`n`n"

foreach ($file in $ruleFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $name = $parsed.Name
    $content = $parsed.Content

    if ($name -and $content) {
        $consolidatedRules += "<!-- Rule: $name -->`n$content`n`n---`n`n"
        Write-Host "  → Rule: $name" -ForegroundColor Yellow
    }
}

$ruleOutFile = "$RulesDest\AGENTS.md"
Write-Host "    Target: $ruleOutFile" -ForegroundColor DarkGray
if (-not $DryRun) {
    Set-Content -Path $ruleOutFile -Value $consolidatedRules -Encoding UTF8
}

Write-Host "✨ Antigravity sync completed." -ForegroundColor Green
