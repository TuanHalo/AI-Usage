# Example: Partitioning Multi-File Changes into Atomic Commits

## Scenario Overview
A developer completed an authentication token rotation feature. Running `git status -s` displays:

```text
 M src/auth/jwt-service.ts
 M src/auth/token-storage.ts
 M tests/auth/jwt-service.test.ts
 M package.json
 M pnpm-lock.yaml
 M docs/authentication.md
?? scratch.log
```

---

## Step 1: Cleanup Unwanted Files
The file `scratch.log` is a temporary debug output.
```bash
rm scratch.log
# Ensure *.log is listed in .gitignore
```

---

## Step 2: Formulate Logical Groups

Analyzing the changes reveals 3 distinct concerns:
- **Group 1 (Dependencies & Runtime)**: `package.json`, `pnpm-lock.yaml`, `src/auth/jwt-service.ts`, `src/auth/token-storage.ts`
- **Group 2 (Verification)**: `tests/auth/jwt-service.test.ts`
- **Group 3 (Documentation)**: `docs/authentication.md`

---

## Step 3: Execute Atomic Commits Sequentially

### Commit 1: Core Feature Implementation
```bash
git add package.json pnpm-lock.yaml src/auth/jwt-service.ts src/auth/token-storage.ts
git diff --cached --stat
git commit -m "feat(auth): implement jwt refresh token rotation" -m "Adds rotating refresh token support with sliding session expiration to prevent replay attacks."
```

### Commit 2: Automated Tests
```bash
git add tests/auth/jwt-service.test.ts
git diff --cached --stat
git commit -m "test(auth): add unit test suite for token rotation flow"
```

### Commit 3: Documentation
```bash
git add docs/authentication.md
git diff --cached --stat
git commit -m "docs(auth): update authentication guide with token rotation sequence"
```

---

## Step 4: Verification
```bash
git status --short
# Output: (empty - working tree clean)

git log -n 3 --oneline
# Output:
# a1b2c3d docs(auth): update authentication guide with token rotation sequence
# e4f5g6h test(auth): add unit test suite for token rotation flow
# i7j8k9l feat(auth): implement jwt refresh token rotation
```
Each commit is cleanly partitioned, self-contained, and follows Conventional Commits.

