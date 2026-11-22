export type AIPlatform =
  | 'claude'
  | 'gemini'
  | 'grok'
  | 'chatgpt'
  | 'antigravity'
  | 'generic';

export type DeltaStatus =
  | 'matched'
  | 'expanded'
  | 'pivoted'
  | 'partial'
  | 'pending';

export type TurnRelation =
  | 'initial'
  | 'follow-up'
  | 'clarification'
  | 'research-detour'
  | 'pivot'
  | 'refinement';

export type ParseMode =
  | 'structured-json'
  | 'flow-contract'
  | 'heuristic-raw'
  | 'live-transcript'
  | 'mcp-live';

export type DesktopSource =
  | 'antigravity-jsonl'
  | 'claude-code-jsonl'
  | 'mcp-session';

export interface RawMessagePair {
  readonly userMessage: string;
  readonly assistantMessage: string;
  readonly toolSummary?: string;
  readonly createdAt?: string;
}

export interface FlowContractPreRun {
  readonly goal: string;
  readonly inputSummary: string;
  readonly expectedOutput: string;
  readonly gate: string;
}

export interface FlowContractPostRun {
  readonly actualOutput: string;
  readonly delta: DeltaStatus;
  readonly deltaNote: string;
  readonly extras: readonly string[];
}

export interface ConversationTurn {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly relation: TurnRelation;
  readonly rawUserMessage: string;
  readonly rawAssistantMessage: string;
  readonly intent: string;
  readonly inputSummary: string;
  readonly expectedOutput: string;
  readonly actualOutput: string;
  readonly delta: DeltaStatus;
  readonly deltaNote: string;
  readonly extras: readonly string[];
  readonly contractDetected: boolean;
  readonly isStreaming: boolean;
  readonly toolSummary?: string;
}

export interface ConversationFlow {
  readonly schemaVersion: '1.0';
  readonly title: string;
  readonly platform: AIPlatform;
  readonly overallGoal: string;
  readonly finalOutcome: string;
  readonly createdAt: string;
  readonly parseMode: ParseMode;
  readonly isStreaming: boolean;
  readonly sourceUrl?: string;
  readonly turns: readonly ConversationTurn[];
}

export interface ParseOptions {
  readonly platformHint?: AIPlatform;
  readonly title?: string;
  readonly sourceUrl?: string;
  readonly isStreaming?: boolean;
  readonly parseModeOverride?: ParseMode;
}

export interface ParseResult {
  readonly flow: ConversationFlow;
  readonly warnings: readonly string[];
}

export interface SamplePreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly platform: AIPlatform;
  readonly rawText: string;
  readonly rawTextVi?: string;
}

export interface SavedFlowEntry {
  readonly id: string;
  readonly savedAt: string;
  readonly flow: ConversationFlow;
}

export interface DesktopSessionSummary {
  readonly id: string;
  readonly source: DesktopSource;
  readonly platform: AIPlatform;
  readonly title: string;
  readonly updatedAt: string;
  readonly turnCount: number;
  readonly isStreaming: boolean;
  readonly sourcePath: string;
}
