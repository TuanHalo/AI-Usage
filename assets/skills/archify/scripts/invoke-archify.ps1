<#
.SYNOPSIS
    Resolves the local Archify skill package and runs bin/archify.mjs without duplicating upstream files.

.PARAMETER ArchifyHome
    Optional explicit path to the Archify skill directory containing SKILL.md and bin/archify.mjs.

.PARAMETER ResolveOnly
    Prints the resolved Archify and Node.js paths and exits without running bin/archify.mjs.

.PARAMETER Arguments
    Arguments forwarded verbatim to bin/archify.mjs (e.g. doctor, guide, finalize, validate).

.EXAMPLE
    .\scripts\invoke-archify.ps1 -ResolveOnly
    .\scripts\invoke-archify.ps1 doctor
    .\scripts\invoke-archify.ps1 finalize sequence .archify\seq\candidate.json .archify\seq\auth.html --quality showcase --json
#>

[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$ArchifyHome = "",
    [switch]$ResolveOnly,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"

function Resolve-ArchifyHome {
    param([string]$ExplicitPath)

    $candidates = @()
    if ($ExplicitPath) { $candidates += $ExplicitPath }
    if ($env:ARCHIFY_HOME) { $candidates += $env:ARCHIFY_HOME }

    $siblingCandidate = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\archify\archify"))
    $candidates += $siblingCandidate
    $candidates += "D:\IT\archify\archify"

    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $cliFile = Join-Path $candidate "bin\archify.mjs"
        $skillFile = Join-Path $candidate "SKILL.md"
        if ((Test-Path $cliFile) -and (Test-Path $skillFile)) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "Could not locate Archify skill package. Set ARCHIFY_HOME or ensure D:\IT\archify\archify exists."
}

function Resolve-NodeExecutable {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $fallbacks = @(
        "C:\nvm4w\nodejs\node.exe",
        "C:\Program Files\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
    )
    foreach ($path in $fallbacks) {
        if (Test-Path $path -ErrorAction SilentlyContinue) {
            return $path
        }
    }

    return $null
}

$resolvedHome = Resolve-ArchifyHome -ExplicitPath $ArchifyHome
$cliPath = Join-Path $resolvedHome "bin\archify.mjs"
$skillPath = Join-Path $resolvedHome "SKILL.md"
$nodeExe = Resolve-NodeExecutable

if ($ResolveOnly) {
    Write-Host "[OK] Archify Home: $resolvedHome" -ForegroundColor Green
    Write-Host "     SKILL.md:     $skillPath" -ForegroundColor DarkGray
    Write-Host "     CLI Entry:    $cliPath" -ForegroundColor DarkGray
    if ($nodeExe) {
        Write-Host "     Node.js:      $nodeExe" -ForegroundColor DarkGray
    } else {
        Write-Host "     Node.js:      [UNAVAILABLE IN CURRENT SHELL/SANDBOX]" -ForegroundColor Yellow
    }
    exit 0
}

if (-not $nodeExe) {
    Write-Error "Node.js (>=18) is required to run '$cliPath'. In sandboxed environments where user-local NVM paths are blocked, run this command unsandboxed."
    exit 1
}

if (-not $Arguments -or $Arguments.Count -eq 0) {
    $Arguments = @("--help")
}

& $nodeExe $cliPath @Arguments
exit $LASTEXITCODE
