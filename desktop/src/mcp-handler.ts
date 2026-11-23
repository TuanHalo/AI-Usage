import {
  normalizeFocusStatus,
  normalizePlatform,
  normalizeRelation,
  normalizeScopeSize,
} from '../../site/src/lib/conversation-flow/parser';
import {
  completeMcpTurn,
  getMcpFlow,
  startMcpTurn,
} from './mcp-store';

interface JsonRpcRequest {
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: unknown;
}

interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: 'promptflow_start_turn',
    description:
      'Log the start of a non-trivial conversation turn in real time with the verbatim rawUserMessage, user intent, inputSummary, and expectedOutput so the user can watch the live flow.',
    inputSchema: {
      type: 'object',
      properties: {
        rawUserMessage: {
          type: 'string',
          description: 'EXACT verbatim text of the user message (do not shorten or paraphrase).',
        },
        intent: {
          type: 'string',
          description: '1-sentence summary of what the user wants to accomplish.',
        },
        expectedOutput: {
          type: 'string',
          description: 'Concrete deliverable shape expected before running.',
        },
        inputSummary: {
          type: 'string',
          description: 'Key inputs, constraints, files, or context provided by the user.',
        },
        sessionId: {
          type: 'string',
          description: 'Stable conversation slug reused across turns of the same chat thread.',
        },
        sessionTitle: {
          type: 'string',
          description: 'Short human-readable title for the chat session.',
        },
        sessionTopic: {
          type: 'string',
          description: 'Canonical session topic anchor locked on Turn 1.',
        },
        focusStatus: {
          type: 'string',
          enum: ['on-topic', 'adjacent', 'off-topic'],
          description: 'Whether this turn stays on the active session topic or drifts off-topic.',
        },
        scopeSize: {
          type: 'string',
          enum: ['small', 'medium', 'split-steps', 'split-parallel'],
          description: 'Verification budget sizing or parallel split prediction.',
        },
        platform: {
          type: 'string',
          enum: ['claude', 'antigravity', 'gemini', 'grok', 'chatgpt', 'generic'],
        },
        relation: {
          type: 'string',
          enum: ['initial', 'follow-up', 'clarification', 'research-detour', 'pivot', 'refinement'],
        },
      },
      required: ['rawUserMessage', 'intent', 'expectedOutput'],
    },
  },
  {
    name: 'promptflow_complete_turn',
    description:
      'Finalize the active turn after execution with actualOutput, scope delta (matched | expanded | pivoted | partial), deltaNote, and optional extra discoveries or parked follow-up topics.',
    inputSchema: {
      type: 'object',
      properties: {
        actualOutput: {
          type: 'string',
          description: 'Concise summary of what was actually delivered.',
        },
        delta: {
          type: 'string',
          enum: ['matched', 'expanded', 'pivoted', 'partial'],
          description: 'How actual output compared to expected output.',
        },
        deltaNote: {
          type: 'string',
          description: 'Short explanation of match, research expansion, pivot, or gap.',
        },
        extras: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bonus discoveries, edge cases, or artifacts beyond expectedOutput.',
        },
        parkedTopics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Off-topic tangents deferred to follow-up chats.',
        },
        sessionId: {
          type: 'string',
          description: 'Same sessionId used in promptflow_start_turn (optional; defaults to active).',
        },
        turnIndex: {
          type: 'number',
          description: 'Specific 1-based turn index to update (defaults to latest turn).',
        },
        rawAssistantMessage: {
          type: 'string',
          description: 'Optional assistant response summary or excerpt.',
        },
      },
      required: ['actualOutput', 'delta'],
    },
  },
  {
    name: 'promptflow_get_flow',
    description:
      'Read the current ConversationFlow v1 JSON recorded for this session so you or the user can review past turns, raw prompts, and expected vs. actual deltas.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Optional session slug (defaults to most recent active session).',
        },
      },
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const val = record[key];
  return typeof val === 'string' && val.trim().length > 0 ? val : undefined;
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  key: string
): readonly string[] | undefined {
  const val = record[key];
  if (!Array.isArray(val)) return undefined;
  return val.filter((item): item is string => typeof item === 'string');
}

function formatSuccess(id: string | number | null, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function formatError(
  id: string | number | null,
  code: number,
  message: string
): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
}

function executeToolCall(
  name: string,
  argsUnknown: unknown
): { readonly isError?: boolean; readonly payload: Record<string, unknown> } {
  const args = isRecord(argsUnknown) ? argsUnknown : {};

  if (name === 'promptflow_start_turn') {
    const rawUserMessage = typeof args.rawUserMessage === 'string' ? args.rawUserMessage : '';
    const intent = typeof args.intent === 'string' ? args.intent.trim() : '';
    const expectedOutput =
      typeof args.expectedOutput === 'string' ? args.expectedOutput.trim() : '';

    if (!rawUserMessage.trim() || !intent || !expectedOutput) {
      return {
        isError: true,
        payload: {
          error: 'promptflow_start_turn requires rawUserMessage, intent, and expectedOutput.',
        },
      };
    }

    const platformRaw = readOptionalString(args, 'platform');
    const relationRaw = readOptionalString(args, 'relation');
    const focusRaw = readOptionalString(args, 'focusStatus');
    const scopeRaw = readOptionalString(args, 'scopeSize');

    const res = startMcpTurn({
      sessionId: readOptionalString(args, 'sessionId'),
      sessionTitle: readOptionalString(args, 'sessionTitle'),
      sessionTopic: readOptionalString(args, 'sessionTopic'),
      platform: platformRaw ? normalizePlatform(platformRaw) : undefined,
      rawUserMessage,
      intent,
      inputSummary: readOptionalString(args, 'inputSummary'),
      expectedOutput,
      relation: relationRaw ? normalizeRelation(relationRaw, 2) : undefined,
      focusStatus: focusRaw ? normalizeFocusStatus(focusRaw) : undefined,
      scopeSize: scopeRaw ? normalizeScopeSize(scopeRaw) : undefined,
    });

    return {
      payload: {
        ok: true,
        sessionId: res.sessionId,
        turnIndex: res.turnIndex,
        turnCount: res.flow.turns.length,
        liveUrl: 'http://127.0.0.1:4328/AI-Usage/visualizer',
      },
    };
  }

  if (name === 'promptflow_complete_turn') {
    const actualOutput =
      typeof args.actualOutput === 'string' ? args.actualOutput.trim() : '';
    const delta = typeof args.delta === 'string' ? args.delta.trim() : '';

    if (!actualOutput || !delta) {
      return {
        isError: true,
        payload: {
          error: 'promptflow_complete_turn requires actualOutput and delta.',
        },
      };
    }

    const turnIndex =
      typeof args.turnIndex === 'number' && Number.isFinite(args.turnIndex)
        ? args.turnIndex
        : undefined;

    const res = completeMcpTurn({
      sessionId: readOptionalString(args, 'sessionId'),
      turnIndex,
      actualOutput,
      delta,
      deltaNote: readOptionalString(args, 'deltaNote'),
      extras: readOptionalStringArray(args, 'extras'),
      parkedTopics: readOptionalStringArray(args, 'parkedTopics'),
      rawAssistantMessage: readOptionalString(args, 'rawAssistantMessage'),
    });

    return {
      payload: {
        ok: true,
        sessionId: res.sessionId,
        turnIndex: res.turnIndex,
        turnCount: res.flow.turns.length,
        liveUrl: 'http://127.0.0.1:4328/AI-Usage/visualizer',
      },
    };
  }

  if (name === 'promptflow_get_flow') {
    const res = getMcpFlow(readOptionalString(args, 'sessionId'));
    return {
      payload: {
        ok: res.flow !== null,
        sessionId: res.sessionId,
        flow: res.flow,
      },
    };
  }

  return {
    isError: true,
    payload: { error: `Unknown tool: ${name}` },
  };
}

export function handleJsonRpcLine(rawLine: string): string | null {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return formatError(null, -32700, 'Parse error');
  }

  if (!isRecord(parsed) || typeof parsed.method !== 'string') {
    return formatError(null, -32600, 'Invalid Request');
  }

  const req: JsonRpcRequest = {
    id:
      typeof parsed.id === 'string' ||
      typeof parsed.id === 'number' ||
      parsed.id === null
        ? parsed.id
        : undefined,
    method: parsed.method,
    params: parsed.params,
  };

  if (req.id === undefined) {
    return null;
  }

  switch (req.method) {
    case 'initialize':
      return formatSuccess(req.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'promptflow-mcp',
          version: '1.0.0',
        },
      });

    case 'ping':
      return formatSuccess(req.id, {});

    case 'tools/list':
      return formatSuccess(req.id, { tools: MCP_TOOLS });

    case 'tools/call': {
      if (!isRecord(req.params) || typeof req.params.name !== 'string') {
        return formatError(req.id, -32602, 'Missing tool name');
      }
      const outcome = executeToolCall(req.params.name, req.params.arguments);
      return formatSuccess(req.id, {
        isError: Boolean(outcome.isError),
        content: [
          {
            type: 'text',
            text: JSON.stringify(outcome.payload, null, 2),
          },
        ],
        structuredContent: outcome.payload,
      });
    }

    default:
      return formatError(req.id, -32601, `Method not found: ${req.method}`);
  }
}
