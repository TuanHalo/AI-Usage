# Example: End-to-End Pull Request Creation Walkthrough

## Scenario Overview
A developer completed work on branch `feat/cache-layer` and wants to push to remote and open a GitHub PR against `main`.

---

## Step 1: Pre-Push State Inspection
```bash
git branch --show-current
# Output: feat/cache-layer

git status --short
# Output: (clean, all changes committed)

git log main..HEAD --oneline
# Output:
# 3a1b2c3 test(cache): add redis cache invalidation unit tests
# f4e5d6c feat(cache): implement redis distributed caching adapter
```

---

## Step 2: Push Branch with Upstream Tracking
```bash
git push -u origin feat/cache-layer
# Output: Branch 'feat/cache-layer' set up to track remote branch 'feat/cache-layer' from 'origin'.
```

---

## Step 3: Generated PR Title & Description

### Generated Title
`feat(cache): implement redis distributed caching adapter`

### Generated Markdown Body
```markdown
## Summary
Introduces a distributed Redis cache adapter to reduce database load on high-frequency read endpoints. Includes TTL-based invalidation and fallback to memory cache when Redis connection drops.

## Changes
- **Cache Layer**: Added `RedisCacheAdapter` implementing the `CacheProvider` interface.
- **Resilience**: Implemented circuit-breaker fallback to local LRU in-memory cache.
- **Tests**: Added unit tests covering connection loss, key expiry, and eviction policies.

## Type of Change
- [x] New feature (non-breaking change adding functionality)
- [ ] Bug fix (non-breaking change resolving an issue)
- [ ] Refactor (code restructuring without logic changes)

## Verification & Testing
- Unit tests: `pnpm test tests/cache` (12 passing, 0 failing)
- Integration test: Local Redis container verified with `docker compose up -d redis`
- TypeScript check: `pnpm tsc --noEmit` (0 errors)

## Related Issues
Closes #88
```

---

## Step 4: Execute PR Creation via GitHub CLI

```bash
gh pr create \
  --base main \
  --head feat/cache-layer \
  --title "feat(cache): implement redis distributed caching adapter" \
  --body "## Summary
Introduces a distributed Redis cache adapter to reduce database load on high-frequency read endpoints. Includes TTL-based invalidation and fallback to memory cache when Redis connection drops.

## Changes
- **Cache Layer**: Added RedisCacheAdapter implementing CacheProvider interface.
- **Resilience**: Implemented circuit-breaker fallback to local LRU memory cache.
- **Tests**: Added unit tests covering connection loss, key expiry, and eviction policies.

## Type of Change
- [x] New feature

## Verification & Testing
- Unit tests: pnpm test tests/cache (12 passing)
- TypeScript check: pnpm tsc --noEmit (0 errors)

Closes #88"
```

### Resulting Output
```text
Creating pull request for feat/cache-layer into main in my-org/my-repo

https://github.com/my-org/my-repo/pull/142
```

