<#
.SYNOPSIS
    Transforms canonical AI assets into Claude Code format.
    - Skills: ~/.claude/skills/<name>/SKILL.md (+ references/, scripts/, examples/)
    - Rules:  ~/.claude/CLAUDE.md
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets",
    [string]$TargetDir = "$env:USERPROFILE\.claude",
    [switch]$DryRun
)

. "$PSScriptRoot\..\utils\yaml-parser.ps1"

$AssetsDir = (Resolve-Path $AssetsDir).Path
$SkillsDest = "$TargetDir\skills"
Write-Host "[CLAUDE] Transforming canonical assets for Claude Code..." -ForegroundColor Cyan

# 1. Transform Skills
$skillFiles = Get-ChildItem -Path "$AssetsDir\skills" -Filter "skill.yaml" -Recurse -ErrorAction SilentlyContinue
if ($skillFiles -and $skillFiles.Count -gt 0) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $SkillsDest | Out-Null
    }
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

            Write-Host "  -> Skill: $name" -ForegroundColor Yellow
            Write-Host "     Target: $skillOutFile" -ForegroundColor DarkGray

            if (-not $DryRun) {
                New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
                Set-Content -Path $skillOutFile -Value $skillMarkdown -Encoding UTF8

                # Copy supporting subdirectories if they exist (references, scripts, examples)
                $subDirs = @("references", "scripts", "examples")
                foreach ($sub in $subDirs) {
                    $srcSub = Join-Path $file.Directory.FullName $sub
                    if (Test-Path $srcSub) {
                        Copy-Item -Path $srcSub -Destination $skillDir -Recurse -Force
                    }
                }
            }
        }
    }
} else {
    Write-Host "  [INFO] No skills to sync." -ForegroundColor DarkGray
}

# 2. Transform Rules
$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml" -ErrorAction SilentlyContinue
if ($ruleFiles -and $ruleFiles.Count -gt 0) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    }
    $claudeContent = "# Global Instructions for Claude Code`n`n"
    foreach ($file in $ruleFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        $name = $parsed.Name
        $content = $parsed.Content

        if ($name -and $content) {
            $claudeContent += "<!-- Section: $name -->`n$content`n`n---`n`n"
            Write-Host "  -> Rule: $name" -ForegroundColor Yellow
        }
    }

    $outFile = "$TargetDir\CLAUDE.md"
    Write-Host "     Target: $outFile" -ForegroundColor DarkGray
    if (-not $DryRun) {
        Set-Content -Path $outFile -Value $claudeContent -Encoding UTF8
    }
} else {
    Write-Host "  [INFO] No rules to sync." -ForegroundColor DarkGray
}

Write-Host "[DONE] Claude Code sync completed." -ForegroundColor Green
