# Conventional Commits Reference Guide

## 1. Anatomy of a Conventional Commit

A Conventional Commit follows this structure:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Key Elements
- **type**: Communicates intent to consumers and automation tools (e.g. `feat`, `fix`).
- **scope** (optional): Noun describing the section of the codebase affected (e.g. `auth`, `parser`, `api`).
- **description**: Short summary of code changes in imperative present tense.
- **body** (optional): Explains the motivation behind the change and contrasts it with previous behavior.
- **footer** (optional): References issue trackers or breaking changes (e.g. `Fixes #42`, `BREAKING CHANGE: ...`).

---

## 2. Commit Types

| Type | Purpose | SemVer Bump |
| :--- | :--- | :--- |
| `feat` | Adds new feature or user-facing capability | MINOR |
| `fix` | Patches a bug or regression | PATCH |
| `refactor` | Code restructuring that neither fixes a bug nor adds a feature | None / PATCH |
| `perf` | Code change improving execution speed or memory footprint | PATCH |
| `test` | Adding missing tests or correcting existing tests | None |
| `docs` | Documentation only changes (README, inline docstrings) | None |
| `style` | Formatting, whitespace, semicolon fixes (no logic impact) | None |
| `build` | Changes to build scripts, dependencies, package configs | None / PATCH |
| `ci` | Changes to CI/CD workflows, runners, deployment pipelines | None |
| `chore` | Routine repository maintenance, tooling updates | None |

---

## 3. Best Practice Guidelines

1. **Imperative Mood**:
   - Write: `feat(search): add fuzzy query matching`
   - Avoid: `feat(search): added fuzzy query matching` or `feat(search): adds fuzzy query`

2. **Casing and Punctuation**:
   - Start description with lowercase letter immediately after the colon and space.
   - Do NOT end the description line with a period or exclamation mark.
   - Keep description under 50 characters, never exceeding 72 characters.

3. **Body Construction**:
   - Separate the subject from the body with a blank line.
   - Explain **why** the change was made rather than simply repeating **how**.
   - Wrap body text at 72 characters for terminal readability.

4. **Breaking Changes**:
   - Append `!` after the type/scope: `feat(api)!: switch authentication to bearer tokens`
   - Or include footer:
     ```text
     BREAKING CHANGE: environment variable API_KEY is replaced by AUTH_TOKEN.
     ```

---

## 4. Good vs Anti-Pattern Examples

### Good Examples
- `fix(router): resolve memory leak when handling disconnected sockets`
- `feat(cart): implement guest checkout flow`
- `refactor(database): extract connection pooling into dedicated module`
- `docs(readme): add troubleshooting section for docker setup`

### Anti-Patterns to Avoid
- `git commit -m "fix stuff"` (Non-descriptive, missing scope and type)
- `git commit -m "WIP"` (Non-atomic, unclear state)
- `git commit -m "feat: added login, updated tests, fixed css and bump lodash"` (Multi-concern bundle)
- `git commit -m "fix: Fixed typo in auth.ts."` (Past tense, trailing period)

