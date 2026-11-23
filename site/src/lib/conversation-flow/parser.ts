import type {
  AIPlatform,
  ConversationFlow,
  ConversationTurn,
  DeltaStatus,
  FlowContractPostRun,
  FlowContractPreRun,
  FocusStatus,
  ParseMode,
  ParseOptions,
  ParseResult,
  RawMessagePair,
  ScopeSize,
  TurnRelation,
} from './types';

const UI_NOISE_LINES = new Set<string>([
  'copy',
  'copy code',
  'retry',
  'edit',
  'regenerate',
  'show thinking',
  'hide thinking',
  'think harder',
  'good response',
  'bad response',
  'share',
  'read aloud',
  'sources',
]);

interface SpeakerMatch {
  readonly role: 'user' | 'assistant';
  readonly platformHint?: AIPlatform;
  readonly remainder: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const val = record[key];
  return typeof val === 'string' ? val.trim() : '';
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const val = record[key];
  return typeof val === 'boolean' ? val : false;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string
): readonly string[] {
  const val = record[key];
  if (!Array.isArray(val)) {
    return [];
  }
  return val
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !/^(none|n\/a|-)$/i.test(item));
}

export function normalizePlatform(raw: string): AIPlatform {
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('grok')) return 'grok';
  if (normalized.includes('chatgpt') || normalized.includes('openai')) {
    return 'chatgpt';
  }
  if (normalized.includes('antigravity') || normalized.includes('agy')) {
    return 'antigravity';
  }
  return 'generic';
}

export function normalizeDelta(raw: string): DeltaStatus {
  const normalized = raw.trim().toLowerCase();
  if (normalized.startsWith('match')) return 'matched';
  if (normalized.startsWith('expand')) return 'expanded';
  if (normalized.startsWith('pivot')) return 'pivoted';
  if (normalized.startsWith('part')) return 'partial';
  if (normalized.startsWith('pend')) return 'pending';
  return 'pending';
}

export function normalizeFocusStatus(raw: string): FocusStatus | undefined {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized.includes('off-topic') ||
    normalized.includes('off topic') ||
    normalized.includes('drift')
  ) {
    return 'off-topic';
  }
  if (normalized.includes('adjacent') || normalized.includes('soft')) {
    return 'adjacent';
  }
  if (normalized.includes('on-topic') || normalized.includes('on topic')) {
    return 'on-topic';
  }
  return undefined;
}

export function normalizeScopeSize(raw: string): ScopeSize | undefined {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('parallel') || normalized.includes('large')) {
    return 'split-parallel';
  }
  if (normalized.includes('step') || normalized.includes('split')) {
    return 'split-steps';
  }
  if (normalized.includes('small')) {
    return 'small';
  }
  if (normalized.includes('medium')) {
    return 'medium';
  }
  return undefined;
}

export function collectParkedTopics(
  turns: readonly ConversationTurn[]
): readonly string[] {
  const seen = new Set<string>();
  const collected: string[] = [];
  for (const turn of turns) {
    for (const rawItem of turn.parkedTopics ?? []) {
      const cleaned = rawItem.trim();
      if (!cleaned || /^(none|n\/a|-)$/i.test(cleaned)) continue;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        collected.push(cleaned);
      }
    }
  }
  return collected;
}

export function buildParkedFollowUpPrompt(
  parkedTopic: string,
  sourceSessionTopic?: string
): string {
  const cleanTopic = parkedTopic.trim() || 'Follow-up task';
  const originNote = sourceSessionTopic?.trim()
    ? ` (parked from session "${sourceSessionTopic.trim()}")`
    : '';
  return [
    `Topic Anchor: ${cleanTopic}${originNote}`,
    'Please keep this conversation focused strictly on this topic.',
    'Start with:',
    '1. Part 1: Executive Summary (high-level goal, approach, scope size, and verification plan)',
    '2. Part 2: Detailed breakdown (using Top-Down Skeleton-First TDD if implementing code)',
  ].join('\n');
}

export function normalizeRelation(
  raw: string,
  index: number
): TurnRelation {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'initial') return 'initial';
  if (normalized === 'follow-up' || normalized === 'followup') {
    return 'follow-up';
  }
  if (normalized === 'clarification') return 'clarification';
  if (normalized === 'research-detour' || normalized === 'research') {
    return 'research-detour';
  }
  if (normalized === 'pivot') return 'pivot';
  if (normalized === 'refinement') return 'refinement';
  return index === 1 ? 'initial' : 'follow-up';
}

function truncateText(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function deriveTurnTitle(userMessage: string, index: number): string {
  const firstNonEmpty = userMessage
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => line.length > 0 && !line.startsWith('```'));

  if (!firstNonEmpty) {
    return `Turn ${index}`;
  }

  const firstSentence = firstNonEmpty.split(/(?<=[.!?])\s+/)[0] ?? firstNonEmpty;
  const words = firstSentence.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 7) {
    return truncateText(firstSentence, 64);
  }
  return `${words.slice(0, 7).join(' ')}…`;
}

function stripFlowContractBlocks(assistantText: string): string {
  const lines = assistantText.split(/\r?\n/);
  const kept: string[] = [];
  let inContractBlock = false;
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence && /^>?\s*\*?\*?\[Flow Contract\s*\|\s*(Pre-Run|Post-Run)\]\*?\*?/i.test(trimmed)) {
      inContractBlock = true;
      continue;
    }

    if (inContractBlock) {
      if (trimmed.length === 0) {
        inContractBlock = false;
        continue;
      }
      if (/^>/.test(trimmed) || /^[-*]\s+\*\*[^*]+:\*\*/.test(trimmed)) {
        continue;
      }
      inContractBlock = false;
    }

    kept.push(line);
  }

  return kept.join('\n').trim();
}

function splitExtrasList(rawExtras: string): readonly string[] {
  const clean = rawExtras.trim();
  if (!clean || /^(none|n\/a|-)$/i.test(clean)) {
    return [];
  }
  return clean
    .split(/;\s*|\s*\|\s*/)
    .map((item) => item.replace(/^[-*]\s+/, '').trim())
    .filter((item) => item.length > 0 && !/^(none|n\/a|-)$/i.test(item));
}

export function extractFlowContract(assistantText: string): {
  readonly preRun: FlowContractPreRun | null;
  readonly postRun: FlowContractPostRun | null;
} {
  const lines = assistantText.split(/\r?\n/);
  let section: 'none' | 'pre' | 'post' = 'none';
  let inCodeFence = false;

  let topic = '';
  let focusRaw = '';
  let scopeRaw = '';
  let goal = '';
  let inputSummary = '';
  let expectedOutput = '';
  let gate = '';

  let actualOutput = '';
  let deltaRaw = '';
  let deltaNote = '';
  let extrasRaw = '';
  let parkedRaw = '';
  let hasPre = false;
  let hasPost = false;
  let lastKey = '';

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inCodeFence = !inCodeFence;
    }
    if (inCodeFence) {
      continue;
    }

    if (/^>?\s*\*?\*?\[Flow Contract\s*\|\s*Pre-Run\]\*?\*?/i.test(trimmed)) {
      section = 'pre';
      hasPre = true;
      lastKey = '';
      continue;
    }

    if (/^>?\s*\*?\*?\[Flow Contract\s*\|\s*Post-Run\]\*?\*?/i.test(trimmed)) {
      section = 'post';
      hasPost = true;
      lastKey = '';
      continue;
    }

    if (section === 'none') {
      continue;
    }

    if (trimmed.length === 0) {
      section = 'none';
      lastKey = '';
      continue;
    }

    const strippedQuote = trimmed.replace(/^>\s*/, '').trim();
    const fieldMatch = strippedQuote.match(
      /^(?:[-*]\s+)?(?:\*\*)?([A-Za-z][A-Za-z\s]{1,24}?)(?:\*\*)?:\s*(?:\*\*)?(.*)$/
    );

    if (fieldMatch) {
      const key = (fieldMatch[1] ?? '').trim().toLowerCase();
      const value = (fieldMatch[2] ?? '').replace(/^\*\*|\*\*$/g, '').trim();
      lastKey = key;

      if (section === 'pre') {
        if (key === 'topic' || key === 'session topic') topic = value;
        else if (key === 'focus' || key === 'focus status') focusRaw = value;
        else if (key === 'scope' || key === 'scope size') scopeRaw = value;
        else if (key === 'goal' || key === 'intent') goal = value;
        else if (key === 'input' || key === 'inputs') inputSummary = value;
        else if (key === 'expected output' || key === 'expected') {
          expectedOutput = value;
        } else if (key === 'gate') gate = value;
      } else {
        if (key === 'actual output' || key === 'actual') actualOutput = value;
        else if (key === 'delta') deltaRaw = value;
        else if (key === 'delta note' || key === 'note') deltaNote = value;
        else if (key === 'extras' || key === 'extra') extrasRaw = value;
        else if (key === 'parked' || key === 'parked topics' || key === 'parked topic') {
          parkedRaw = value;
        }
      }
      continue;
    }

    if (trimmed.startsWith('>') && lastKey.length > 0 && strippedQuote.length > 0) {
      const continuation = strippedQuote.replace(/^[-*]\s*/, '').trim();
      if (section === 'post' && (lastKey === 'extras' || lastKey === 'extra')) {
        extrasRaw = extrasRaw ? `${extrasRaw}; ${continuation}` : continuation;
      } else if (
        section === 'post' &&
        (lastKey === 'parked' || lastKey === 'parked topics' || lastKey === 'parked topic')
      ) {
        parkedRaw = parkedRaw ? `${parkedRaw}; ${continuation}` : continuation;
      }
    } else if (!trimmed.startsWith('>')) {
      section = 'none';
      lastKey = '';
    }
  }

  const focusStatus = focusRaw ? normalizeFocusStatus(focusRaw) : undefined;
  const scopeSize = scopeRaw ? normalizeScopeSize(scopeRaw) : undefined;

  const preRun: FlowContractPreRun | null = hasPre
    ? {
        ...(topic ? { topic } : {}),
        ...(focusStatus ? { focusStatus } : {}),
        ...(scopeSize ? { scopeSize } : {}),
        goal,
        inputSummary,
        expectedOutput,
        gate,
      }
    : null;

  const postRun: FlowContractPostRun | null = hasPost
    ? {
        actualOutput,
        delta: deltaRaw ? normalizeDelta(deltaRaw) : 'pending',
        deltaNote,
        extras: splitExtrasList(extrasRaw),
        parkedTopics: splitExtrasList(parkedRaw),
      }
    : null;

  return { preRun, postRun };
}

function inferInputSummary(userMessage: string): string {
  const cues: string[] = [];
  const codeBlockCount = (userMessage.match(/```/g) ?? []).length / 2;
  if (codeBlockCount >= 1) {
    cues.push(`${Math.floor(codeBlockCount)} code/snippet block(s)`);
  }
  if (/https?:\/\/\S+/i.test(userMessage)) {
    cues.push('URL reference');
  }
  if (/(?:error|exception|traceback|stack|failed|errno)/i.test(userMessage)) {
    cues.push('error/failure context');
  }
  if (/(?:[\w-]+\.(?:ts|tsx|js|jsx|py|ps1|yaml|yml|json|md|sql|go|rs))\b/i.test(userMessage)) {
    cues.push('file/module reference');
  }
  const metrics = userMessage.match(/\b\d+(?:\.\d+)?\s*(?:k|m|ms|s|sec|seconds|req\/s|rps|gb|mb|rows|%)\b/gi);
  if (metrics && metrics.length > 0) {
    cues.push(`constraints: ${Array.from(new Set(metrics)).slice(0, 3).join(', ')}`);
  }

  if (cues.length === 0) {
    return truncateText(userMessage, 140) || 'No explicit constraints detected';
  }
  return `${cues.join(' · ')} — "${truncateText(userMessage, 90)}"`;
}

function inferExpectedOutput(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (/\b(compare|comparison|vs\.?|versus|tradeoff|difference)\b/.test(lower)) {
    return 'Inferred: Side-by-side comparison / tradeoff breakdown.';
  }
  if (/\b(write|implement|create|build|generate|script|code|function|class|query)\b/.test(lower)) {
    return 'Inferred: Runnable code / implementation snippet.';
  }
  if (/\b(fix|debug|why does|error|broken|issue|bug|failing)\b/.test(lower)) {
    return 'Inferred: Root-cause diagnosis and concrete fix.';
  }
  if (/\b(plan|design|architecture|roadmap|strategy|how should)\b/.test(lower)) {
    return 'Inferred: Structured design or step-by-step plan.';
  }
  if (/\b(explain|what is|how does|summarize|overview)\b/.test(lower)) {
    return 'Inferred: Clear explanation / conceptual summary.';
  }
  const countMatch = lower.match(/\b(\d+)\s+(?:tests?|cases?|examples?|options?|steps?|ways?|items?)\b/);
  if (countMatch && countMatch[1]) {
    return `Inferred: List of ${countMatch[1]} targeted items matching the prompt.`;
  }
  return 'Unconfirmed (heuristic — edit inline or copy Analyzer Prompt for deeper extraction).';
}

function summarizeAssistantOutput(
  assistantBody: string,
  isTurnStreaming: boolean
): {
  readonly summary: string;
  readonly looksExpanded: boolean;
  readonly inferredExtras: readonly string[];
} {
  if (!assistantBody.trim()) {
    return {
      summary: isTurnStreaming
        ? 'Streaming response in progress…'
        : 'No assistant reply captured for this turn yet.',
      looksExpanded: false,
      inferredExtras: [],
    };
  }

  const lines = assistantBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('```'));

  const firstParagraph =
    lines.find((line) => !/^#{1,4}\s+/.test(line)) ?? lines[0] ?? assistantBody;

  const headingCount = (assistantBody.match(/^#{1,4}\s+/gm) ?? []).length;
  const codeBlockCount = Math.floor((assistantBody.match(/```/g) ?? []).length / 2);
  const bulletCount = (assistantBody.match(/^\s*[-*]\s+/gm) ?? []).length;

  const structureNotes: string[] = [];
  if (headingCount > 0) structureNotes.push(`${headingCount} section(s)`);
  if (codeBlockCount > 0) structureNotes.push(`${codeBlockCount} code block(s)`);
  if (bulletCount >= 3) structureNotes.push(`${bulletCount} bullet points`);

  const suffix =
    structureNotes.length > 0 ? ` [${structureNotes.join(', ')}]` : '';

  const looksExpanded =
    !isTurnStreaming &&
    (assistantBody.length > 750 ||
      (headingCount >= 2 && (codeBlockCount >= 1 || bulletCount >= 4)));

  const inferredExtras: string[] = [];
  if (looksExpanded) {
    if (headingCount >= 2) {
      inferredExtras.push(`Multi-section breakdown (${headingCount} headings)`);
    }
    if (codeBlockCount >= 1) {
      inferredExtras.push(`Included ${codeBlockCount} concrete code snippet(s)`);
    }
    if (bulletCount >= 4) {
      inferredExtras.push(`Added ${bulletCount} detailed bullet takeaways`);
    }
  }

  return {
    summary: `${truncateText(firstParagraph, 190)}${suffix}`,
    looksExpanded,
    inferredExtras,
  };
}

function classifyTurnRelation(
  userMessage: string,
  index: number,
  delta: DeltaStatus
): TurnRelation {
  if (index === 1) {
    return 'initial';
  }
  const lower = userMessage.toLowerCase();
  if (delta === 'pivoted' || /\b(wait|actually|instead|switch|pivot|change direction|scratch that|what if .* down)\b/.test(lower)) {
    return 'pivot';
  }
  if (/\b(clarify|what do you mean|which one|did you mean|same millisecond|edge case)\b/.test(lower)) {
    return 'clarification';
  }
  if (/\b(investigate|research|deep dive|why does|how does|explore|compare|tradeoff)\b/.test(lower)) {
    return 'research-detour';
  }
  if (/\b(shorter|rewrite|tweak|refactor|fix|update|adjust|make it)\b/.test(lower)) {
    return 'refinement';
  }
  return 'follow-up';
}

export function detectPlatform(rawText: string): AIPlatform {
  const lines = rawText.split(/\r?\n/);
  let inCodeFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      continue;
    }
    if (/^(?:claude said:|claude:|human:)$/i.test(trimmed) || /^claude said:/i.test(trimmed)) {
      return 'claude';
    }
    if (/^(?:gemini said:|gemini:|show thinking|hide thinking)$/i.test(trimmed) || /^gemini said:/i.test(trimmed)) {
      return 'gemini';
    }
    if (/^(?:grok said:|grok:|think harder)$/i.test(trimmed) || /^grok$/i.test(trimmed)) {
      return 'grok';
    }
    if (/^(?:chatgpt said:|chatgpt:)$/i.test(trimmed) || /^chatgpt said:/i.test(trimmed)) {
      return 'chatgpt';
    }
    if (/^antigravity:/i.test(trimmed)) {
      return 'antigravity';
    }
  }
  return 'generic';
}

function matchExplicitSpeakerLine(
  trimmedLine: string,
  allowBareRoleNames: boolean,
  prevLineWasBlank: boolean
): SpeakerMatch | null {
  const normalizedHeader = trimmedLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*|\*\*$/g, '')
    .trim();

  const userPrefixMatch = normalizedHeader.match(
    /^(you said|you|user|human|prompt|me|q)\s*:\s*(.*)$/i
  );
  if (userPrefixMatch) {
    return {
      role: 'user',
      remainder: (userPrefixMatch[2] ?? '').trim(),
    };
  }

  const assistantPrefixMatch = normalizedHeader.match(
    /^(claude said|claude|gemini said|gemini|grok said|grok|chatgpt said|chatgpt|assistant|ai|model|antigravity|a)\s*:\s*(.*)$/i
  );
  if (assistantPrefixMatch) {
    const label = assistantPrefixMatch[1] ?? '';
    return {
      role: 'assistant',
      platformHint: normalizePlatform(label),
      remainder: (assistantPrefixMatch[2] ?? '').trim(),
    };
  }

  if (allowBareRoleNames && prevLineWasBlank) {
    if (/^(you|human|user)$/i.test(normalizedHeader)) {
      return { role: 'user', remainder: '' };
    }
    if (/^(claude|gemini|grok|chatgpt|assistant)$/i.test(normalizedHeader)) {
      return {
        role: 'assistant',
        platformHint: normalizePlatform(normalizedHeader),
        remainder: '',
      };
    }
  }

  return null;
}

function hasBareAssistantMarkers(lines: readonly string[]): boolean {
  let inCodeFence = false;
  let prevBlank = true;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      prevBlank = false;
      continue;
    }
    if (inCodeFence) {
      continue;
    }
    if (prevBlank && /^(claude|gemini|grok|chatgpt|assistant)$/i.test(trimmed)) {
      return true;
    }
    prevBlank = trimmed.length === 0;
  }
  return false;
}

function splitRawTurns(rawText: string): {
  readonly pairs: readonly RawMessagePair[];
  readonly detectedPlatform: AIPlatform;
  readonly usedFallbackSingleTurn: boolean;
} {
  const lines = rawText.split(/\r?\n/);
  const allowBareRoles = hasBareAssistantMarkers(lines);
  const detectedPlatform = detectPlatform(rawText);

  interface RawSegment {
    readonly role: 'user' | 'assistant';
    readonly lines: string[];
  }

  const segments: RawSegment[] = [];
  let current: RawSegment | null = null;
  let inCodeFence = false;
  let prevBlank = true;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      if (!current) {
        current = { role: 'user', lines: [] };
        segments.push(current);
      }
      current.lines.push(rawLine);
      prevBlank = false;
      continue;
    }

    if (!inCodeFence) {
      if (UI_NOISE_LINES.has(trimmed.toLowerCase())) {
        prevBlank = true;
        continue;
      }

      const speaker = matchExplicitSpeakerLine(trimmed, allowBareRoles, prevBlank);
      if (speaker) {
        current = {
          role: speaker.role,
          lines: speaker.remainder ? [speaker.remainder] : [],
        };
        segments.push(current);
        prevBlank = false;
        continue;
      }
    }

    if (!current) {
      if (trimmed.length === 0) {
        prevBlank = true;
        continue;
      }
      current = { role: 'user', lines: [] };
      segments.push(current);
    }

    current.lines.push(rawLine);
    prevBlank = trimmed.length === 0;
  }

  const hasExplicitAssistant = segments.some((seg) => seg.role === 'assistant');
  if (!hasExplicitAssistant) {
    const whole = rawText.trim();
    if (!whole) {
      return { pairs: [], detectedPlatform, usedFallbackSingleTurn: false };
    }
    return {
      pairs: [{ userMessage: whole, assistantMessage: '' }],
      detectedPlatform,
      usedFallbackSingleTurn: true,
    };
  }

  const pairs: RawMessagePair[] = [];
  let pendingUser: string[] = [];

  for (const seg of segments) {
    const content = seg.lines.join('\n').trim();
    if (seg.role === 'user') {
      if (pendingUser.length > 0) {
        pairs.push({
          userMessage: pendingUser.join('\n\n').trim(),
          assistantMessage: '',
        });
        pendingUser = [];
      }
      if (content.length > 0) {
        pendingUser.push(content);
      }
    } else {
      const userMessage =
        pendingUser.length > 0
          ? pendingUser.join('\n\n').trim()
          : '(Initial prompt omitted in pasted excerpt)';
      pendingUser = [];
      pairs.push({
        userMessage,
        assistantMessage: content,
      });
    }
  }

  if (pendingUser.length > 0) {
    pairs.push({
      userMessage: pendingUser.join('\n\n').trim(),
      assistantMessage: '',
    });
  }

  return { pairs, detectedPlatform, usedFallbackSingleTurn: false };
}

function extractJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }
  const fenced = trimmed.match(/```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```/i);
  if (fenced && fenced[1]) {
    const inner = fenced[1].trim();
    if (inner.startsWith('{') || inner.startsWith('[')) {
      return inner;
    }
  }
  return null;
}

function tryParseStructuredJson(
  rawText: string,
  platformHint?: AIPlatform
): ParseResult | null {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) {
    return null;
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!isRecord(parsedUnknown) || !Array.isArray(parsedUnknown.turns)) {
    return null;
  }

  const turns: ConversationTurn[] = [];
  parsedUnknown.turns.forEach((entry, idx) => {
    if (!isRecord(entry)) {
      return;
    }
    const index =
      typeof entry.index === 'number' && Number.isFinite(entry.index)
        ? entry.index
        : idx + 1;
    const rawUserMessage = readString(entry, 'rawUserMessage') || readString(entry, 'userMessage');
    const rawAssistantMessage =
      readString(entry, 'rawAssistantMessage') || readString(entry, 'assistantMessage');
    const intent = readString(entry, 'intent') || truncateText(rawUserMessage, 160);
    const delta = normalizeDelta(readString(entry, 'delta') || 'matched');
    const focusStatus = normalizeFocusStatus(
      readString(entry, 'focusStatus') || readString(entry, 'focus')
    );
    const scopeSize = normalizeScopeSize(
      readString(entry, 'scopeSize') || readString(entry, 'scope')
    );
    const parkedTopics = readStringArray(entry, 'parkedTopics');

    turns.push({
      id: readString(entry, 'id') || `turn-${index}`,
      index,
      title: readString(entry, 'title') || deriveTurnTitle(rawUserMessage || intent, index),
      relation: normalizeRelation(readString(entry, 'relation'), index),
      rawUserMessage: rawUserMessage || '(Missing verbatim user prompt)',
      rawAssistantMessage,
      intent: intent || `Turn ${index} intent`,
      inputSummary: readString(entry, 'inputSummary') || inferInputSummary(rawUserMessage),
      expectedOutput: readString(entry, 'expectedOutput') || 'Not specified',
      actualOutput: readString(entry, 'actualOutput') || 'Not specified',
      delta,
      deltaNote: readString(entry, 'deltaNote'),
      extras: readStringArray(entry, 'extras'),
      ...(focusStatus ? { focusStatus } : {}),
      ...(scopeSize ? { scopeSize } : {}),
      ...(parkedTopics.length > 0 ? { parkedTopics } : {}),
      contractDetected: readBoolean(entry, 'contractDetected'),
      isStreaming: readBoolean(entry, 'isStreaming'),
    });
  });

  if (turns.length === 0) {
    return null;
  }

  const platformValue = readString(parsedUnknown, 'platform');
  const platform =
    platformValue.length > 0
      ? normalizePlatform(platformValue)
      : (platformHint ?? 'generic');
  const sessionTopic = readString(parsedUnknown, 'sessionTopic') || undefined;
  const rawFlowParked = readStringArray(parsedUnknown, 'parkedTopics');
  const collectedParked = collectParkedTopics(turns);
  const flowParked = rawFlowParked.length > 0 ? rawFlowParked : collectedParked;

  const flow: ConversationFlow = {
    schemaVersion: '1.0',
    title: readString(parsedUnknown, 'title') || turns[0]?.title || 'Conversation Flow',
    platform,
    ...(sessionTopic ? { sessionTopic } : {}),
    overallGoal:
      readString(parsedUnknown, 'overallGoal') ||
      turns[0]?.intent ||
      'Track conversation goal and outcomes',
    finalOutcome:
      readString(parsedUnknown, 'finalOutcome') ||
      turns[turns.length - 1]?.actualOutput ||
      'Pending outcome',
    ...(flowParked.length > 0 ? { parkedTopics: flowParked } : {}),
    createdAt: readString(parsedUnknown, 'createdAt') || new Date().toISOString(),
    parseMode: 'structured-json',
    isStreaming: readBoolean(parsedUnknown, 'isStreaming'),
    sourceUrl: readString(parsedUnknown, 'sourceUrl') || undefined,
    turns,
  };

  return {
    flow,
    warnings: [],
  };
}

export function parseStructuredTurns(
  pairs: readonly RawMessagePair[],
  options?: ParseOptions
): ParseResult {
  const warnings: string[] = [];
  let contractCount = 0;
  let detectedSessionTopic = '';
  const totalPairs = pairs.length;
  const flowStreaming = Boolean(options?.isStreaming);

  const turns: ConversationTurn[] = pairs.map((pair, idx) => {
    const index = idx + 1;
    const isLastTurn = index === totalPairs;
    const isTurnStreaming = flowStreaming && isLastTurn;
    const { preRun, postRun } = extractFlowContract(pair.assistantMessage);
    const hasContract = preRun !== null || postRun !== null;
    if (hasContract) {
      contractCount++;
    }
    if (!detectedSessionTopic && preRun?.topic) {
      detectedSessionTopic = preRun.topic;
    }

    const strippedAssistant = stripFlowContractBlocks(pair.assistantMessage);
    const assistantStats = summarizeAssistantOutput(
      strippedAssistant,
      isTurnStreaming
    );

    const intent =
      preRun?.goal ||
      truncateText(pair.userMessage, 170) ||
      `Turn ${index} user intent`;

    const inputSummary =
      preRun?.inputSummary || inferInputSummary(pair.userMessage);

    const expectedOutput =
      preRun?.expectedOutput || inferExpectedOutput(pair.userMessage);

    let actualOutput = postRun?.actualOutput || assistantStats.summary;
    if (
      isTurnStreaming &&
      pair.toolSummary &&
      pair.assistantMessage.trim().length === 0
    ) {
      actualOutput = `Working live (${pair.toolSummary})…`;
    }

    let delta: DeltaStatus = 'pending';
    if (isTurnStreaming) {
      delta = postRun?.delta ?? 'pending';
    } else if (postRun) {
      delta = postRun.delta;
    } else if (assistantStats.looksExpanded) {
      delta = 'expanded';
    }

    const extras =
      postRun && postRun.extras.length > 0
        ? postRun.extras
        : assistantStats.inferredExtras;

    let deltaNote = postRun?.deltaNote ?? '';
    if (!deltaNote) {
      if (isTurnStreaming) {
        deltaNote = 'Live response streaming in real time…';
      } else if (delta === 'expanded') {
        deltaNote =
          'Heuristic check detected detailed multi-section research or code output beyond a minimal reply.';
      } else if (pair.assistantMessage.trim().length === 0) {
        deltaNote = 'Awaiting assistant response.';
      } else {
        deltaNote =
          'Captured heuristically without a Flow Contract — edit inline or copy the Analyzer Prompt to confirm Expected vs. Actual.';
      }
    }

    const relation = classifyTurnRelation(pair.userMessage, index, delta);
    const parkedTopics = postRun?.parkedTopics ?? [];

    return {
      id: `turn-${index}`,
      index,
      title: deriveTurnTitle(pair.userMessage, index),
      relation,
      rawUserMessage: pair.userMessage,
      rawAssistantMessage: pair.assistantMessage,
      intent,
      inputSummary,
      expectedOutput,
      actualOutput,
      delta,
      deltaNote,
      extras,
      ...(preRun?.focusStatus ? { focusStatus: preRun.focusStatus } : {}),
      ...(preRun?.scopeSize ? { scopeSize: preRun.scopeSize } : {}),
      ...(parkedTopics.length > 0 ? { parkedTopics } : {}),
      contractDetected: hasContract,
      isStreaming: isTurnStreaming,
      toolSummary: pair.toolSummary,
    };
  });

  if (turns.length > 0 && contractCount === 0) {
    warnings.push(
      'No [Flow Contract] blocks found — parsed turns heuristically. Edit any card inline or click "Copy Analyzer Prompt" for deeper Expected vs. Actual analysis.'
    );
  }

  let parseMode: ParseMode = options?.parseModeOverride ?? 'heuristic-raw';
  if (!options?.parseModeOverride) {
    parseMode = contractCount > 0 ? 'flow-contract' : 'heuristic-raw';
  }

  const lastCompleted =
    [...turns].reverse().find((t) => !t.isStreaming && t.actualOutput.length > 0) ??
    turns[turns.length - 1];
  const flowParked = collectParkedTopics(turns);

  const flow: ConversationFlow = {
    schemaVersion: '1.0',
    title: options?.title?.trim() || turns[0]?.title || 'AI Conversation Flow',
    platform: options?.platformHint ?? 'generic',
    ...(detectedSessionTopic ? { sessionTopic: detectedSessionTopic } : {}),
    overallGoal: turns[0]?.intent || 'No user prompt detected yet.',
    finalOutcome:
      lastCompleted?.actualOutput || 'Awaiting completed assistant output.',
    ...(flowParked.length > 0 ? { parkedTopics: flowParked } : {}),
    createdAt: new Date().toISOString(),
    parseMode,
    isStreaming: flowStreaming,
    sourceUrl: options?.sourceUrl,
    turns,
  };

  return { flow, warnings };
}

export function parseConversation(
  rawInput: string,
  platformHint?: AIPlatform
): ParseResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      flow: {
        schemaVersion: '1.0',
        title: 'Empty Conversation',
        platform: platformHint ?? 'generic',
        overallGoal: 'Paste an AI chat transcript or connect the Edge Side Panel to visualize.',
        finalOutcome: 'No turns parsed yet.',
        createdAt: new Date().toISOString(),
        parseMode: 'heuristic-raw',
        isStreaming: false,
        turns: [],
      },
      warnings: ['Input is empty. Paste a conversation, JSON flow, or load a demo preset.'],
    };
  }

  const jsonResult = tryParseStructuredJson(trimmed, platformHint);
  if (jsonResult) {
    return jsonResult;
  }

  const { pairs, detectedPlatform, usedFallbackSingleTurn } = splitRawTurns(trimmed);
  const resolvedPlatform =
    platformHint && platformHint !== 'generic' ? platformHint : detectedPlatform;

  const result = parseStructuredTurns(pairs, {
    platformHint: resolvedPlatform,
  });

  const extraWarnings: string[] = [...result.warnings];
  if (usedFallbackSingleTurn) {
    extraWarnings.unshift(
      'No speaker markers (e.g. "You said:" / "Claude said:" / "User:" / "Assistant:") detected — treated entire paste as Turn 1.'
    );
  }
  if (extractJsonCandidate(trimmed) !== null) {
    extraWarnings.unshift(
      'Input resembled JSON but did not match the ConversationFlow v1 schema — fell back to text parsing.'
    );
  }

  return {
    flow: result.flow,
    warnings: extraWarnings,
  };
}
