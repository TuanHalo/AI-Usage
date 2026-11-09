<#
.SYNOPSIS
    Lightweight YAML parser for canonical asset files.
#>

function Parse-CanonicalYaml {
    param([string]$FilePath)

    $raw = Get-Content -Path $FilePath -Raw
    $lines = Get-Content -Path $FilePath

    $data = @{
        Name = ""
        Version = "1.0.0"
        Description = ""
        Tags = @()
        Author = ""
        Scope = "global"
        Priority = "medium"
        Role = ""
        Category = ""
        Capabilities = @()
        SkillsRequired = @()
        RulesApplied = @()
        AlwaysApply = "true"
        Globs = ""
        Content = ""
        SystemPrompt = ""
    }

    $inDescription = $false
    $descLines = @()
    $inContent = $false
    $contentLines = @()
    $inSystemPrompt = $false
    $systemPromptLines = @()
    $inTags = $false
    $inCapabilities = $false
    $inSkillsRequired = $false
    $inRulesApplied = $false

    foreach ($line in $lines) {
        # Check block ends
        if ($inTags) {
            if ($line -match "^\s*-\s+(.*)$") {
                $data.Tags += $matches[1].Trim()
                continue
            } else {
                $inTags = $false
            }
        }

        if ($inCapabilities) {
            if ($line -match "^\s*-\s+(.*)$") {
                $data.Capabilities += $matches[1].Trim()
                continue
            } else {
                $inCapabilities = $false
            }
        }

        if ($inSkillsRequired) {
            if ($line -match "^\s*-\s+(.*)$") {
                $data.SkillsRequired += $matches[1].Trim()
                continue
            } else {
                $inSkillsRequired = $false
            }
        }

        if ($inRulesApplied) {
            if ($line -match "^\s*-\s+(.*)$") {
                $data.RulesApplied += $matches[1].Trim()
                continue
            } else {
                $inRulesApplied = $false
            }
        }

        if ($inDescription) {
            if ($line -match "^\s*[a-zA-Z0-9_]+:\s*") {
                $inDescription = $false
                $data.Description = ($descLines -join " ").Trim()
            } else {
                $descLines += $line.Trim()
                continue
            }
        }

        if ($inContent) {
            $contentLines += $line
            continue
        }

        if ($inSystemPrompt) {
            if ($line -match "^[a-zA-Z0-9_]+:") {
                $inSystemPrompt = $false
                $data.SystemPrompt = ($systemPromptLines -join "`n").Trim()
            } else {
                $systemPromptLines += $line
                continue
            }
        }

        # Match single-line properties
        if ($line -match "^\s*name:\s*['""]?([^'""]+)['""]?") {
            $data.Name = $matches[1].Trim()
        } elseif ($line -match "^\s*version:\s*['""]?([^'""]+)['""]?") {
            $data.Version = $matches[1].Trim()
        } elseif ($line -match "^\s*author:\s*['""]?([^'""]+)['""]?") {
            $data.Author = $matches[1].Trim()
        } elseif ($line -match "^\s*scope:\s*['""]?([^'""]+)['""]?") {
            $data.Scope = $matches[1].Trim()
        } elseif ($line -match "^\s*priority:\s*['""]?([^'""]+)['""]?") {
            $data.Priority = $matches[1].Trim()
        } elseif ($line -match "^\s*role:\s*['""]?([^'""]+)['""]?") {
            $data.Role = $matches[1].Trim()
        } elseif ($line -match "^\s*category:\s*['""]?([^'""]+)['""]?") {
            $data.Category = $matches[1].Trim()
        } elseif ($line -match "^\s*alwaysApply:\s*(true|false)") {
            $data.AlwaysApply = $matches[1].Trim()
        } elseif ($line -match "^\s*globs:\s*['""]?([^'""]+)['""]?") {
            $data.Globs = $matches[1].Trim()
        } elseif ($line -match "^\s*tags:\s*$") {
            $inTags = $true
            $data.Tags = @()
        } elseif ($line -match "^\s*capabilities:\s*$") {
            $inCapabilities = $true
            $data.Capabilities = @()
        } elseif ($line -match "^\s*skills_required:\s*$") {
            $inSkillsRequired = $true
            $data.SkillsRequired = @()
        } elseif ($line -match "^\s*rules_applied:\s*$") {
            $inRulesApplied = $true
            $data.RulesApplied = @()
        } elseif ($line -match "^\s*description:\s*>?-?\s*(.*)$") {
            $inline = $matches[1].Trim()
            if ($inline -ne "" -and $inline -ne ">-" -and $inline -ne "|") {
                $data.Description = $inline
            } else {
                $inDescription = $true
                $descLines = @()
            }
        } elseif ($line -match "^content:\s*\|") {
            $inContent = $true
            $contentLines = @()
        } elseif ($line -match "^system_prompt:\s*\|") {
            $inSystemPrompt = $true
            $systemPromptLines = @()
        }
    }

    if ($inDescription -and $descLines.Count -gt 0) {
        $data.Description = ($descLines -join " ").Trim()
    }
    if ($contentLines.Count -gt 0) {
        # Normalize indentation: remove 2 leading spaces from YAML block scalar
        $normalized = $contentLines | ForEach-Object {
            if ($_ -match "^  (.*)$") { $matches[1] } else { $_ }
        }
        $data.Content = ($normalized -join "`n").Trim()
    }
    if ($systemPromptLines.Count -gt 0) {
        $normalized = $systemPromptLines | ForEach-Object {
            if ($_ -match "^  (.*)$") { $matches[1] } else { $_ }
        }
        $data.SystemPrompt = ($normalized -join "`n").Trim()
    }

    return $data
}
