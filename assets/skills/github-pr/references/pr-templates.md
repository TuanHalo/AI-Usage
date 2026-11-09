# Pull Request Template Library

## 1. Canonical Feature PR Template

```markdown
## Summary
<!-- Provide a concise overview of what this PR accomplishes and the business or technical motivation. -->

## Changes
<!-- Bullet list of specific modifications grouped by area. -->
- **Component / Service**: Description of change
- **API / Schema**: Added or updated endpoints / types
- **Tests**: Summary of new test cases or regression coverage

## Type of Change
- [ ] New feature (non-breaking change adding functionality)
- [ ] Bug fix (non-breaking change resolving an issue)
- [ ] Refactor (code restructuring without logic changes)
- [ ] Performance improvement
- [ ] Documentation update
- [ ] Breaking change (fix or feature causing existing functionality to break)

## Verification & Testing
<!-- Describe how these changes were tested and verified. Include commands and results. -->
- Unit tests: `pnpm test` (passed)
- Linter: `pnpm lint` (passed, 0 errors)
- Type check: `pnpm tsc --noEmit` (passed)
- Manual test: Step-by-step verification notes or screenshot if applicable

## Related Issues
Closes #<!-- issue number -->
```

---

## 2. Bug Fix PR Template

```markdown
## Problem
<!-- What was broken or behaving unexpectedly? Include error messages or steps to reproduce. -->

## Root Cause
<!-- Why did the bug occur in the previous implementation? -->

## Solution
<!-- How does this PR resolve the root cause safely? -->

## Verification
- Added regression test in `path/to/test.ts`
- Verified fix locally: `pnpm test`

## Related Issues
Fixes #<!-- issue number -->
```

---

## 3. Architecture & Refactor PR Template

```markdown
## Motivation & Background
<!-- Why is this refactoring necessary? What technical debt or scalability issue does it solve? -->

## Architecture Changes
<!-- Summary of structural, module, or dependency changes. -->
- Extracted `X` from `Y` into standalone module `Z`
- Simplified interface contracts

## Risk Assessment & Safety
- [ ] Zero behavior changes in public APIs
- [ ] Backward-compatible
- [ ] Test coverage preserved or increased

## Verification
- Full test suite passed: `pnpm test`
```

---

## 4. Title Best Practices for Pull Requests

- Keep PR titles under 70 characters.
- Follow Conventional Commits prefixes: `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `chore:`.
- Use the imperative mood: `feat(billing): add stripe webhook handler` rather than `feat(billing): added webhook handler`.
- Do not include branch names or ticket IDs in the title if they clutter the view; put ticket links in the description body (`Closes #123`).

