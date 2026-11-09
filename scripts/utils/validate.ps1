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

Write-Host "`n[VALIDATE] Checking Canonical Assets in $AssetsDir...`n" -ForegroundColor Cyan

# 1. Validate Skills
$skillFiles = Get-ChildItem -Path "$AssetsDir\skills" -Filter "skill.yaml" -Recurse -ErrorAction SilentlyContinue
if (-not $skillFiles -or $skillFiles.Count -eq 0) {
    Write-Host "[INFO] Skills: 0 found (catalog is clean)" -ForegroundColor DarkGray
} else {
    foreach ($file in $skillFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        $relPath = $file.FullName.Replace($AssetsDir, "assets")
        
        if (-not $parsed.Name) {
            Write-Host "[FAIL] [$relPath]: Missing meta.name" -ForegroundColor Red
            $ErrorCount++
        } elseif ($parsed.Name -notmatch "^[a-z][a-z0-9-]*$") {
            Write-Host "[FAIL] [$relPath]: Name '$($parsed.Name)' must be lowercase kebab-case" -ForegroundColor Red
            $ErrorCount++
        }

        if (-not $parsed.Description) {
            Write-Host "[FAIL] [$relPath]: Missing meta.description" -ForegroundColor Red
            $ErrorCount++
        } elseif ($parsed.Description.Length -lt 20) {
            Write-Host "[FAIL] [$relPath]: Description too short (<20 chars)" -ForegroundColor Red
            $ErrorCount++
        }

        if (-not $parsed.Content) {
            Write-Host "[FAIL] [$relPath]: Missing content section" -ForegroundColor Red
            $ErrorCount++
        } else {
            Write-Host "[OK] Skill: $($parsed.Name) ($relPath)" -ForegroundColor Green
        }
    }
}

# 2. Validate Rules
$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml" -ErrorAction SilentlyContinue
if (-not $ruleFiles -or $ruleFiles.Count -eq 0) {
    Write-Host "[INFO] Rules: 0 found (catalog is clean)" -ForegroundColor DarkGray
} else {
    foreach ($file in $ruleFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        $relPath = $file.FullName.Replace($AssetsDir, "assets")
        
        if (-not $parsed.Name) {
            Write-Host "[FAIL] [$relPath]: Missing meta.name" -ForegroundColor Red
            $ErrorCount++
        }
        if (-not $parsed.Content) {
            Write-Host "[FAIL] [$relPath]: Missing content section" -ForegroundColor Red
            $ErrorCount++
        } else {
            Write-Host "[OK] Rule: $($parsed.Name) ($relPath)" -ForegroundColor Green
        }
    }
}

# 3. Validate Agents
$agentFiles = Get-ChildItem -Path "$AssetsDir\agents" -Filter "*.yaml" -ErrorAction SilentlyContinue
if (-not $agentFiles -or $agentFiles.Count -eq 0) {
    Write-Host "[INFO] Agents: 0 found (catalog is clean)" -ForegroundColor DarkGray
} else {
    foreach ($file in $agentFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        $relPath = $file.FullName.Replace($AssetsDir, "assets")
        
        if (-not $parsed.Name) {
            Write-Host "[FAIL] [$relPath]: Missing meta.name" -ForegroundColor Red
            $ErrorCount++
        }
        if (-not $parsed.SystemPrompt) {
            Write-Host "[FAIL] [$relPath]: Missing system_prompt section" -ForegroundColor Red
            $ErrorCount++
        } else {
            Write-Host "[OK] Agent: $($parsed.Name) ($relPath)" -ForegroundColor Green
        }
    }
}

# 4. Validate Principles
$principleFiles = Get-ChildItem -Path "$AssetsDir\principles" -Filter "*.yaml" -ErrorAction SilentlyContinue
if (-not $principleFiles -or $principleFiles.Count -eq 0) {
    Write-Host "[INFO] Principles: 0 found (catalog is clean)" -ForegroundColor DarkGray
} else {
    foreach ($file in $principleFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        $relPath = $file.FullName.Replace($AssetsDir, "assets")
        
        if (-not $parsed.Name) {
            Write-Host "[FAIL] [$relPath]: Missing meta.name" -ForegroundColor Red
            $ErrorCount++
        }
        if (-not $parsed.Content) {
            Write-Host "[FAIL] [$relPath]: Missing content section" -ForegroundColor Red
            $ErrorCount++
        } else {
            Write-Host "[OK] Principle: $($parsed.Name) ($relPath)" -ForegroundColor Green
        }
    }
}

Write-Host "`n--------------------------------------------------"
if ($ErrorCount -eq 0) {
    Write-Host "[SUCCESS] Validation passed with 0 errors!" -ForegroundColor Green
    return $true
} else {
    Write-Host "[ERROR] Validation failed with $ErrorCount error(s)." -ForegroundColor Red
    return $false
}
