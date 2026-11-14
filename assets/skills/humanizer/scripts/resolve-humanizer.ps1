<#
.SYNOPSIS
    Resolves the local Humanizer skill package without duplicating upstream prompt files.

.PARAMETER HumanizerHome
    Optional explicit path to the Humanizer directory containing SKILL.md.

.PARAMETER ResolveOnly
    Prints the resolved Humanizer paths and exits.

.PARAMETER ValidatePackage
    Runs Humanizer's upstream scripts/validate-package.py via Python when requested.

.EXAMPLE
    .\scripts\resolve-humanizer.ps1 -ResolveOnly
    .\scripts\resolve-humanizer.ps1 -ValidatePackage
#>

[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$HumanizerHome = "",
    [switch]$ResolveOnly,
    [switch]$ValidatePackage
)

$ErrorActionPreference = "Stop"

function Resolve-HumanizerHome {
    param([string]$ExplicitPath)

    $candidates = @()
    if ($ExplicitPath) { $candidates += $ExplicitPath }
    if ($env:HUMANIZER_HOME) { $candidates += $env:HUMANIZER_HOME }

    $siblingCandidate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\..\humanizer"))
    $nestedCandidate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\humanizer"))
    $candidates += $siblingCandidate
    $candidates += $nestedCandidate
    $candidates += "D:\IT\humanizer"

    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $skillFile = Join-Path $candidate "SKILL.md"
        if (Test-Path $skillFile) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "Could not locate Humanizer skill package. Set HUMANIZER_HOME or ensure D:\IT\humanizer exists."
}

$resolvedHome = Resolve-HumanizerHome -ExplicitPath $HumanizerHome
$skillPath = Join-Path $resolvedHome "SKILL.md"
$readmePath = Join-Path $resolvedHome "README.md"
$validatorPath = Join-Path $resolvedHome "scripts\validate-package.py"

if ($ResolveOnly -or -not $ValidatePackage) {
    Write-Host "[OK] Humanizer Home: $resolvedHome" -ForegroundColor Green
    Write-Host "     SKILL.md:       $skillPath" -ForegroundColor DarkGray
    Write-Host "     README.md:      $readmePath" -ForegroundColor DarkGray
    if (-not $ValidatePackage) {
        exit 0
    }
}

if ($ValidatePackage) {
    if (-not (Test-Path $validatorPath)) {
        Write-Error "Upstream validator not found at '$validatorPath'."
        exit 1
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
    }
    if (-not $pythonCmd) {
        Write-Error "Python is required to run '$validatorPath'."
        exit 1
    }

    & $pythonCmd.Source $validatorPath
    exit $LASTEXITCODE
}
