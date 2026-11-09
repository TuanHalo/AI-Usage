<#
.SYNOPSIS
    Interactive scaffolder for authoring new canonical AI assets (skills, rules, agents, principles).

.PARAMETER Type
    Asset type to create: 'skill', 'rule', 'agent', or 'principle'.

.PARAMETER Name
    Unique asset name in lowercase kebab-case (e.g., 'git-worktrees').

.PARAMETER Description
    Third-person trigger description explaining when the AI should activate/use this asset.

.PARAMETER SyncAfter
    Automatically execute .\scripts\sync.ps1 after scaffolding.

.EXAMPLE
    .\scripts\new-asset.ps1
    .\scripts\new-asset.ps1 -Type skill -Name "docker-sandbox" -Description "Use this skill when..."
    .\scripts\new-asset.ps1 -Type rule -Name "python-standards" -Description "Enforces PEP 8 rules..."
#>

param(
    [ValidateSet("skill", "rule", "agent", "principle")]
    [string]$Type,

    [string]$Name,
    [string]$Description,
    [string]$Scope = "global",
    [string]$Category = "architecture",
    [switch]$SyncAfter
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path "$ScriptRoot\..").Path
$AssetsRoot = "$RepoRoot\assets"

Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "         AI-Usage Canonical Asset Scaffolder      " -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta

# 1. Interactive prompts if parameters omitted
if (-not $Type) {
    Write-Host "`nSelect Asset Type to create:" -ForegroundColor Cyan
    Write-Host "  1) Skill       (Procedural workflow, tool recipe, or runbook)"
    Write-Host "  2) Rule        (Coding standard, safety guard, or constraint)"
    Write-Host "  3) Agent       (Autonomous persona, role, and capabilities)"
    Write-Host "  4) Principle   (Architectural tenet or engineering philosophy)"
    $choice = Read-Host "`nEnter selection (1-4)"
    switch ($choice) {
        "1" { $Type = "skill" }
        "2" { $Type = "rule" }
        "3" { $Type = "agent" }
        "4" { $Type = "principle" }
        default { $Type = "skill" }
    }
}

while (-not $Name -or $Name -notmatch "^[a-z][a-z0-9-]*$") {
    $Name = Read-Host "`nEnter Asset Name (lowercase-kebab-case, e.g. git-worktrees)"
    if ($Name -notmatch "^[a-z][a-z0-9-]*$") {
        Write-Host "[FAIL] Invalid name. Must be lowercase letters, numbers, and hyphens." -ForegroundColor Red
    }
}

while (-not $Description -or $Description.Length -lt 20) {
    Write-Host "`nEnter Description (minimum 20 characters):" -ForegroundColor Cyan
    Write-Host "[TIP] Best practice: State WHEN to use this asset in third-person (e.g., 'Use this skill when...')" -ForegroundColor DarkGray
    $Description = Read-Host "Description"
    if ($Description.Length -lt 20) {
        Write-Host "[FAIL] Description must be at least 20 characters." -ForegroundColor Red
    }
}

$today = (Get-Date).ToString("yyyy-MM-dd")

# 2. Generate Asset based on Type
switch ($Type) {
    "skill" {
        $skillDir = "$AssetsRoot\skills\$Name"
        New-Item -ItemType Directory -Force -Path @(
            $skillDir,
            "$skillDir\scripts",
            "$skillDir\examples",
            "$skillDir\references"
        ) | Out-Null

        $yamlContent = @"
meta:
  name: $Name
  version: "1.0.0"
  description: >-
    $Description
  tags:
    - $Name
    - workflow
  author: TuanHalo
  created: "$today"
  updated: "$today"

targets:
  antigravity:
    trigger: auto
  cursor:
    alwaysApply: false
    globs: null
  claude_code:
    scope: project
  gemini_cli:
    scope: project

content: |
  # $Name Skill

  ## Overview
  $Description

  ## Steps
  1. **Preparation**: Inspect environment and prerequisites.
  2. **Execution**: Execute procedural steps with safety checks.
  3. **Verification**: Confirm results before finishing.

  ## Usage
  State exact trigger scenarios and example user prompts.
"@
        $targetFile = "$skillDir\skill.yaml"
        Set-Content -Path $targetFile -Value $yamlContent -Encoding UTF8
        Write-Host "`n[OK] Created Skill at $targetFile" -ForegroundColor Green
        Write-Host "     |-- scripts/" -ForegroundColor DarkGray
        Write-Host "     |-- examples/" -ForegroundColor DarkGray
        Write-Host "     \-- references/" -ForegroundColor DarkGray
    }

    "rule" {
        $yamlContent = @"
meta:
  name: $Name
  version: "1.0.0"
  description: >-
    $Description
  scope: $Scope
  priority: high
  tags:
    - $Name
    - standards

targets:
  antigravity:
    trigger: always_on
  cursor:
    alwaysApply: true
    globs: null
  claude_code:
    scope: $Scope
  gemini_cli:
    scope: $Scope

content: |
  # $Name Rule

  ## Context
  $Description

  ## Guidelines
  - Guideline 1: Explicit standard requirement.
  - Guideline 2: Anti-pattern to avoid.

  ## Enforcement
  Verification command or criteria before completion.
"@
        $targetFile = "$AssetsRoot\rules\$Name.yaml"
        Set-Content -Path $targetFile -Value $yamlContent -Encoding UTF8
        Write-Host "`n[OK] Created Rule at $targetFile" -ForegroundColor Green
    }

    "agent" {
        $yamlContent = @"
meta:
  name: $Name
  version: "1.0.0"
  description: >-
    $Description
  role: "$Name Persona"
  tags:
    - agent
    - $Name

capabilities:
  - file_read
  - file_write

system_prompt: |
  You are the $Name agent.
  $Description

skills_required: []
rules_applied: []
"@
        $targetFile = "$AssetsRoot\agents\$Name.yaml"
        Set-Content -Path $targetFile -Value $yamlContent -Encoding UTF8
        Write-Host "`n[OK] Created Agent at $targetFile" -ForegroundColor Green
    }

    "principle" {
        $yamlContent = @"
meta:
  name: $Name
  version: "1.0.0"
  description: >-
    $Description
  category: "$Category"
  tags:
    - principle
    - $Name

content: |
  # $Name Principle

  ## Definition
  $Description

  ## Rationale
  Explain why this principle exists and its long-term impact on code quality and token budget.

  ## Application
  - Application in engineering
  - Application in prompt/tool design
"@
        $targetFile = "$AssetsRoot\principles\$Name.yaml"
        Set-Content -Path $targetFile -Value $yamlContent -Encoding UTF8
        Write-Host "`n[OK] Created Principle at $targetFile" -ForegroundColor Green
    }
}

# 3. Validate
& "$ScriptRoot\utils\validate.ps1"

# 4. Optional Sync
if ($SyncAfter) {
    Write-Host "`n[SYNC] Synchronizing new asset to machine..." -ForegroundColor Cyan
    & "$ScriptRoot\sync.ps1" -Target all
} else {
    Write-Host "`n[TIP] To sync this asset to Antigravity, Cursor, Claude Code, and Gemini CLI, run:" -ForegroundColor Yellow
    Write-Host "      .\scripts\sync.ps1 -Target all`n" -ForegroundColor White
}
