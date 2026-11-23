# ConversationFlow v1 Schema, Analyzer Prompt & Custom Instructions

## 1. `ConversationFlow` v1 JSON Schema (With Optional v2 Focus & Parking Fields)

```json
{
  "schemaVersion": "1.0",
  "title": "Short descriptive session title",
  "platform": "claude | gemini | grok | chatgpt | antigravity | generic",
  "sessionTopic": "Optional canonical topic anchor locked on Turn 1",
  "overallGoal": "1-2 sentence summary of what the user originally wanted to achieve",
  "finalOutcome": "1-2 sentence summary of what the conversation ultimately delivered",
  "parkedTopics": [
    "Optional deferred off-topic items collected across turns for follow-up chats"
  ],
  "createdAt": "2026-11-22T12:00:00.000Z",
  "parseMode": "structured-json",
  "isStreaming": false,
  "turns": [
    {
      "id": "turn-1",
      "index": 1,
      "title": "Short 3-7 word node title",
      "relation": "initial | follow-up | clarification | research-detour | pivot | refinement",
      "rawUserMessage": "EXACT verbatim user prompt text — never summarized or rewritten",
      "rawAssistantMessage": "Optional raw assistant message excerpt or full text",
      "intent": "What the user wanted in this turn",
      "inputSummary": "Key inputs, files, constraints, or snippets provided",
      "expectedOutput": "Concrete deliverable shape expected before execution",
      "actualOutput": "What the AI actually produced in this turn",
      "delta": "matched | expanded | pivoted | partial | pending",
      "deltaNote": "Short explanation of why output matched, expanded pivoted, or stayed partial",
      "extras": [
        "Bonus insight or artifact delivered beyond expectedOutput"
      ],
      "focusStatus": "on-topic | adjacent | off-topic",
      "scopeSize": "small | medium | split-steps | split-parallel",
      "parkedTopics": [
        "Optional off-topic tangent parked during this turn"
      ],
      "contractDetected": false,
      "isStreaming": false
    }
  ]
}
```

---

## 2. Zero-API Analyzer Prompt (Copy & Paste into Any AI)

Use this prompt inside Claude.ai, Gemini, Grok, or ChatGPT when you want to analyze a raw conversation that did not use the Adaptive Flow Contract rule:

```text
Analyze the conversation below and convert it into a single valid JSON object matching the ConversationFlow v1 schema.

Rules:
1. Preserve each user message VERBATIM in `rawUserMessage` (do not paraphrase or shorten it).
2. Extract `sessionTopic` (the primary session anchor) and, for each turn, `intent`, `inputSummary`, `expectedOutput`, `actualOutput`, optional `focusStatus` ("on-topic" | "adjacent" | "off-topic"), optional `scopeSize` ("small" | "medium" | "split-steps" | "split-parallel"), and optional `parkedTopics` (string[]).
3. Classify `delta` for each turn as:
   - "matched": delivered essentially what was expected
   - "expanded": delivered what was expected PLUS extra research findings, edge cases, or deliverables
   - "pivoted": shifted approach or goal based on discoveries or user redirection
   - "partial": incomplete, blocked, or answered only part of the request
   - "pending": unanswered or still in progress
4. Whenever `delta` is "expanded", list concrete bonus findings in `extras` (array of short strings).
5. Classify each turn's `relation` to the previous turn as: "initial", "follow-up", "clarification", "research-detour", "pivot", or "refinement".
6. Output ONLY raw valid JSON inside a ```json code block with no extra commentary.

Schema:
{
  "schemaVersion": "1.0",
  "title": "string",
  "platform": "claude | gemini | grok | chatgpt | antigravity | generic",
  "sessionTopic": "string (optional)",
  "overallGoal": "string",
  "finalOutcome": "string",
  "parkedTopics": ["string (optional)"],
  "turns": [
    {
      "index": 1,
      "title": "string",
      "relation": "initial | follow-up | clarification | research-detour | pivot | refinement",
      "rawUserMessage": "verbatim string",
      "intent": "string",
      "inputSummary": "string",
      "expectedOutput": "string",
      "actualOutput": "string",
      "delta": "matched | expanded | pivoted | partial | pending",
      "deltaNote": "string",
      "extras": ["string"],
      "focusStatus": "on-topic | adjacent | off-topic (optional)",
      "scopeSize": "small | medium | split-steps | split-parallel (optional)",
      "parkedTopics": ["string (optional)"]
    }
  ]
}
```

---

## 3. Custom Instructions Snippet (For Claude.ai / Gemini / Grok / ChatGPT — v2)

Paste this into your AI tool's **Custom Instructions** / **Saved Info** / **System Preferences**:

```text
For non-trivial requests, follow the Adaptive Flow Contract v2:
1. Start with a compact Pre-Run blockquote:
> **[Flow Contract | Pre-Run]**
> - **Topic:** <active session topic anchor (locked on Turn 1)>
> - **Focus:** On-Topic | Adjacent | Off-Topic Drift
> - **Goal:** <1-sentence user intent>
> - **Input:** <key inputs, context, or constraints provided>
> - **Expected Output:** <concrete deliverable shape expected>
> - **Scope:** Small | Medium — Steps | Large — Parallel Split
> - **Gate:** Proceed directly (pause to confirm ONLY if ambiguous, high-impact, or Off-Topic Drift)

2. Drift Guard: If Focus is Off-Topic Drift, emit a `[Drift Alert]` naming the active Topic, park the tangent in `Parked:` for a new chat, and ask whether to stay focused, pivot the anchor, or take a brief detour.
3. Two-Part Structure: For plans and substantial responses, put **Part 1: Executive Summary (High-Level)** (<= 20 lines) before `---` and **Part 2: Detailed Breakdown** after. For Large tasks, suggest a Parallel Split with contracts/tests first (Top-Down Skeleton TDD).
4. End with a compact Post-Run blockquote:
> **[Flow Contract | Post-Run]**
> - **Actual Output:** <concise summary of what was delivered>
> - **Delta:** Matched | Expanded | Pivoted | Partial
> - **Delta Note:** <why output matched, expanded with research findings, pivoted, or stayed partial>
> - **Extras:** <semicolon-separated on-topic bonus discoveries, or "None">
> - **Parked:** <semicolon-separated deferred off-topic items for follow-up, or "None">

Skip contract blocks and two-part headers for simple 1-line questions.
```
