# GitHub CLI (`gh`) Automation Guide

## 1. Authentication & Status Check
Before creating pull requests, check CLI readiness:

```bash
# Check if authenticated
gh auth status

# If not authenticated, login
gh auth login
```

---

## 2. Creating Pull Requests

### Basic Command
```bash
gh pr create --title "<title>" --body "<body>"
```

### Common Flags
| Flag | Description | Example |
| :--- | :--- | :--- |
| `--base <branch>` | Target branch to merge into | `--base main` |
| `--head <branch>` | Source branch containing your commits | `--head feat/user-auth` |
| `--title <string>` | Pull request title | `--title "feat(auth): add oauth2 support"` |
| `--body <string>` | Markdown description inline | `--body "## Summary\n..."` |
| `--body-file <file>`| Read description from a file | `--body-file .pr-body.md` |
| `--draft` | Create as a draft (work in progress) | `--draft` |
| `--reviewer <user>` | Request code review from username/team | `--reviewer octocat` |
| `--assignee <user>` | Assign PR to someone | `--assignee @me` |
| `--label <names>` | Add comma-separated labels | `--label "enhancement,backend"` |
| `--web` | Open the PR in browser for final inspection | `--web` |

---

## 3. Handling Multi-Line PR Descriptions

### Method A: Heredoc in Bash / Zsh
```bash
gh pr create --title "feat(auth): add oauth2 PKCE flow" --body "$(cat <<'EOF'
## Summary
Implements PKCE authorization code flow for secure single-page applications.

## Verification
- Unit tests: passed
- Manual testing: verified against auth server

Closes #105
EOF
)"
```

### Method B: Temporary File in PowerShell
```powershell
$body = @"
## Summary
Implements PKCE authorization code flow for secure single-page applications.

## Verification
- Unit tests: passed
- Manual testing: verified against auth server

Closes #105
"@

$tmpFile = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tmpFile -Value $body -Encoding UTF8
gh pr create --title "feat(auth): add oauth2 PKCE flow" --body-file $tmpFile
Remove-Item $tmpFile -Force
```

---

## 4. Fallback When `gh` Is Not Available

If `gh` CLI is not installed or the user lacks token access:
1. Provide the formatted PR title and markdown body in the chat response.
2. Construct the direct web URL for GitHub's PR compare view:
   ```text
   https://github.com/<owner>/<repo>/compare/<base-branch>...<head-branch>?expand=1
   ```
3. Advise the user to paste the generated title and description into the GitHub web interface.

