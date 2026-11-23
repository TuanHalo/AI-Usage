# Top-Down Skeleton-First TDD Guide (Outside-In / Walking Skeleton)

This guide defines how `task-orchestrator` applies **Top-Down Skeleton-First TDD** so AI agents and humans verify architecture, tests, and implementation from high to low without falling into "fake green" traps.

## 1. The 4-Stage Lifecycle

1. **Stage 0 — High-Level Explanation (No Code Yet)**
   - Explain components, responsibilities, data flow, and boundaries in 1 concise summary + optional flow diagram.
   - Check verification budget (`Small` / `Medium — Steps` / `Large — Parallel Split`).
2. **Stage 1 — Typed Skeleton & Placeholders (Compile / Typecheck Clean)**
   - Define public types, interfaces, and exported function/class signatures across the architectural seams.
   - Populate function bodies with explicit `NOT_IMPLEMENTED` stubs (or tagged collaborator mocks when testing an upper orchestrator).
   - **Verification Gate 1:** Run compiler / typechecker (`tsc --noEmit`, `cargo check`, etc.) and confirm 0 type errors.
3. **Stage 2 — Contract Tests First (Expected RED)**
   - Write unit and integration tests targeting the Stage 1 public contracts (happy path, edge cases, error handling, backward compatibility).
   - **Verification Gate 2:** Run the test suite and **observe tests fail with `NOT_IMPLEMENTED` (RED)**. Never skip seeing RED; a test that passes on stubs is broken or testing fake data.
4. **Stage 3 — Implement Top-Down & Peel Mocks (RED -> GREEN)**
   - **Layer 1 (High-Level Orchestrator):** Implement the top-level coordinator first. If lower modules are not implemented yet, inject temporary test fakes/mocks *only* for those lower collaborators and assert orchestrator tests turn GREEN.
   - **Layer 2..N (Descend or Fan Out):** Implement each lower-level module (either sequentially by verify-gate step or via Parallel Conversation Packets on disjoint files), peeling away each temporary mock as its real module lands.
   - **Verification Gate 3 (Final):** Confirm **0 occurrences** of `NOT_IMPLEMENTED` and `TODO(tdd-mock)` remain, and run the full test + build suite GREEN.

---

## 2. The Stub-vs-Fake Rule (Preventing "Fake Green")

A common mistake with "placeholder functions that return mock data" is returning plausible hardcoded values directly from the function under test. That causes tests to pass immediately on fake logic.

| Role in Current Step | Allowed Placeholder Body | Expected Test Outcome |
| :--- | :--- | :--- |
| **Function Under Test** (not yet implemented) | `throw new Error('NOT_IMPLEMENTED: <symbolName>');` | **RED** (fails clearly with `NOT_IMPLEMENTED`) |
| **Lower-Level Collaborator** (used while testing a higher layer) | Temporary mock/fake injected in test or tagged `// TODO(tdd-mock): Step N — replace with real <module>` | Higher layer turns **GREEN**; lower layer's own unit test stays **RED** until implemented |
| **Completed Module** | Real implementation; zero `NOT_IMPLEMENTED` or `TODO(tdd-mock)` markers | Both unit and parent integration tests **GREEN** |

---

## 3. Guardrails Against Common Pitfalls

1. **Avoid Over-Mocking Private Internals:** Create skeletons and contract tests only at **architectural boundaries** (typically 2–3 layers: Entry/Orchestrator -> Domain Services -> Adapters/Stores). Never stub or mock 5-line private helpers.
2. **Contract Revision Rule:** Public interfaces locked in Stage 1 stay frozen across parallel streams unless an explicit contract-bump note updates every affected stream and test. Private helper signatures stay flexible until implemented.
3. **Mock-Zero Hygiene Check:** Before declaring a task done, grep the diff/source for `NOT_IMPLEMENTED` and `TODO(tdd-mock)` and require 0 matches.

---

## 4. Task Applicability Matrix

| Task Type | Use Full 4-Stage Top-Down TDD? | Recommended Verification Strategy |
| :--- | :--- | :--- |
| **New feature, parser, state machine, API, multi-module refactor** | **Yes (Full 4 Stages)** | Typed skeleton -> RED tests -> Top-down GREEN -> Mock-zero check |
| **Large multi-domain system (`Large — Parallel Split`)** | **Yes (Chat 0 runs Stages 0–2)** | Chat 0 locks types + stubs + RED tests; Chats 1..N turn assigned tests GREEN |
| **Declarative rules, YAML assets, docs, CSS styling** | **No (Skip stubs/mocks)** | Schema validator, token/lint checks, and site/static build |
| **Unknown external API / unverified library behavior** | **Spike First, Then TDD** | Run a time-boxed throwaway PoC to learn constraints, discard spike, then lock Stage 1 skeleton & tests |
