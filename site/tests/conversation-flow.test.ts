import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { handleJsonRpcLine } from '../../desktop/src/mcp-handler';
import {
  extractUserRequestText,
  parseAntigravityTranscript,
} from '../../desktop/src/parsers/antigravity-jsonl';
import { parseClaudeCodeTranscript } from '../../desktop/src/parsers/claude-code-jsonl';
import {
  buildAnalyzerPrompt,
  getAdaptiveRuleSnippet,
  getClaudeDesktopInstructionSnippet,
} from '../src/lib/conversation-flow/analyzer-prompt';
import {
  decodeFlowFromHash,
  encodeFlowToHash,
} from '../src/lib/conversation-flow/codec';
import {
  exportFlowAsMarkdown,
  exportFlowAsStandaloneHtml,
  formatFocusLabel,
  formatScopeLabel,
} from '../src/lib/conversation-flow/exporter';
import {
  buildParkedFollowUpPrompt,
  collectParkedTopics,
  extractFlowContract,
  normalizeFocusStatus,
  normalizeScopeSize,
  parseConversation,
  parseStructuredTurns,
} from '../src/lib/conversation-flow/parser';
import { SAMPLE_PRESETS } from '../src/lib/conversation-flow/samples';

test('extractFlowContract parses Pre-Run and Post-Run blocks cleanly', () => {
  const reply = [
    '> **[Flow Contract | Pre-Run]**',
    '> - **Goal:** Evaluate database connection pooling options.',
    '> - **Input:** Stack: Node.js + Postgres; 500 concurrent connections.',
    '> - **Expected Output:** Comparison of PgBouncer vs Prisma Accelerate.',
    '> - **Gate:** Proceed directly',
    '',
    'Here is the breakdown...',
    '',
    '> **[Flow Contract | Post-Run]**',
    '> - **Actual Output:** Delivered comparison plus serverless cold-start sizing formula.',
    '> - **Delta:** Expanded',
    '> - **Delta Note:** Added serverless connection math.',
    '> - **Extras:** Transaction mode prepared statement warning; Exact pool_size formula',
  ].join('\n');

  const { preRun, postRun } = extractFlowContract(reply);
  assert.ok(preRun);
  assert.equal(preRun.goal, 'Evaluate database connection pooling options.');
  assert.equal(
    preRun.expectedOutput,
    'Comparison of PgBouncer vs Prisma Accelerate.'
  );
  assert.ok(postRun);
  assert.equal(postRun.delta, 'expanded');
  assert.equal(postRun.extras.length, 2);
  assert.equal(
    postRun.extras[0],
    'Transaction mode prepared statement warning'
  );
});

test('parseStructuredTurns handles Flow Contract turns and active tool summary while streaming', () => {
  const result = parseStructuredTurns(
    [
      {
        userMessage: 'Design a webhook retry queue.',
        assistantMessage: [
          '> **[Flow Contract | Pre-Run]**',
          '> - **Goal:** Design reliable webhook retries.',
          '> - **Input:** Target: HTTP webhooks; SLA: 24h retries.',
          '> - **Expected Output:** Backoff schedule and DLQ schema.',
          '> - **Gate:** Proceed directly',
          '',
          'Exponential backoff with jitter.',
          '',
          '> **[Flow Contract | Post-Run]**',
          '> - **Actual Output:** Delivered retry schedule, DLQ table, and idempotency key header guide.',
          '> - **Delta:** Expanded',
          '> - **Delta Note:** Research highlighted idempotency deduplication.',
          '> - **Extras:** Added HMAC replay timestamp tolerance window',
        ].join('\n'),
      },
      {
        userMessage: 'Wait, switch from SQS to PostgreSQL SKIP LOCKED.',
        assistantMessage: '',
        toolSummary: '2 tool calls: read_file (2)',
      },
    ],
    {
      platformHint: 'antigravity',
      isStreaming: true,
      parseModeOverride: 'live-transcript',
    }
  );

  assert.equal(result.flow.turns.length, 2);
  assert.equal(result.flow.isStreaming, true);
  assert.equal(result.flow.parseMode, 'live-transcript');
  assert.equal(result.flow.turns[0]?.delta, 'expanded');
  assert.equal(result.flow.turns[0]?.extras.length, 1);
  assert.equal(result.flow.turns[1]?.isStreaming, true);
  assert.equal(result.flow.turns[1]?.delta, 'pending');
  assert.equal(result.flow.turns[1]?.relation, 'pivot');
  assert.equal(result.flow.turns[1]?.toolSummary, '2 tool calls: read_file (2)');
  assert.ok(result.flow.turns[1]?.actualOutput.includes('Working live'));
});

test('parseConversation parses raw chats and ignores speaker strings inside code blocks', () => {
  const rawChat = [
    'You said:',
    'Show me an example log parser.',
    '',
    'Claude said:',
    'Copy',
    'Here is a snippet containing fake speaker labels inside a code fence:',
    '```text',
    'User: inside code block must not split',
    'Claude said: still inside code block',
    '```',
    '',
    'You said:',
    'Now explain why that regex is safe.',
    '',
    'Claude said:',
    'It tracks fenced code blocks line by line.',
  ].join('\n');

  const result = parseConversation(rawChat);
  assert.equal(result.flow.platform, 'claude');
  assert.equal(result.flow.turns.length, 2);
  assert.equal(
    result.flow.turns[0]?.rawUserMessage,
    'Show me an example log parser.'
  );
  assert.ok(
    result.flow.turns[0]?.rawAssistantMessage.includes(
      'User: inside code block must not split'
    )
  );
});

test('parseConversation parses built-in Adaptive Contract and Raw Grok presets cleanly', () => {
  const contractDemo = SAMPLE_PRESETS[0];
  const rawDemo = SAMPLE_PRESETS[1];
  assert.ok(contractDemo && rawDemo);

  const contractResult = parseConversation(
    contractDemo.rawText,
    contractDemo.platform
  );
  assert.equal(contractResult.flow.parseMode, 'flow-contract');
  assert.equal(contractResult.flow.turns.length, 4);
  assert.equal(contractResult.flow.turns[0]?.delta, 'matched');
  assert.equal(contractResult.flow.turns[1]?.delta, 'expanded');
  assert.equal(contractResult.flow.turns[1]?.extras.length, 2);
  assert.equal(contractResult.flow.turns[2]?.delta, 'pivoted');

  const rawResult = parseConversation(rawDemo.rawText);
  assert.equal(rawResult.flow.platform, 'grok');
  assert.equal(rawResult.flow.turns.length, 3);
});

test('parseConversation accepts fenced JSON and rejects invalid JSON gracefully', () => {
  const fencedJson = [
    '```json',
    JSON.stringify({
      schemaVersion: '1.0',
      title: 'Analyzer Output Test',
      platform: 'gemini',
      overallGoal: 'Verify structured JSON import.',
      finalOutcome: 'Imported cleanly.',
      turns: [
        {
          index: 1,
          title: 'Initial Prompt',
          relation: 'initial',
          rawUserMessage: 'Exact raw text <script>alert(1)</script>',
          intent: 'Check round trip.',
          inputSummary: 'Raw string',
          expectedOutput: 'Short test result',
          actualOutput: 'Passed with bonus coverage',
          delta: 'expanded',
          deltaNote: 'Added XSS edge check',
          extras: ['Verified HTML escaping'],
        },
      ],
    }),
    '```',
  ].join('\n');

  const parsed = parseConversation(fencedJson);
  assert.equal(parsed.flow.parseMode, 'structured-json');
  assert.equal(parsed.flow.platform, 'gemini');
  assert.equal(parsed.flow.turns[0]?.delta, 'expanded');

  const malformed = parseConversation('{ not valid json');
  assert.equal(malformed.flow.turns.length, 1);
  assert.ok(malformed.warnings.some((w) => w.includes('JSON')));
});

test('codec encodeFlowToHash and decodeFlowFromHash preserve ConversationFlow', async () => {
  const demo = SAMPLE_PRESETS[0];
  assert.ok(demo);
  const parsed = parseConversation(demo.rawText, demo.platform);

  const hash = await encodeFlowToHash(parsed.flow);
  assert.ok(hash.startsWith('#flow='));

  const decoded = await decodeFlowFromHash(hash);
  assert.ok(decoded);
  assert.equal(decoded.turns.length, parsed.flow.turns.length);
  assert.deepEqual(decoded.turns[1]?.extras, parsed.flow.turns[1]?.extras);
});

test('analyzer prompt, snippets, and XSS-safe standalone HTML export work cleanly', () => {
  const prompt = buildAnalyzerPrompt('User: Explain TLS 1.3\nAssistant: Done', 'claude');
  assert.ok(prompt.includes('rawUserMessage'));
  assert.ok(getAdaptiveRuleSnippet().includes('[Flow Contract | Pre-Run]'));
  assert.ok(getClaudeDesktopInstructionSnippet().includes('promptflow_start_turn'));

  const malicious = parseConversation(
    'User:\nTest <script>alert("xss")</script>\n\nAssistant:\nReply <img src=x onerror=alert(1)>'
  );
  const html = exportFlowAsStandaloneHtml(malicious.flow);
  assert.ok(!html.includes('<script>alert("xss")</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));

  const md = exportFlowAsMarkdown(malicious.flow);
  assert.ok(md.includes('Test <script>alert("xss")</script>'));
});

test('parseAntigravityTranscript extracts verbatim requests, full restoration, tools, and live status', () => {
  const compactJsonl = [
    JSON.stringify({
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: '2026-11-22T11:00:00Z',
      content:
        '<USER_REQUEST>\nCompare JWT vs opaque sessions.\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nIgnore this\n</ADDITIONAL_METADATA>',
      truncated_fields: ['content'],
    }),
    JSON.stringify({
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      tool_calls: [{ name: 'read_file' }, { name: 'read_file' }],
    }),
    JSON.stringify({
      step_index: 2,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      content: [
        '> **[Flow Contract | Pre-Run]**',
        '> - **Goal:** Compare JWT vs opaque server sessions.',
        '> - **Input:** Security context only.',
        '> - **Expected Output:** Pros/cons comparison.',
        '> - **Gate:** Proceed directly',
        '',
        'Opaque sessions enable instant revocation.',
        '',
        '> **[Flow Contract | Post-Run]**',
        '> - **Actual Output:** Delivered comparison + Redis session store sizing notes.',
        '> - **Delta:** Expanded',
        '> - **Delta Note:** Added Redis revocation architecture notes.',
        '> - **Extras:** Refresh token rotation guidance',
      ].join('\n'),
    }),
    JSON.stringify({
      step_index: 3,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: '2026-11-22T11:02:00Z',
      content: '<USER_REQUEST>\nShow TypeScript middleware example.\n</USER_REQUEST>',
    }),
    JSON.stringify({
      step_index: 4,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'RUNNING',
      tool_calls: [{ name: 'run_command' }],
    }),
  ].join('\n');

  const fullJsonl = JSON.stringify({
    step_index: 0,
    source: 'USER_EXPLICIT',
    type: 'USER_INPUT',
    status: 'DONE',
    content:
      '<USER_REQUEST>\nCompare JWT vs opaque sessions in full untruncated detail.\n</USER_REQUEST>',
  });

  assert.equal(
    extractUserRequestText('<USER_REQUEST>\nHello\n</USER_REQUEST><ADDITIONAL_METADATA>x</ADDITIONAL_METADATA>'),
    'Hello'
  );

  const flow = parseAntigravityTranscript(compactJsonl, {
    fullJsonlContent: fullJsonl,
    sessionId: 'abc12345',
  });

  assert.equal(flow.platform, 'antigravity');
  assert.equal(flow.parseMode, 'live-transcript');
  assert.equal(flow.isStreaming, true);
  assert.equal(flow.turns.length, 2);
  assert.equal(
    flow.turns[0]?.rawUserMessage,
    'Compare JWT vs opaque sessions in full untruncated detail.'
  );
  assert.equal(flow.turns[0]?.delta, 'expanded');
  assert.equal(flow.turns[0]?.toolSummary, '2 tool calls: read_file (2)');
  assert.equal(flow.turns[1]?.isStreaming, true);
  assert.equal(flow.turns[1]?.toolSummary, '1 tool call: run_command');
});

test('parseClaudeCodeTranscript parses Claude Code JSONL and skips tool_result-only user rows', () => {
  const jsonl = [
    JSON.stringify({ type: 'summary', summary: 'Fix Redis Retry Loop' }),
    JSON.stringify({
      type: 'user',
      timestamp: '2026-11-22T12:00:00Z',
      message: { role: 'user', content: 'Why does the Redis retry loop spin?' },
    }),
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-11-22T12:00:05Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Read' }],
      },
    }),
    JSON.stringify({
      type: 'user',
      timestamp: '2026-11-22T12:00:06Z',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', content: 'file contents' }],
      },
    }),
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-11-22T12:00:10Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'The retry counter was never incremented inside the catch block.',
          },
        ],
      },
    }),
  ].join('\n');

  const flow = parseClaudeCodeTranscript(jsonl, { sessionId: 'sess-1' });
  assert.equal(flow.platform, 'claude');
  assert.equal(flow.title, 'Fix Redis Retry Loop');
  assert.equal(flow.turns.length, 1);
  assert.equal(flow.isStreaming, false);
  assert.equal(
    flow.turns[0]?.rawUserMessage,
    'Why does the Redis retry loop spin?'
  );
  assert.equal(flow.turns[0]?.toolSummary, '1 tool call: Read');
});

test('MCP JSON-RPC handler logs start_turn, complete_turn, and get_flow atomically', () => {
  const tempSessionsDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'promptflow-mcp-test-')
  );
  const prevEnv = process.env.PROMPTFLOW_SESSIONS_DIR;
  process.env.PROMPTFLOW_SESSIONS_DIR = tempSessionsDir;

  try {
    const initResp = JSON.parse(
      handleJsonRpcLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })) ?? '{}'
    ) as { result?: { serverInfo?: { name?: string } } };
    assert.equal(initResp.result?.serverInfo?.name, 'promptflow-mcp');

    const toolsResp = JSON.parse(
      handleJsonRpcLine(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) ?? '{}'
    ) as { result?: { tools?: Array<{ name: string }> } };
    assert.equal(toolsResp.result?.tools?.length, 3);

    handleJsonRpcLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'promptflow_start_turn',
          arguments: {
            sessionId: 'claude-desktop-test',
            sessionTitle: 'Claude Desktop Research',
            rawUserMessage: 'Compare SQLite WAL mode vs Postgres for local desktop apps.',
            intent: 'Select embedded storage engine for desktop app.',
            inputSummary: 'Desktop single-user workload',
            expectedOutput: 'Short comparison table.',
          },
        },
      })
    );

    handleJsonRpcLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'promptflow_complete_turn',
          arguments: {
            sessionId: 'claude-desktop-test',
            actualOutput: 'Delivered comparison table plus PRAGMA tuning values.',
            delta: 'expanded',
            deltaNote: 'Included production PRAGMA synchronous=NORMAL recommendations.',
            extras: ['Added SQLite busy_timeout=5000 setting'],
          },
        },
      })
    );

    const getResp = JSON.parse(
      handleJsonRpcLine(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'promptflow_get_flow',
            arguments: { sessionId: 'claude-desktop-test' },
          },
        })
      ) ?? '{}'
    ) as {
      result?: {
        structuredContent?: {
          flow?: {
            parseMode: string;
            isStreaming: boolean;
            turns: Array<{ rawUserMessage: string; delta: string; extras: string[] }>;
          };
        };
      };
    };

    const flow = getResp.result?.structuredContent?.flow;
    assert.ok(flow);
    assert.equal(flow.parseMode, 'mcp-live');
    assert.equal(flow.isStreaming, false);
    assert.equal(flow.turns.length, 1);
    assert.equal(
      flow.turns[0]?.rawUserMessage,
      'Compare SQLite WAL mode vs Postgres for local desktop apps.'
    );
    assert.equal(flow.turns[0]?.delta, 'expanded');
    assert.deepEqual(flow.turns[0]?.extras, ['Added SQLite busy_timeout=5000 setting']);
  } finally {
    if (prevEnv === undefined) {
      delete process.env.PROMPTFLOW_SESSIONS_DIR;
    } else {
      process.env.PROMPTFLOW_SESSIONS_DIR = prevEnv;
    }
    fs.rmSync(tempSessionsDir, { recursive: true, force: true });
  }
});

test('normalizeFocusStatus and normalizeScopeSize handle canonical and shorthand inputs cleanly', () => {
  assert.equal(normalizeFocusStatus('On-Topic'), 'on-topic');
  assert.equal(normalizeFocusStatus('Adjacent'), 'adjacent');
  assert.equal(normalizeFocusStatus('Off-Topic Drift'), 'off-topic');
  assert.equal(normalizeFocusStatus('drift'), 'off-topic');
  assert.equal(normalizeFocusStatus(''), undefined);
  assert.equal(normalizeFocusStatus('unknown'), undefined);

  assert.equal(normalizeScopeSize('Small'), 'small');
  assert.equal(normalizeScopeSize('Medium'), 'medium');
  assert.equal(normalizeScopeSize('Medium — Steps'), 'split-steps');
  assert.equal(normalizeScopeSize('Large — Parallel Split'), 'split-parallel');
  assert.equal(normalizeScopeSize('parallel'), 'split-parallel');
  assert.equal(normalizeScopeSize(''), undefined);
});

test('extractFlowContract parses v2 Pre-Run Topic/Focus/Scope and Post-Run Parked topics', () => {
  const reply = [
    '> **[Flow Contract | Pre-Run]**',
    '> - **Topic:** Auth Token Rotation',
    '> - **Focus:** Off-Topic Drift',
    '> - **Goal:** Tune Redis eviction policies.',
    '> - **Input:** Production Redis cluster config.',
    '> - **Expected Output:** Recommended maxmemory-policy.',
    '> - **Scope:** Large — Parallel Split',
    '> - **Gate:** Paused — confirm before proceeding',
    '',
    'Parked the Redis question.',
    '',
    '> **[Flow Contract | Post-Run]**',
    '> - **Actual Output:** Logged Redis tangent to parking lot.',
    '> - **Delta:** Partial',
    '> - **Delta Note:** Request drifted from Auth Token Rotation.',
    '> - **Extras:** None',
    '> - **Parked:** Tune Redis eviction policy; Benchmark Postgres JSONB',
    '> Add rate-limit tests',
  ].join('\n');

  const { preRun, postRun } = extractFlowContract(reply);
  assert.ok(preRun);
  assert.equal(preRun.topic, 'Auth Token Rotation');
  assert.equal(preRun.focusStatus, 'off-topic');
  assert.equal(preRun.scopeSize, 'split-parallel');
  assert.ok(postRun);
  assert.deepEqual(postRun.parkedTopics, [
    'Tune Redis eviction policy',
    'Benchmark Postgres JSONB',
    'Add rate-limit tests',
  ]);

  const noParked = extractFlowContract([
    '> **[Flow Contract | Post-Run]**',
    '> - **Actual Output:** Done.',
    '> - **Delta:** Matched',
    '> - **Parked:** None',
  ].join('\n'));
  assert.deepEqual(noParked.postRun?.parkedTopics, []);
});

test('parseStructuredTurns and collectParkedTopics aggregate deduplicated parked topics and build follow-up prompt', () => {
  const result = parseStructuredTurns([
    {
      userMessage: 'Refactor auth middleware.',
      assistantMessage: [
        '> **[Flow Contract | Pre-Run]**',
        '> - **Topic:** Auth Refactor',
        '> - **Focus:** On-Topic',
        '> - **Goal:** Refactor auth middleware cleanly.',
        '> - **Input:** Express routes.',
        '> - **Expected Output:** Updated middleware module.',
        '> - **Scope:** Medium — Steps',
        '> - **Gate:** Proceed directly',
        '',
        'Done.',
        '',
        '> **[Flow Contract | Post-Run]**',
        '> - **Actual Output:** Middleware refactored.',
        '> - **Delta:** Matched',
        '> - **Delta Note:** On target.',
        '> - **Parked:** Rate limit middleware; Redis TTL',
      ].join('\n'),
    },
    {
      userMessage: 'Wait, check billing webhook retry too.',
      assistantMessage: [
        '> **[Flow Contract | Pre-Run]**',
        '> - **Topic:** Auth Refactor',
        '> - **Focus:** Off-Topic Drift',
        '> - **Goal:** Inspect billing webhook retries.',
        '> - **Input:** Webhook queue.',
        '> - **Expected Output:** Brief check or park.',
        '> - **Scope:** Small',
        '> - **Gate:** Paused — confirm before proceeding',
        '',
        'Parked for follow-up.',
        '',
        '> **[Flow Contract | Post-Run]**',
        '> - **Actual Output:** Parked billing retry question.',
        '> - **Delta:** Partial',
        '> - **Delta Note:** Kept thread focused on Auth Refactor.',
        '> - **Parked:** rate limit middleware; Billing webhook retry',
      ].join('\n'),
    },
  ]);

  assert.equal(result.flow.sessionTopic, 'Auth Refactor');
  assert.equal(result.flow.turns[0]?.focusStatus, 'on-topic');
  assert.equal(result.flow.turns[0]?.scopeSize, 'split-steps');
  assert.equal(result.flow.turns[1]?.focusStatus, 'off-topic');
  assert.equal(result.flow.turns[1]?.scopeSize, 'small');
  assert.deepEqual(collectParkedTopics(result.flow.turns), [
    'Rate limit middleware',
    'Redis TTL',
    'Billing webhook retry',
  ]);
  assert.deepEqual(result.flow.parkedTopics, [
    'Rate limit middleware',
    'Redis TTL',
    'Billing webhook retry',
  ]);

  const followUp = buildParkedFollowUpPrompt('Billing webhook retry', 'Auth Refactor');
  assert.ok(followUp.includes('Billing webhook retry'));
  assert.ok(followUp.includes('Auth Refactor'));
});

test('MCP handler logs v2 sessionTopic, focusStatus, scopeSize, and parkedTopics', () => {
  const tempSessionsDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'promptflow-mcp-v2-test-')
  );
  const prevEnv = process.env.PROMPTFLOW_SESSIONS_DIR;
  process.env.PROMPTFLOW_SESSIONS_DIR = tempSessionsDir;

  try {
    const toolsResp = JSON.parse(
      handleJsonRpcLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) ?? '{}'
    ) as { result?: { tools?: Array<{ name: string }> } };
    assert.equal(toolsResp.result?.tools?.length, 3);

    handleJsonRpcLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'promptflow_start_turn',
          arguments: {
            sessionId: 'mcp-v2-test',
            sessionTitle: 'Payment Gateway TDD',
            sessionTopic: 'Payment Gateway TDD',
            focusStatus: 'off-topic',
            scopeSize: 'split-parallel',
            rawUserMessage: 'Also export invoice PDFs while refactoring payments.',
            intent: 'Add invoice PDF export.',
            expectedOutput: 'PDF renderer or parked item.',
          },
        },
      })
    );

    handleJsonRpcLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'promptflow_complete_turn',
          arguments: {
            sessionId: 'mcp-v2-test',
            actualOutput: 'Warned about off-topic drift and parked PDF export.',
            delta: 'partial',
            deltaNote: 'Kept payment gateway chat focused.',
            parkedTopics: ['Invoice PDF export', 'None', 'Tax rounding check'],
          },
        },
      })
    );

    const getResp = JSON.parse(
      handleJsonRpcLine(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'promptflow_get_flow',
            arguments: { sessionId: 'mcp-v2-test' },
          },
        })
      ) ?? '{}'
    ) as {
      result?: {
        structuredContent?: {
          flow?: {
            sessionTopic?: string;
            parkedTopics?: string[];
            turns: Array<{
              focusStatus?: string;
              scopeSize?: string;
              parkedTopics?: string[];
            }>;
          };
        };
      };
    };

    const flow = getResp.result?.structuredContent?.flow;
    assert.ok(flow);
    assert.equal(flow.sessionTopic, 'Payment Gateway TDD');
    assert.deepEqual(flow.parkedTopics, ['Invoice PDF export', 'Tax rounding check']);
    assert.equal(flow.turns[0]?.focusStatus, 'off-topic');
    assert.equal(flow.turns[0]?.scopeSize, 'split-parallel');
    assert.deepEqual(flow.turns[0]?.parkedTopics, ['Invoice PDF export', 'Tax rounding check']);
  } finally {
    if (prevEnv === undefined) {
      delete process.env.PROMPTFLOW_SESSIONS_DIR;
    } else {
      process.env.PROMPTFLOW_SESSIONS_DIR = prevEnv;
    }
    fs.rmSync(tempSessionsDir, { recursive: true, force: true });
  }
});

test('v2 snippets and XSS-safe Markdown/HTML exports include Focus, Scope, and Parking Lot', () => {
  const rule = getAdaptiveRuleSnippet();
  assert.ok(rule.includes('Topic:'));
  assert.ok(rule.includes('Focus:'));
  assert.ok(rule.includes('Scope:'));
  assert.ok(rule.includes('[Drift Alert]'));
  assert.ok(rule.includes('Parked:'));
  assert.ok(rule.includes('Executive Summary'));
  assert.ok(rule.includes('Detailed Breakdown'));

  const claudeInst = getClaudeDesktopInstructionSnippet();
  assert.ok(claudeInst.includes('focusStatus'));
  assert.ok(claudeInst.includes('scopeSize'));
  assert.ok(claudeInst.includes('parkedTopics'));

  assert.equal(formatFocusLabel('off-topic'), 'Off-Topic Drift');
  assert.equal(formatScopeLabel('split-parallel'), 'Large — Parallel Split');

  const parsed = parseStructuredTurns([
    {
      userMessage: 'Also wire a <script>alert(1)</script> webhook.',
      assistantMessage: [
        '> **[Flow Contract | Pre-Run]**',
        '> - **Topic:** Core API',
        '> - **Focus:** Off-Topic Drift',
        '> - **Goal:** Wire webhook.',
        '> - **Input:** Core API repo.',
        '> - **Expected Output:** Parked webhook.',
        '> - **Scope:** Large — Parallel Split',
        '> - **Gate:** Paused — confirm before proceeding',
        '',
        'Parked webhook.',
        '',
        '> **[Flow Contract | Post-Run]**',
        '> - **Actual Output:** Parked off-topic webhook request.',
        '> - **Delta:** Partial',
        '> - **Delta Note:** Drift prevented.',
        '> - **Parked:** Add <script>alert(1)</script> webhook',
      ].join('\n'),
    },
  ]);

  const md = exportFlowAsMarkdown(parsed.flow);
  assert.ok(md.includes('Core API'));
  assert.ok(md.includes('Off-Topic Drift'));
  assert.ok(md.includes('Large — Parallel Split'));
  assert.ok(md.includes('Parked Topics'));
  assert.ok(md.includes('Add <script>alert(1)</script> webhook'));

  const html = exportFlowAsStandaloneHtml(parsed.flow);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Off-Topic Drift'));
  assert.ok(html.includes('Session Parking Lot'));
});
