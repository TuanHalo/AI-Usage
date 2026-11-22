import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeDelta,
  normalizePlatform,
  normalizeRelation,
} from '../../site/src/lib/conversation-flow/parser';
import type {
  AIPlatform,
  ConversationFlow,
  ConversationTurn,
  DesktopSessionSummary,
  TurnRelation,
} from '../../site/src/lib/conversation-flow/types';

export interface StartTurnInput {
  readonly sessionId?: string;
  readonly sessionTitle?: string;
  readonly platform?: AIPlatform;
  readonly rawUserMessage: string;
  readonly intent: string;
  readonly inputSummary?: string;
  readonly expectedOutput: string;
  readonly relation?: TurnRelation;
}

export interface CompleteTurnInput {
  readonly sessionId?: string;
  readonly turnIndex?: number;
  readonly actualOutput: string;
  readonly delta: string;
  readonly deltaNote?: string;
  readonly extras?: readonly string[];
  readonly rawAssistantMessage?: string;
}

export interface McpSessionRecord {
  readonly sessionId: string;
  readonly updatedAt: string;
  readonly flow: ConversationFlow;
}

const DEFAULT_SESSION_ID = 'claude-desktop-live';

export function getMcpSessionsDir(): string {
  const override = process.env.PROMPTFLOW_SESSIONS_DIR;
  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return path.join(os.homedir(), '.promptflow', 'sessions');
}

function sanitizeSessionId(raw: string | undefined): string {
  const cleaned = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || DEFAULT_SESSION_ID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSessionFile(filePath: string): McpSessionRecord | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.sessionId !== 'string' || !isRecord(parsed.flow)) {
      return null;
    }
    if (parsed.flow.schemaVersion !== '1.0' || !Array.isArray(parsed.flow.turns)) {
      return null;
    }
    return parsed as unknown as McpSessionRecord;
  } catch {
    return null;
  }
}

function writeSessionAtomic(record: McpSessionRecord): string {
  const dir = getMcpSessionsDir();
  fs.mkdirSync(dir, { recursive: true });
  const targetPath = path.join(dir, `${record.sessionId}.json`);
  const tmpPath = path.join(dir, `${record.sessionId}.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmpPath, targetPath);
  return targetPath;
}

function resolveSessionPath(sessionId: string | undefined): {
  readonly id: string;
  readonly filePath: string;
} {
  const dir = getMcpSessionsDir();
  if (sessionId && sessionId.trim().length > 0) {
    const safeId = sanitizeSessionId(sessionId);
    return { id: safeId, filePath: path.join(dir, `${safeId}.json`) };
  }

  const all = listMcpSessions();
  const latest = all[0];
  if (latest) {
    return { id: latest.sessionId, filePath: latest.filePath };
  }

  return {
    id: DEFAULT_SESSION_ID,
    filePath: path.join(dir, `${DEFAULT_SESSION_ID}.json`),
  };
}

function deriveShortTitle(prompt: string, index: number): string {
  const firstLine =
    prompt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  if (!firstLine) return `Turn ${index}`;
  const words = firstLine.split(/\s+/);
  return words.length <= 7
    ? firstLine.slice(0, 64)
    : `${words.slice(0, 7).join(' ')}…`;
}

export function startMcpTurn(input: StartTurnInput): {
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly flow: ConversationFlow;
} {
  const sessionId = sanitizeSessionId(input.sessionId);
  const existingPath = path.join(getMcpSessionsDir(), `${sessionId}.json`);
  const existing = fs.existsSync(existingPath) ? readSessionFile(existingPath) : null;
  const now = new Date().toISOString();

  const prevTurns: readonly ConversationTurn[] = existing?.flow.turns ?? [];
  const nextIndex = prevTurns.length + 1;
  const relation = input.relation
    ? normalizeRelation(input.relation, nextIndex)
    : normalizeRelation('', nextIndex);
  const platform = input.platform ? normalizePlatform(input.platform) : (existing?.flow.platform ?? 'claude');

  const newTurn: ConversationTurn = {
    id: `turn-${nextIndex}`,
    index: nextIndex,
    title: deriveShortTitle(input.rawUserMessage, nextIndex),
    relation,
    rawUserMessage: input.rawUserMessage,
    rawAssistantMessage: '',
    intent: input.intent.trim(),
    inputSummary: input.inputSummary?.trim() || 'Provided directly in prompt',
    expectedOutput: input.expectedOutput.trim(),
    actualOutput: 'Running response in progress…',
    delta: 'pending',
    deltaNote: 'Pre-Run Flow Contract registered; awaiting completion.',
    extras: [],
    contractDetected: true,
    isStreaming: true,
  };

  const turns: readonly ConversationTurn[] = [...prevTurns, newTurn];
  const flowTitle =
    input.sessionTitle?.trim() ||
    existing?.flow.title ||
    newTurn.title;

  const flow: ConversationFlow = {
    schemaVersion: '1.0',
    title: flowTitle,
    platform,
    overallGoal: existing?.flow.overallGoal || newTurn.intent,
    finalOutcome: existing?.flow.finalOutcome || 'Awaiting completed turn output…',
    createdAt: now,
    parseMode: 'mcp-live',
    isStreaming: true,
    turns,
  };

  writeSessionAtomic({
    sessionId,
    updatedAt: now,
    flow,
  });

  return { sessionId, turnIndex: nextIndex, flow };
}

export function completeMcpTurn(input: CompleteTurnInput): {
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly flow: ConversationFlow;
} {
  const resolved = resolveSessionPath(input.sessionId);
  const existing = fs.existsSync(resolved.filePath)
    ? readSessionFile(resolved.filePath)
    : null;
  const now = new Date().toISOString();

  const normalizedDelta = normalizeDelta(input.delta);
  const cleanedExtras = (input.extras ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !/^(none|n\/a|-)$/i.test(item));

  if (!existing || existing.flow.turns.length === 0) {
    const fallbackTurn: ConversationTurn = {
      id: 'turn-1',
      index: 1,
      title: 'Turn 1 (Logged Post-Run)',
      relation: 'initial',
      rawUserMessage: '(Completed turn logged directly without Pre-Run start call)',
      rawAssistantMessage: input.rawAssistantMessage ?? '',
      intent: 'Logged turn outcome',
      inputSummary: 'Not captured pre-run',
      expectedOutput: 'Not captured pre-run',
      actualOutput: input.actualOutput.trim(),
      delta: normalizedDelta,
      deltaNote: input.deltaNote?.trim() ?? '',
      extras: cleanedExtras,
      contractDetected: true,
      isStreaming: false,
    };

    const flow: ConversationFlow = {
      schemaVersion: '1.0',
      title: `Claude Desktop • ${resolved.id}`,
      platform: 'claude',
      overallGoal: fallbackTurn.intent,
      finalOutcome: fallbackTurn.actualOutput,
      createdAt: now,
      parseMode: 'mcp-live',
      isStreaming: false,
      turns: [fallbackTurn],
    };

    writeSessionAtomic({ sessionId: resolved.id, updatedAt: now, flow });
    return { sessionId: resolved.id, turnIndex: 1, flow };
  }

  const targetIndex =
    typeof input.turnIndex === 'number' && Number.isFinite(input.turnIndex)
      ? input.turnIndex
      : existing.flow.turns[existing.flow.turns.length - 1]?.index ?? 1;

  const updatedTurns = existing.flow.turns.map((turn) => {
    if (turn.index !== targetIndex) {
      return turn;
    }
    return {
      ...turn,
      rawAssistantMessage: input.rawAssistantMessage ?? turn.rawAssistantMessage,
      actualOutput: input.actualOutput.trim(),
      delta: normalizedDelta,
      deltaNote: input.deltaNote?.trim() ?? turn.deltaNote,
      extras: cleanedExtras,
      contractDetected: true,
      isStreaming: false,
    };
  });

  const anyStreaming = updatedTurns.some((t) => t.isStreaming);
  const lastTurn = updatedTurns[updatedTurns.length - 1];

  const flow: ConversationFlow = {
    ...existing.flow,
    finalOutcome: lastTurn?.actualOutput || existing.flow.finalOutcome,
    createdAt: now,
    isStreaming: anyStreaming,
    turns: updatedTurns,
  };

  writeSessionAtomic({
    sessionId: resolved.id,
    updatedAt: now,
    flow,
  });

  return {
    sessionId: resolved.id,
    turnIndex: targetIndex,
    flow,
  };
}

export function getMcpFlow(sessionId?: string): {
  readonly sessionId: string;
  readonly flow: ConversationFlow | null;
} {
  const resolved = resolveSessionPath(sessionId);
  if (!fs.existsSync(resolved.filePath)) {
    return { sessionId: resolved.id, flow: null };
  }
  const record = readSessionFile(resolved.filePath);
  return {
    sessionId: resolved.id,
    flow: record?.flow ?? null,
  };
}

export interface LoadedMcpSession {
  readonly sessionId: string;
  readonly filePath: string;
  readonly summary: DesktopSessionSummary;
  readonly flow: ConversationFlow;
}

export function listMcpSessions(): readonly LoadedMcpSession[] {
  const dir = getMcpSessionsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }

  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const loaded: LoadedMcpSession[] = [];
  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    const record = readSessionFile(filePath);
    if (!record) continue;

    loaded.push({
      sessionId: record.sessionId,
      filePath,
      summary: {
        id: `mcp:${record.sessionId}`,
        source: 'mcp-session',
        platform: record.flow.platform,
        title: record.flow.title,
        updatedAt: record.updatedAt,
        turnCount: record.flow.turns.length,
        isStreaming: record.flow.isStreaming,
        sourcePath: filePath,
      },
      flow: record.flow,
    });
  }

  loaded.sort((a, b) => b.summary.updatedAt.localeCompare(a.summary.updatedAt));
  return loaded;
}
