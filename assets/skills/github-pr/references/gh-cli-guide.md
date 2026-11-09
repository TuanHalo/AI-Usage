# GitHub CLI (`gh`) Automation & PR Guide

## 1. Environment & Path Resolution

On Windows systems, newly installed CLI binaries may not appear immediately in active PowerShell environments.

### Binary Resolution Logic
```powershell
$ghPath = (Get-Command gh -ErrorAction SilentlyContinue)?.Source
if (-not $ghPath) {
    # Refresh PATH from registry
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $ghPath = (Get-Command gh -ErrorAction SilentlyContinue)?.Source
}
# Fallback check standard install location
if (-not $ghPath -and (Test-Path "C:\Program Files\GitHub CLI\gh.exe")) {
    $ghPath = "C:\Program Files\GitHub CLI\gh.exe"
}
```

### Installation If Missing
```powershell
winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements --silent
```

### Authentication Flow
```powershell
# Check current authentication status
gh auth status

# Interactive browser login
gh auth login --web

# Headless / token login via stdin
gh auth login --with-token < token.txt
```

---

## 2. Shell Escaping Hazards on Windows PowerShell

### The Problem With `--body "..."`
Passing multi-line Markdown descriptions with quotes, backticks, code blocks, or `#` headers directly into `--body "..."` on Windows PowerShell results in:
- Argument stripping and truncated bodies.
- Unrecognized flag errors (`unknown flag: --body`).
- PowerShell parser escaping crashes on special symbols.

### The Standard Solution: `--body-file`
Always isolate the Markdown description into a UTF-8 temporary file:

```powershell
$tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "pr-body-$([System.Guid]::NewGuid().ToString('N')).md")
[System.IO.File]::WriteAllText($tempFile, $markdownDescription, [System.Text.Encoding]::UTF8)

try {
    gh pr create --base main --head feat/my-branch --title "feat: my title" --body-file $tempFile
}
finally {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}
```

---

## 3. Non-Interactive Automation Safeguards

When executing `gh` inside automated agent sessions:
1. **Disable Prompts**:
   Set `$env:GH_PROMPT_DISABLED = "1"` and `$env:GH_NO_UPDATE_NOTIFIER = "1"` to prevent hanging on interactive input or update notifications.
2. **Explicit Arguments**:
   Always provide `--base`, `--head`, `--title`, and `--body-file` explicitly so `gh` never prompts for missing parameters.

---

## 4. Idempotency: Checking for Existing PRs

Before creating a PR, check if an open PR already exists for the head branch to prevent `already exists` errors:

```powershell
$existing = gh pr list --head feat/my-branch --json number,url,title,state | ConvertFrom-Json
if ($existing.Count -gt 0) {
    # Update existing PR instead of failing
    gh pr edit $existing[0].number --title "new title" --body-file $tempFile
} else {
    # Create new PR
    gh pr create --base main --head feat/my-branch --title "new title" --body-file $tempFile
}
```

---

## 5. Automated Helper Script

Use the bundled automation script in this skill:
```powershell
.\scripts\create-pr.ps1 -Title "feat(scope): title" -Body "## Summary`n..." -Base "main"
```
Or pass an existing markdown file:
```powershell
.\scripts\create-pr.ps1 -Title "feat(scope): title" -BodyFile ".\docs\pr-description.md"
```
This handles path resolution, auth checks, body file safety, existing PR detection, and execution automatically.
