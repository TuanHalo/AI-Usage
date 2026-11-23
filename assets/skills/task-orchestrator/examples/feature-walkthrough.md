# Example Walkthrough: Chat 0 Skeleton TDD -> Parallel Chats 1 & 2

Scenario: Adding a notification subsystem (`EmailChannel` + `WebhookChannel` + `NotificationDispatcher`).

## Chat 0: Architect & Contract Lock (`Scope: Large — Parallel Split`)

### Part 1: Executive Summary
- **Goal:** Build a multi-channel notification subsystem via Top-Down Skeleton-First TDD and split channel implementations into 2 conflict-free parallel chats.
- **How:** Chat 0 defines shared interfaces (`NotificationPayload`, `ChannelAdapter`), stubs `NotificationDispatcher` and both channels, writes RED tests for every boundary, implements `NotificationDispatcher` against stubbed collaborators, and emits 2 Parallel Packets.
- **Verification:** `npm run typecheck` passes on stubs; unit tests for `EmailChannel` and `WebhookChannel` confirm RED (`NOT_IMPLEMENTED`).

### Part 2: Chat 0 Deliverables (Skeleton + RED Tests)
1. `src/notifications/types.ts` — locked `NotificationPayload` and `ChannelAdapter` interfaces.
2. `src/notifications/dispatcher.ts` — top-level orchestrator implemented & verified against an in-memory fake `ChannelAdapter` in tests.
3. `src/notifications/email-channel.ts` & `src/notifications/webhook-channel.ts` — placeholders throwing `new Error('NOT_IMPLEMENTED: send')`.
4. `tests/notifications.test.ts` — already contains failing contract tests for `EmailChannel` and `WebhookChannel`.

---

## Parallel Wave 1 (Run Simultaneously in 2 Separate Conversations)

- **Parallel Chat 1 (`Topic: Implement EmailChannel`):**
  - **Owned Files:** `src/notifications/email-channel.ts`
  - **Locked Contracts:** `src/notifications/types.ts`, `tests/notifications.test.ts`
  - **Verification:** `node --test tests/notifications.test.ts --test-name-pattern="EmailChannel"` flips RED -> GREEN.
- **Parallel Chat 2 (`Topic: Implement WebhookChannel`):**
  - **Owned Files:** `src/notifications/webhook-channel.ts`
  - **Locked Contracts:** `src/notifications/types.ts`, `tests/notifications.test.ts`
  - **Verification:** `node --test tests/notifications.test.ts --test-name-pattern="WebhookChannel"` flips RED -> GREEN.

## Wave 2: Final Integration Check (Back in Chat 0)
- Remove any temporary in-memory `ChannelAdapter` mock in the integration test so `NotificationDispatcher` exercises real `EmailChannel` and `WebhookChannel` instances.
- Grep for `NOT_IMPLEMENTED` and `TODO(tdd-mock)` -> **0 matches**.
- Run the full test suite and build -> **All GREEN**.
