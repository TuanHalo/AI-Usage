<#
.SYNOPSIS
    Transforms canonical AI assets into structured JSON catalogs for the Astro documentation site.
    - Skills: site/src/data/skills.json
    - Rules: site/src/data/rules.json
    - Agents: site/src/data/agents.json
    - Principles: site/src/data/principles.json
#>

param(
    [string]$AssetsDir = "$PSScriptRoot\..\..\assets",
    [string]$SiteDataDir = "$PSScriptRoot\..\..\site\src\data",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\utils\yaml-parser.ps1"

$AssetsDir = (Resolve-Path $AssetsDir).Path
$SiteDataDir = [System.IO.Path]::GetFullPath($SiteDataDir)

Write-Host "[SITE] Transforming canonical assets for Astro Documentation Site..." -ForegroundColor Cyan

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $SiteDataDir | Out-Null
}

# 1. Transform Skills
$skillsList = @()
$skillFiles = Get-ChildItem -Path "$AssetsDir\skills" -Filter "skill.yaml" -Recurse -ErrorAction SilentlyContinue

if ($skillFiles) {
    foreach ($file in $skillFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        if (-not $parsed.Name) { continue }

        # Extract steps from markdown content
        $steps = @()
        if ($parsed.Content) {
            $lines = $parsed.Content -split "`n"
            foreach ($line in $lines) {
                if ($line -match "^###\s+\d+\.\s+(.*)$") {
                    $steps += $matches[1].Trim()
                } elseif ($line -match "^\d+\.\s+\*\*(.*?)\*\*") {
                    $steps += $matches[1].Trim()
                }
            }
        }
        if ($steps.Count -eq 0) {
            $steps = @("Preparation", "Execution", "Verification")
        }

        # Formatted targets
        $targets = @("Antigravity (auto)", "Cursor", "Claude Code", "Gemini CLI")

        $skillsList += [ordered]@{
            name        = $parsed.Name
            version     = $parsed.Version
            description = $parsed.Description
            tags        = if ($parsed.Tags.Count -gt 0) { $parsed.Tags } else { @($parsed.Name, "workflow") }
            targets     = $targets
            steps       = $steps
        }

        Write-Host "  -> Skill catalog entry: $($parsed.Name)" -ForegroundColor Yellow
    }
}

# 2. Transform Rules
$rulesList = @()
$ruleFiles = Get-ChildItem -Path "$AssetsDir\rules" -Filter "*.yaml" -ErrorAction SilentlyContinue

if ($ruleFiles) {
    foreach ($file in $ruleFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        if (-not $parsed.Name) { continue }

        $guidelines = @()
        if ($parsed.Content) {
            $lines = $parsed.Content -split "`n"
            $inGuidelines = $false
            foreach ($line in $lines) {
                if ($line -match "^##\s+Guidelines") {
                    $inGuidelines = $true
                    continue
                } elseif ($line -match "^##\s+") {
                    $inGuidelines = $false
                }
                if ($inGuidelines -and $line -match "^\s*-\s+(.*)$") {
                    $guidelines += $matches[1].Trim()
                }
            }
        }

        $rulesList += [ordered]@{
            name        = $parsed.Name
            version     = $parsed.Version
            scope       = $parsed.Scope
            priority    = $parsed.Priority
            description = $parsed.Description
            tags        = if ($parsed.Tags.Count -gt 0) { $parsed.Tags } else { @($parsed.Name, "standards") }
            guidelines  = $guidelines
        }

        Write-Host "  -> Rule catalog entry: $($parsed.Name)" -ForegroundColor Yellow
    }
}

# 3. Transform Agents
$agentsList = @()
$agentFiles = Get-ChildItem -Path "$AssetsDir\agents" -Filter "*.yaml" -ErrorAction SilentlyContinue

if ($agentFiles) {
    foreach ($file in $agentFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        if (-not $parsed.Name) { continue }

        $agentsList += [ordered]@{
            name         = $parsed.Name
            version      = $parsed.Version
            role         = if ($parsed.Role) { $parsed.Role } else { "$($parsed.Name) Persona" }
            description  = $parsed.Description
            capabilities = if ($parsed.Capabilities.Count -gt 0) { $parsed.Capabilities } else { @("file_read", "file_write") }
            skills       = if ($parsed.SkillsRequired.Count -gt 0) { $parsed.SkillsRequired } else { @() }
            rules        = if ($parsed.RulesApplied.Count -gt 0) { $parsed.RulesApplied } else { @() }
            tags         = if ($parsed.Tags.Count -gt 0) { $parsed.Tags } else { @("agent", $parsed.Name) }
        }

        Write-Host "  -> Agent catalog entry: $($parsed.Name)" -ForegroundColor Yellow
    }
}

# 4. Transform Principles
$principlesList = @()
$principleFiles = Get-ChildItem -Path "$AssetsDir\principles" -Filter "*.yaml" -ErrorAction SilentlyContinue

if ($principleFiles) {
    foreach ($file in $principleFiles) {
        $parsed = Parse-CanonicalYaml $file.FullName
        if (-not $parsed.Name) { continue }

        $applications = @()
        if ($parsed.Content) {
            $lines = $parsed.Content -split "`n"
            $inApplications = $false
            foreach ($line in $lines) {
                if ($line -match "^##\s+Application") {
                    $inApplications = $true
                    continue
                } elseif ($line -match "^##\s+") {
                    $inApplications = $false
                }
                if ($inApplications -and $line -match "^\s*-\s+(.*)$") {
                    $applications += $matches[1].Trim()
                }
            }
        }

        $principlesList += [ordered]@{
            name         = $parsed.Name
            version      = $parsed.Version
            category     = if ($parsed.Category) { $parsed.Category } else { "architecture" }
            description  = $parsed.Description
            applications = $applications
            tags         = if ($parsed.Tags.Count -gt 0) { $parsed.Tags } else { @("principle", $parsed.Name) }
        }

        Write-Host "  -> Principle catalog entry: $($parsed.Name)" -ForegroundColor Yellow
    }
}

# 5. Write Data JSON Files
$jsonFiles = @{
    "skills.json"      = $skillsList
    "rules.json"       = $rulesList
    "agents.json"      = $agentsList
    "principles.json"  = $principlesList
}

foreach ($entry in $jsonFiles.GetEnumerator()) {
    $outFile = Join-Path $SiteDataDir $entry.Key
    $json = ConvertTo-Json -InputObject $entry.Value -Depth 10
    Write-Host "     Target: $outFile ($($entry.Value.Count) entries)" -ForegroundColor DarkGray
    if (-not $DryRun) {
        [System.IO.File]::WriteAllText($outFile, $json, [System.Text.Encoding]::UTF8)
    }
}

Write-Host "[DONE] Site data generation completed." -ForegroundColor Green

