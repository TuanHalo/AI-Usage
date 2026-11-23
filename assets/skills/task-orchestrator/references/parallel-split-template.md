# Verification Scope Sizing & Parallel Conversation Split Template

Use this guide whenever a task may exceed a single easy-to-verify diff or spans multiple independent modules.

## 1. Verification Budget Matrix

| `Scope` Label | Quantitative Budget | Execution Strategy |
| :--- | :--- | :--- |
| `Small` | <= 2–3 files, <= ~150 changed LOC, 1 verification check | Execute in 1 turn and run the verification command immediately. |
| `Medium — Steps` | 3–6 files, ~150–400 changed LOC, tightly coupled layers | Stay in 1 conversation, but execute as 2–4 sequential **Verify-Gate Steps** (verify Step *k* before starting Step *k+1*). |
| `Large — Parallel Split` | > 6 files, > ~400 LOC, or >= 3 independent modules/domains | **Predict upfront in Chat 0.** Finish Stage 0 (Overview), Stage 1 (Typed Skeleton), and Stage 2 (Failing Tests) in Chat 0, then issue **Parallel Conversation Packets** for Chats 1..N. |

## 2. Parallel Split Preconditions (Do Not Split Unless All 3 Hold)

1. **Locked Contracts:** Shared types, schemas, and boundary tests already exist on disk from Chat 0.
2. **Disjoint Writable Files:** No two parallel Wave 1 conversations are allowed to modify the same file.
3. **Independent Verification:** Each parallel conversation can run a targeted command to prove its assigned tests flip RED -> GREEN.

> If shared files (like an index barrel, i18n dictionary, or route registry) must be touched, either pre-wire them in Chat 0's skeleton or assign them exclusively to a final **Wave 2 Integration** turn.

---

## 3. Parallel Conversation Packet Template

Emit one packet per independent workstream at the end of Chat 0:

```markdown
### Parallel Packet — Chat <N>: <Short Workstream Name>
- **Session Anchor (`Topic`):** <Narrow, single-responsibility goal>
- **Wave / Merge Order:** Wave 1 (Parallel) | Wave 2 (After Chat X, Y)
- **Owned Files (Writable ONLY):**
  - `path/to/fileA.ts`
  - `path/to/fileB.ts`
- **Locked Contracts (Read-Only):**
  - `path/to/types.ts`
  - `path/to/contract.test.ts`
- **Verification Command:** `<exact test/build command that must flip RED -> GREEN>`
- **Copy-Paste Kickoff Prompt:**
  > Stay strictly anchored on **Topic: `<Topic>`**. Read the locked contracts in `<files>`. Implement ONLY `<Owned Files>` to turn `<failing test names>` from RED to GREEN with zero `NOT_IMPLEMENTED` or `TODO(tdd-mock)` left inside owned files. Do not modify files outside Owned Files; park any unrelated improvements under `Parked:`. Run `<Verification Command>` and return a Two-Part response (Executive Summary + Detailed Diff/Results).
```
