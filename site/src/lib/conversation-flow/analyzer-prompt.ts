import type { AIPlatform } from './types';

export function getAdaptiveRuleSnippet(): string {
  return [
    'For non-trivial requests, follow the Adaptive Flow Contract:',
    '',
    '1. Begin with a compact Pre-Run blockquote:',
    '> **[Flow Contract | Pre-Run]**',
    '> - **Goal:** <1-sentence user intent>',
    '> - **Input:** <key context, files, snippets, or constraints provided>',
    '> - **Expected Output:** <concrete deliverable shape expected>',
    '> - **Gate:** Proceed directly (pause and ask to confirm ONLY if requirements are ambiguous or high-impact)',
    '',
    '2. End with a compact Post-Run blockquote:',
    '> **[Flow Contract | Post-Run]**',
    '> - **Actual Output:** <concise summary of what was delivered>',
    '> - **Delta:** Matched | Expanded | Pivoted | Partial',
    '> - **Delta Note:** <brief explanation of match, expansion, pivot, or gap>',
    '> - **Extras:** <optional semicolon-separated bonus discoveries beyond Expected Output, or "None">',
    '',
    'Note: During research or investigation, "Expanded" is normal and encouraged whenever valuable extra insights or edge cases emerge. Omit both blocks for quick 1-line questions.',
  ].join('\n');
}

export function getClaudeDesktopInstructionSnippet(): string {
  return [
    'Use the PromptFlow MCP tools (`promptflow_start_turn` and `promptflow_complete_turn`) to log non-trivial turns in real time:',
    '1. Before starting a non-trivial response, call `promptflow_start_turn` with:',
    '   - `rawUserMessage`: the exact verbatim user prompt',
    '   - `intent`: 1-sentence summary of what the user wants',
    '   - `inputSummary`: key context, constraints, or inputs provided',
    '   - `expectedOutput`: the concrete deliverable shape expected',
    '2. When finishing your response, call `promptflow_complete_turn` with:',
    '   - `actualOutput`: concise summary of what you delivered',
    '   - `delta`: "matched" | "expanded" | "pivoted" | "partial"',
    '   - `deltaNote`: short explanation of any scope shift or why extra findings emerged',
    '   - `extras`: array of bonus discoveries beyond `expectedOutput` (if any)',
    '3. Keep calling `promptflow_start_turn` / `promptflow_complete_turn` silently without cluttering chat prose, and skip trivial 1-line greetings.',
  ].join('\n');
}

export function buildAnalyzerPrompt(
  rawConversation: string,
  platformHint?: AIPlatform
): string {
  const platformLabel = platformHint ?? 'generic';
  const trimmedConversation = rawConversation.trim();

  return [
    'Analyze the AI conversation below and convert it into ONE valid JSON object matching the ConversationFlow v1 schema.',
    '',
    'Strict Requirements:',
    '1. Preserve every user prompt VERBATIM inside `rawUserMessage` (do not paraphrase, shorten, or strip code).',
    '2. For each turn, extract `intent` (what the user wanted), `inputSummary` (inputs/constraints given), `expectedOutput` (what deliverable shape was expected), and `actualOutput` (what the AI actually produced).',
    '3. Classify `delta` for each turn using exactly one of:',
    '   - "matched": delivered essentially what was expected',
    '   - "expanded": delivered what was expected PLUS extra research findings, edge cases, or bonus deliverables',
    '   - "pivoted": shifted direction or goal due to new constraints or discoveries',
    '   - "partial": incomplete, blocked, or only partially answered',
    '   - "pending": unanswered or still in progress',
    '4. Whenever `delta` is "expanded" (or bonus discoveries appeared), list each extra finding as a short string inside `extras`.',
    '5. Classify each turn\'s `relation` to the conversation flow as one of: "initial", "follow-up", "clarification", "research-detour", "pivot", "refinement".',
    '6. Output ONLY valid JSON inside a ```json code block with no commentary outside it.',
    '',
    'Target JSON Shape:',
    '```json',
    '{',
    '  "schemaVersion": "1.0",',
    '  "title": "Concise conversation title",',
    `  "platform": "${platformLabel}",`,
    '  "overallGoal": "1-2 sentences describing the overarching user objective",',
    '  "finalOutcome": "1-2 sentences summarizing the final delivered outcome",',
    '  "turns": [',
    '    {',
    '      "index": 1,',
    '      "title": "Short 3-7 word step label",',
    '      "relation": "initial",',
    '      "rawUserMessage": "Exact verbatim user prompt",',
    '      "intent": "Concise user goal for this turn",',
    '      "inputSummary": "Inputs and constraints provided",',
    '      "expectedOutput": "Concrete expected deliverable",',
    '      "actualOutput": "Concrete actual deliverable",',
    '      "delta": "matched",',
    '      "deltaNote": "Why output matched, expanded, pivoted, or stayed partial",',
    '      "extras": []',
    '    }',
    '  ]',
    '}',
    '```',
    '',
    'Conversation Transcript:',
    '<<<CONVERSATION>>>',
    trimmedConversation,
    '<<<END_CONVERSATION>>>',
  ].join('\n');
}
