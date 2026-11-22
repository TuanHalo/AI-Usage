import { parseStructuredTurns } from '../../../site/src/lib/conversation-flow/parser';
import type {
  ConversationFlow,
  RawMessagePair,
} from '../../../site/src/lib/conversation-flow/types';

export interface AntigravityParseOptions {
  readonly fullJsonlContent?: string;
  readonly sessionId?: string;
  readonly sourcePath?: string;
}

interface ParsedToolCall {
  readonly name: string;
}

interface ParsedAntigravityStep {
  readonly stepIndex: number;
  readonly source: string;
  readonly type: string;
  readonly status: string;
  readonly createdAt: string;
  readonly content: string;
  readonly truncatedContent: boolean;
  readonly toolCalls: readonly ParsedToolCall[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStepLine(rawLine: string): ParsedAntigravityStep | null {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const stepIndex =
    typeof parsed.step_index === 'number' && Number.isFinite(parsed.step_index)
      ? parsed.step_index
      : -1;
  const source = typeof parsed.source === 'string' ? parsed.source : '';
  const type = typeof parsed.type === 'string' ? parsed.type : '';
  const status = typeof parsed.status === 'string' ? parsed.status : '';
  const createdAt = typeof parsed.created_at === 'string' ? parsed.created_at : '';
  const content = typeof parsed.content === 'string' ? parsed.content : '';

  const truncatedFields = Array.isArray(parsed.truncated_fields)
    ? parsed.truncated_fields.filter((f): f is string => typeof f === 'string')
    : [];

  const toolCalls: ParsedToolCall[] = [];
  if (Array.isArray(parsed.tool_calls)) {
    for (const tc of parsed.tool_calls) {
      if (isRecord(tc) && typeof tc.name === 'string' && tc.name.trim().length > 0) {
        toolCalls.push({ name: tc.name.trim() });
      }
    }
  }

  return {
    stepIndex,
    source,
    type,
    status,
    createdAt,
    content,
    truncatedContent: truncatedFields.includes('content'),
    toolCalls,
  };
}

export function extractUserRequestText(rawContent: string): string {
  const tagMatch = rawContent.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i);
  if (tagMatch && typeof tagMatch[1] === 'string') {
    return tagMatch[1].trim();
  }

  return rawContent
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .trim();
}

function buildFullContentMap(
  fullJsonlContent: string | undefined
): ReadonlyMap<number, string> {
  const map = new Map<number, string>();
  if (!fullJsonlContent) {
    return map;
  }
  const lines = fullJsonlContent.split(/\r?\n/);
  for (const line of lines) {
    const step = parseStepLine(line);
    if (step && step.stepIndex >= 0 && step.content.length > 0) {
      map.set(step.stepIndex, step.content);
    }
  }
  return map;
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

export function parseAntigravityTranscript(
  jsonlContent: string,
  options?: AntigravityParseOptions
): ConversationFlow {
  const steps: ParsedAntigravityStep[] = [];
  for (const line of jsonlContent.split(/\r?\n/)) {
    const step = parseStepLine(line);
    if (step) {
      steps.push(step);
    }
  }

  const hasTruncated = steps.some((s) => s.truncatedContent);
  const fullMap = hasTruncated
    ? buildFullContentMap(options?.fullJsonlContent)
    : new Map<number, string>();

  const resolveContent = (step: ParsedAntigravityStep): string => {
    if (step.truncatedContent && step.stepIndex >= 0) {
      const full = fullMap.get(step.stepIndex);
      if (typeof full === 'string' && full.length > 0) {
        return full;
      }
    }
    return step.content;
  };

  interface TurnAccumulator {
    readonly userMessage: string;
    readonly createdAt: string;
    readonly assistantReplies: string[];
    readonly toolNames: string[];
  }

  const accumulators: TurnAccumulator[] = [];
  let current: TurnAccumulator | null = null;

  for (const step of steps) {
    if (step.type === 'USER_INPUT' && step.source === 'USER_EXPLICIT') {
      const rawContent = resolveContent(step);
      const userMessage = extractUserRequestText(rawContent);
      current = {
        userMessage: userMessage || '(Empty prompt)',
        createdAt: step.createdAt,
        assistantReplies: [],
        toolNames: [],
      };
      accumulators.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (step.type === 'PLANNER_RESPONSE') {
      for (const tc of step.toolCalls) {
        current.toolNames.push(tc.name);
      }
      const replyContent = resolveContent(step).trim();
      if (replyContent.length > 0) {
        current.assistantReplies.push(replyContent);
      }
    }
  }

  const lastStep = steps[steps.length - 1];
  const lastTurn = accumulators[accumulators.length - 1];
  const isStreaming = Boolean(
    lastTurn &&
      (lastTurn.assistantReplies.length === 0 ||
        (lastStep && lastStep.status !== 'DONE'))
  );

  const pairs: RawMessagePair[] = accumulators.map((acc) => ({
    userMessage: acc.userMessage,
    assistantMessage: acc.assistantReplies.join('\n\n'),
    toolSummary: formatToolSummary(acc.toolNames),
    createdAt: acc.createdAt,
  }));

  const parsed = parseStructuredTurns(pairs, {
    platformHint: 'antigravity',
    title: options?.sessionId ? `Antigravity • ${options.sessionId.slice(0, 8)}` : undefined,
    sourceUrl: options?.sourcePath,
    isStreaming,
    parseModeOverride: 'live-transcript',
  });

  const lastTimestamp = lastStep?.createdAt || new Date().toISOString();
  const titleFromFirstTurn = parsed.flow.turns[0]?.title;

  return {
    ...parsed.flow,
    title: titleFromFirstTurn || parsed.flow.title,
    createdAt: lastTimestamp,
  };
}
