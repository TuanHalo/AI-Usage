import { parseStructuredTurns } from '../../../site/src/lib/conversation-flow/parser';
import type {
  ConversationFlow,
  RawMessagePair,
} from '../../../site/src/lib/conversation-flow/types';

export interface ClaudeCodeParseOptions {
  readonly sessionId?: string;
  readonly sourcePath?: string;
}

interface ExtractedClaudeContent {
  readonly text: string;
  readonly toolNames: readonly string[];
  readonly hasToolResultOnly: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractMessageContent(content: unknown): ExtractedClaudeContent {
  if (typeof content === 'string') {
    return {
      text: content.trim(),
      toolNames: [],
      hasToolResultOnly: false,
    };
  }

  if (!Array.isArray(content)) {
    return { text: '', toolNames: [], hasToolResultOnly: false };
  }

  const textParts: string[] = [];
  const toolNames: string[] = [];
  let sawToolResult = false;

  for (const block of content) {
    if (!isRecord(block) || typeof block.type !== 'string') {
      continue;
    }
    if (block.type === 'text' && typeof block.text === 'string') {
      const cleaned = block.text.trim();
      if (cleaned.length > 0) {
        textParts.push(cleaned);
      }
    } else if (block.type === 'tool_use' && typeof block.name === 'string') {
      toolNames.push(block.name.trim());
    } else if (block.type === 'tool_result') {
      sawToolResult = true;
    }
  }

  return {
    text: textParts.join('\n\n').trim(),
    toolNames,
    hasToolResultOnly: sawToolResult && textParts.length === 0,
  };
}

function formatToolSummary(toolNames: readonly string[]): string | undefined {
  if (toolNames.length === 0) {
    return undefined;
  }
  const counts = new Map<string, number>();
  for (const name of toolNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const breakdown = Array.from(counts.entries())
    .slice(0, 5)
    .map(([name, count]) => (count > 1 ? `${name} (${count})` : name))
    .join(', ');
  const label = toolNames.length === 1 ? '1 tool call' : `${toolNames.length} tool calls`;
  return `${label}: ${breakdown}`;
}

export function parseClaudeCodeTranscript(
  jsonlContent: string,
  options?: ClaudeCodeParseOptions
): ConversationFlow {
  interface TurnAccumulator {
    readonly userMessage: string;
    readonly createdAt: string;
    readonly assistantReplies: string[];
    readonly toolNames: string[];
  }

  const accumulators: TurnAccumulator[] = [];
  let current: TurnAccumulator | null = null;
  let lastTimestamp = '';
  let sessionTitle = '';
  let lastEventKind: 'user' | 'assistant-text' | 'assistant-tool' | 'other' = 'other';

  for (const rawLine of jsonlContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (!isRecord(parsed) || typeof parsed.type !== 'string') {
      continue;
    }

    if (typeof parsed.timestamp === 'string') {
      lastTimestamp = parsed.timestamp;
    }

    if (parsed.type === 'summary' && typeof parsed.summary === 'string') {
      const candidateTitle = parsed.summary.trim();
      if (candidateTitle.length > 0) {
        sessionTitle = candidateTitle;
      }
      continue;
    }

    if (parsed.isMeta === true || parsed.isSidechain === true) {
      continue;
    }

    const msg = isRecord(parsed.message) ? parsed.message : null;
    if (!msg) continue;

    const extracted = extractMessageContent(msg.content);

    if (parsed.type === 'user') {
      if (extracted.hasToolResultOnly || !extracted.text) {
        continue;
      }
      current = {
        userMessage: extracted.text,
        createdAt: lastTimestamp,
        assistantReplies: [],
        toolNames: [],
      };
      accumulators.push(current);
      lastEventKind = 'user';
      continue;
    }

    if (parsed.type === 'assistant' && current) {
      for (const name of extracted.toolNames) {
        current.toolNames.push(name);
      }
      if (extracted.text.length > 0) {
        current.assistantReplies.push(extracted.text);
      }
      lastEventKind =
        extracted.toolNames.length > 0 && extracted.text.length === 0
          ? 'assistant-tool'
          : 'assistant-text';
    }
  }

  const lastTurn = accumulators[accumulators.length - 1];
  const isStreaming = Boolean(
    lastTurn &&
      (lastTurn.assistantReplies.length === 0 || lastEventKind === 'assistant-tool')
  );

  const pairs: RawMessagePair[] = accumulators.map((acc) => ({
    userMessage: acc.userMessage,
    assistantMessage: acc.assistantReplies.join('\n\n'),
    toolSummary: formatToolSummary(acc.toolNames),
    createdAt: acc.createdAt,
  }));

  const parsedFlow = parseStructuredTurns(pairs, {
    platformHint: 'claude',
    title:
      sessionTitle ||
      (options?.sessionId ? `Claude • ${options.sessionId.slice(0, 8)}` : undefined),
    sourceUrl: options?.sourcePath,
    isStreaming,
    parseModeOverride: 'live-transcript',
  });

  return {
    ...parsedFlow.flow,
    title: sessionTitle || parsedFlow.flow.turns[0]?.title || parsedFlow.flow.title,
    createdAt: lastTimestamp || parsedFlow.flow.createdAt,
  };
}
