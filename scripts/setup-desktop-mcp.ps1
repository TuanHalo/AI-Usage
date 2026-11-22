<#
.SYNOPSIS
    Safely previews or registers the PromptFlow Stdio MCP Server in Claude Desktop and/or Antigravity configs.
    Defaults to dry-run preview; pass -Apply to write changes (with automatic .bak backup).
#>

param(
    [ValidateSet("all", "claude-desktop", "antigravity")]
    [string]$Target = "all",

    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$McpServerPath = Join-Path $RepoRoot "desktop\dist\mcp-server.mjs"

if (-not (Test-Path $McpServerPath)) {
    Write-Host "[WARN] $McpServerPath does not exist yet. Run 'cd site; npm run build:desktop' before using the server." -ForegroundColor Yellow
}

$targets = @()
if ($Target -eq "all" -or $Target -eq "claude-desktop") {
    $targets += @{
        Name = "Claude Desktop"
        Path = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
    }
}
if ($Target -eq "all" -or $Target -eq "antigravity") {
    $targets += @{
        Name = "Antigravity"
        Path = Join-Path $env:USERPROFILE ".gemini\config\mcp_config.json"
    }
}

foreach ($t in $targets) {
    Write-Host "`n[$($t.Name)] Target config: $($t.Path)" -ForegroundColor Cyan

    $rootObj = [ordered]@{}
    $configExists = $false
    try {
        $configExists = Test-Path $t.Path
    } catch {
        if (-not $Apply) {
            Write-Host "[INFO] Cannot inspect existing file at $($t.Path) in this environment; previewing clean PromptFlow entry:" -ForegroundColor DarkYellow
        } else {
            throw
        }
    }

    if ($configExists) {
        $raw = Get-Content -Path $t.Path -Raw
        if ($raw.Trim().Length -gt 0) {
            $parsed = ConvertFrom-Json -InputObject $raw
            foreach ($prop in $parsed.PSObject.Properties) {
                $rootObj[$prop.Name] = $prop.Value
            }
        }
    }

    $serversObj = [ordered]@{}
    if ($rootObj.Contains("mcpServers") -and $null -ne $rootObj["mcpServers"]) {
        foreach ($prop in $rootObj["mcpServers"].PSObject.Properties) {
            $serversObj[$prop.Name] = $prop.Value
        }
    }

    $serversObj["promptflow"] = [ordered]@{
        command = "node"
        args    = @($McpServerPath)
    }
    $rootObj["mcpServers"] = $serversObj

    $jsonOut = ConvertTo-Json -InputObject $rootObj -Depth 10

    if (-not $Apply) {
        Write-Host "[PREVIEW] Pass -Apply to write this merged configuration (existing servers preserved):" -ForegroundColor Yellow
        Write-Host $jsonOut
        continue
    }

    $parentDir = Split-Path -Path $t.Path -Parent
    New-Item -ItemType Directory -Force -Path $parentDir | Out-Null

    if (Test-Path $t.Path) {
        $backupPath = "$($t.Path).bak"
        Copy-Item -Path $t.Path -Destination $backupPath -Force
        Write-Host "[BACKUP] Created $backupPath" -ForegroundColor DarkGray
    }

    [System.IO.File]::WriteAllText($t.Path, "$jsonOut`n", [System.Text.Encoding]::UTF8)
    Write-Host "[OK] Registered 'promptflow' MCP server in $($t.Path)" -ForegroundColor Green
}
