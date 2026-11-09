# Atomic Commit Grouping Heuristics

## 1. The Atomic Commit Principle

An **atomic commit** represents a single cohesive, self-contained unit of work that:
1. **Compiles and passes tests**: The repository is never left in a broken intermediate state.
2. **Can be reverted cleanly**: Reverting one commit removes that exact logical change without collateral damage.
3. **Enhances bisectability**: `git bisect` can pinpoint regressions directly to the specific commit responsible.
4. **Simplifies code review**: Reviewers can review commits one-by-one with clear mental context.

---

## 2. Partitioning Heuristics

When reviewing uncommitted changes (`git status` and `git diff`), group modified files into distinct clusters using these guidelines:

### Cluster A: Core Feature / Domain Logic
- Files: Model definitions, service classes, API endpoints, core algorithms.
- Rationale: Introduces the new capability.
- Commit Type: `feat(<scope>)`

### Cluster B: Automated Tests
- Files: Unit tests (`*.test.ts`, `*_test.py`), integration tests, fixtures, mocks.
- Rationale: Verifies the feature or reproduces a bug before fixing.
- Commit Type: `test(<scope>)`
- *Note*: If a test change is inseparable from the feature (TDD style), bundling test with feature is acceptable if the total diff remains small (< 10 files). For large features, separating test suites into their own commit eases review.

### Cluster C: Documentation & Type Definitions
- Files: `README.md`, `docs/`, OpenAPI specs, inline JSDoc/docstrings.
- Rationale: Updates specifications and guidance without impacting runtime logic.
- Commit Type: `docs(<scope>)`

### Cluster D: Configuration, Dependencies, and Tooling
- Files: `package.json`, lockfiles (`pnpm-lock.yaml`), `.eslintrc`, `tsconfig.json`, GitHub Actions workflows.
- Rationale: Modifies environment or toolchain.
- Commit Type: `build(<scope>)`, `ci(<scope>)`, or `chore(<scope>)`

### Cluster E: Formatting, Renaming, or Pure Refactoring
- Files: Refactored existing modules without behavioral changes.
- Rationale: Prepares codebase for a feature or cleans up technical debt.
- Rule: **Never mix refactoring and functional changes in the same commit.** Refactor first in one commit, then add the feature in a subsequent commit.

---

## 3. Interactive Hunk Staging (`git add -p`)

If a single file contains both unrelated changes (e.g. a bugfix in function A and formatting in function B):
1. Run `git add -p <file>`.
2. Choose `y` to stage the relevant hunk or `n` to skip it.
3. Choose `s` to split larger hunks into smaller pieces if needed.
4. Commit the staged hunks with appropriate message.
5. Review remaining unstaged diff and commit the second group.

