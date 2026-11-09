<#
.SYNOPSIS
    Validates canonical AI assets against the content contract and schema requirements.
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets"
)

. "$PSScriptRoot\yaml-parser.ps1"

$ErrorCount = 0
$AssetsDir = (Resolve-Path $AssetsDir).Path

Write-Host "`n🔍 Validating Canonical Assets in $AssetsDir...`n" -ForegroundColor Cyan

# 1. Validate Skills
$skillFiles = Get-ChildItem -Path "$AssetsDir\skills" -Filter "skill.yaml" -Recurse
foreach ($file in $skillFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $relPath = $file.FullName.Replace($AssetsDir, "assets")
    
    if (-not $parsed.Name) {
        Write-Host "❌ [$relPath]: Missing meta.name" -ForegroundColor Red
        $ErrorCount++
    } elseif ($parsed.Name -notmatch "^[a-z][a-z0-9-]*$") {
        Write-Host "❌ [$relPath]: Name '$($parsed.Name)' must be lowercase kebab-case" -ForegroundColor Red
        $ErrorCount++
    }

    if (-not $parsed.Description) {
        Write-Host "❌ [$relPath]: Missing meta.description" -ForegroundColor Red
        $ErrorCount++
    } elseif ($parsed.Description.Length -lt 20) {
        Write-Host "❌ [$relPath]: Description too short (<20 chars)" -ForegroundColor Red
        $ErrorCount++
    }

    if (-not $parsed.Content) {
        Write-Host "❌ [$relPath]: Missing content section" -ForegroundColor Red
        $ErrorCount++
    } else {
        Write-Host "✅ [Skill] $($parsed.Name) ($relPath)" -ForegroundColor Green
    }
}

# 2. Validate Rules
$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml"
foreach ($file in $ruleFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $relPath = $file.FullName.Replace($AssetsDir, "assets")
    
    if (-not $parsed.Name) {
        Write-Host "❌ [$relPath]: Missing meta.name" -ForegroundColor Red
        $ErrorCount++
    }
    if (-not $parsed.Content) {
        Write-Host "❌ [$relPath]: Missing content section" -ForegroundColor Red
        $ErrorCount++
    } else {
        Write-Host "✅ [Rule] $($parsed.Name) ($relPath)" -ForegroundColor Green
    }
}

# 3. Validate Agents
$agentFiles = Get-ChildItem -Path "$AssetsDir\agents" -Filter "*.yaml"
foreach ($file in $agentFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $relPath = $file.FullName.Replace($AssetsDir, "assets")
    
    if (-not $parsed.Name) {
        Write-Host "❌ [$relPath]: Missing meta.name" -ForegroundColor Red
        $ErrorCount++
    }
    if (-not $parsed.SystemPrompt) {
        Write-Host "❌ [$relPath]: Missing system_prompt section" -ForegroundColor Red
        $ErrorCount++
    } else {
        Write-Host "✅ [Agent] $($parsed.Name) ($relPath)" -ForegroundColor Green
    }
}

# 4. Validate Principles
$principleFiles = Get-ChildItem -Path "$AssetsDir\principles" -Filter "*.yaml"
foreach ($file in $principleFiles) {
    $parsed = Parse-CanonicalYaml $file.FullName
    $relPath = $file.FullName.Replace($AssetsDir, "assets")
    
    if (-not $parsed.Name) {
        Write-Host "❌ [$relPath]: Missing meta.name" -ForegroundColor Red
        $ErrorCount++
    }
    if (-not $parsed.Content) {
        Write-Host "❌ [$relPath]: Missing content section" -ForegroundColor Red
        $ErrorCount++
    } else {
        Write-Host "✅ [Principle] $($parsed.Name) ($relPath)" -ForegroundColor Green
    }
}

Write-Host "`n--------------------------------------------------"
if ($ErrorCount -eq 0) {
    Write-Host "🎉 All canonical assets validated successfully!" -ForegroundColor Green
    return $true
} else {
    Write-Host "⚠️ Validation failed with $ErrorCount error(s)." -ForegroundColor Red
    return $false
}
