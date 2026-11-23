import { getLang, onLangChange, t } from '../i18n/runtime';
import {
  buildAnalyzerPrompt,
  getAdaptiveRuleSnippet,
  getClaudeDesktopInstructionSnippet,
} from '../lib/conversation-flow/analyzer-prompt';
import { decodeFlowFromHash } from '../lib/conversation-flow/codec';
import {
  escapeHtml,
  exportFlowAsJson,
  exportFlowAsMarkdown,
  exportFlowAsStandaloneHtml,
  formatDeltaLabel,
  formatScopeLabel,
} from '../lib/conversation-flow/exporter';
import {
  buildParkedFollowUpPrompt,
  collectParkedTopics,
  normalizeFocusStatus,
  parseConversation,
} from '../lib/conversation-flow/parser';
import { SAMPLE_PRESETS } from '../lib/conversation-flow/samples';
import {
  clearAllSavedFlows,
  deleteFlowEntry,
  loadSavedFlows,
  saveFlowEntry,
} from '../lib/conversation-flow/storage';
import type {
  AIPlatform,
  ConversationFlow,
  ConversationTurn,
  DeltaStatus,
  DesktopSessionSummary,
  DesktopSource,
  FocusStatus,
  SavedFlowEntry,
  TurnRelation,
} from '../lib/conversation-flow/types';

interface AppState {
  flow: ConversationFlow | null;
  warnings: readonly string[];
  selectedTurnId: string | null;
  deltaFilter: DeltaStatus | 'all';
  isEditingTurn: boolean;
  isPromptExpanded: boolean;
  isIntakeCollapsed: boolean;
  activeSavedId: string | undefined;
  desktopSessions: readonly DesktopSessionSummary[];
  activeDesktopSessionId: string | null;
  autoFollowDesktop: boolean;
  desktopBridgeOnline: boolean;
}

const state: AppState = {
  flow: null,
  warnings: [],
  selectedTurnId: null,
  deltaFilter: 'all',
  isEditingTurn: false,
  isPromptExpanded: false,
  isIntakeCollapsed: false,
  activeSavedId: undefined,
  desktopSessions: [],
  activeDesktopSessionId: null,
  autoFollowDesktop: true,
  desktopBridgeOnline: false,
};

function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function getDesktopApiBase(): string {
  if (typeof window !== 'undefined' && window.location.port === '4328') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:4328';
}

function getMcpConfigSnippet(): string {
  return JSON.stringify(
    {
      mcpServers: {
        promptflow: {
          command: 'node',
          args: ['d:\\IT\\AI-Usage\\desktop\\dist\\mcp-server.mjs'],
        },
      },
    },
    null,
    2
  );
}

function showToast(message: string): void {
  const toast = getEl<HTMLDivElement>('viz-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 3600);
}

async function copyText(text: string, confirmationMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(confirmationMessage);
  } catch {
    showToast(t('viz.toast.clipboardBlocked'));
  }
}

function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugifyTitle(title: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || 'conversation-flow';
}

function formatSourceLabel(source: DesktopSource): string {
  switch (source) {
    case 'antigravity-jsonl':
      return '✨ Antigravity';
    case 'mcp-session':
      return '🤖 Claude Desktop MCP';
    case 'claude-code-jsonl':
      return '💻 Claude Code';
  }
}

function renderDesktopLiveBar(): void {
  const bar = getEl<HTMLElement>('desktop-live-bar');
  const countEl = getEl<HTMLSpanElement>('desktop-session-count');
  const listEl = getEl<HTMLDivElement>('desktop-sessions-list');
  if (!bar || !countEl || !listEl) return;

  if (!state.desktopBridgeOnline) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  countEl.textContent = t('viz.rt.sessionsDetected', {
    n: state.desktopSessions.length,
  });

  if (state.desktopSessions.length === 0) {
    listEl.innerHTML = `<p class="viz-muted">${escapeHtml(t('viz.rt.noDesktopSessions'))}</p>`;
    return;
  }

  listEl.innerHTML = state.desktopSessions
    .slice(0, 12)
    .map((s) => {
      const isActive = s.id === state.activeDesktopSessionId;
      const statusBadge = s.isStreaming
        ? `<span class="viz-delta-badge viz-delta-pivoted">${escapeHtml(t('viz.rt.statusRunning'))}</span>`
        : `<span class="viz-delta-badge viz-delta-matched">${escapeHtml(t('viz.rt.turnsCount', { n: s.turnCount }))}</span>`;
      return `<button type="button" class="viz-session-btn ${isActive ? 'active' : ''}" data-session-id="${escapeHtml(s.id)}">
        <div class="viz-node-top">
          <span class="viz-muted-sm" style="font-weight:800;">${escapeHtml(formatSourceLabel(s.source))}</span>
          ${statusBadge}
        </div>
        <div class="viz-node-title">${escapeHtml(s.title)}</div>
        <div class="viz-muted-sm">${escapeHtml(s.updatedAt.slice(11, 19))} UTC</div>
      </button>`;
    })
    .join('');
}

function renderWarnings(): void {
  const warningsEl = getEl<HTMLDivElement>('parse-warnings');
  if (!warningsEl) return;
  if (state.warnings.length === 0) {
    warningsEl.classList.add('hidden');
    warningsEl.textContent = '';
    return;
  }
  warningsEl.classList.remove('hidden');
  warningsEl.innerHTML = state.warnings
    .map((warning) => `<div>⚠️ ${escapeHtml(warning)}</div>`)
    .join('');
}

function renderHistoryDrawer(): void {
  const countEl = getEl<HTMLSpanElement>('saved-count');
  const listEl = getEl<HTMLDivElement>('history-list');
  const entries = loadSavedFlows();
  if (countEl) {
    countEl.textContent = String(entries.length);
  }
  if (!listEl) return;

  if (entries.length === 0) {
    listEl.innerHTML = `<p class="viz-muted">${t('viz.rt.noSavedFlows')}</p>`;
    return;
  }

  listEl.innerHTML = entries
    .map(
      (entry: SavedFlowEntry) => `
      <div class="viz-history-item" data-entry-id="${escapeHtml(entry.id)}">
        <div style="font-family:var(--font-display);font-weight:800;">${escapeHtml(entry.flow.title)}</div>
        <div class="viz-muted-sm">
          ${escapeHtml(entry.flow.platform.toUpperCase())} • ${escapeHtml(t('viz.rt.turnsCount', { n: entry.flow.turns.length }))} • ${escapeHtml(entry.savedAt.slice(0, 16).replace('T', ' '))}
        </div>
        <div class="viz-btn-group">
          <button type="button" class="clay-btn viz-btn-sm" data-action="load-entry" data-id="${escapeHtml(entry.id)}">${escapeHtml(t('viz.rt.loadBtn'))}</button>
          <button type="button" class="clay-btn viz-btn-sm viz-btn-danger" data-action="delete-entry" data-id="${escapeHtml(entry.id)}">${escapeHtml(t('viz.rt.deleteBtn'))}</button>
        </div>
      </div>`
    )
    .join('');
}

function getFilteredTurns(flow: ConversationFlow): readonly ConversationTurn[] {
  if (state.deltaFilter === 'all') {
    return flow.turns;
  }
  return flow.turns.filter((turn) => turn.delta === state.deltaFilter);
}

function formatLocalizedFocus(focus: FocusStatus): string {
  switch (focus) {
    case 'on-topic':
      return t('viz.rt.focusOnTopic');
    case 'adjacent':
      return t('viz.rt.focusAdjacent');
    case 'off-topic':
      return t('viz.rt.focusOffTopic');
  }
}

function renderParkingLot(flow: ConversationFlow): void {
  const card = getEl<HTMLElement>('parking-lot-card');
  const list = getEl<HTMLDivElement>('parking-lot-list');
  if (!card || !list) return;

  const parked =
    flow.parkedTopics && flow.parkedTopics.length > 0
      ? flow.parkedTopics
      : collectParkedTopics(flow.turns);

  if (parked.length === 0) {
    card.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  card.classList.remove('hidden');
  list.innerHTML = parked
    .map(
      (topic) => `<div class="viz-parking-item">
        <span class="viz-parking-topic">${escapeHtml(topic)}</span>
        <button
          type="button"
          class="clay-btn viz-btn-sm"
          data-parked-topic="${escapeHtml(topic)}"
        >${escapeHtml(t('viz.parking.copyBtn'))}</button>
      </div>`
    )
    .join('');
}

function renderMissionSummary(flow: ConversationFlow): void {
  const pillsEl = getEl<HTMLDivElement>('flow-meta-pills');
  const titleInput = getEl<HTMLInputElement>('flow-title-input');
  const goalInput = getEl<HTMLTextAreaElement>('overall-goal-input');
  const outcomeInput = getEl<HTMLTextAreaElement>('final-outcome-input');
  const filterRow = getEl<HTMLDivElement>('delta-filters');

  if (pillsEl) {
    const modeLabel =
      flow.parseMode === 'flow-contract'
        ? t('viz.rt.modeFlowContract')
        : flow.parseMode === 'structured-json'
          ? t('viz.rt.modeStructuredJson')
          : flow.parseMode === 'live-transcript'
            ? t('viz.rt.modeLiveTranscript')
            : flow.parseMode === 'mcp-live'
              ? t('viz.rt.modeMcpLive')
              : t('viz.rt.modeHeuristic');
    const sessionTopicTag = flow.sessionTopic
      ? `<span class="clay-badge">${escapeHtml(t('viz.rt.sessionTopicBadge', { topic: flow.sessionTopic }))}</span>`
      : '';
    const liveTag = flow.isStreaming
      ? `<span class="viz-delta-badge viz-delta-pivoted">${escapeHtml(t('viz.rt.liveUpdating'))}</span>`
      : '';
    pillsEl.innerHTML = [
      `<span class="clay-badge">${escapeHtml(flow.platform.toUpperCase())}</span>`,
      `<span class="clay-badge">${escapeHtml(t('viz.rt.turnsCountCap', { n: flow.turns.length }))}</span>`,
      `<span class="clay-badge">${escapeHtml(modeLabel)}</span>`,
      sessionTopicTag,
      liveTag,
    ].join('');
  }

  if (titleInput && titleInput.value !== flow.title) {
    titleInput.value = flow.title;
  }
  if (goalInput && goalInput.value !== flow.overallGoal) {
    goalInput.value = flow.overallGoal;
  }
  if (outcomeInput && outcomeInput.value !== flow.finalOutcome) {
    outcomeInput.value = flow.finalOutcome;
  }

  if (filterRow) {
    const counts: Record<DeltaStatus, number> = {
      matched: 0,
      expanded: 0,
      pivoted: 0,
      partial: 0,
      pending: 0,
    };
    for (const turn of flow.turns) {
      counts[turn.delta] += 1;
    }

    const filters: ReadonlyArray<{ readonly key: DeltaStatus | 'all'; readonly label: string }> = [
      { key: 'all', label: t('viz.rt.filterAll', { n: flow.turns.length }) },
      { key: 'matched', label: t('viz.rt.filterMatched', { n: counts.matched }) },
      { key: 'expanded', label: t('viz.rt.filterExpanded', { n: counts.expanded }) },
      { key: 'pivoted', label: t('viz.rt.filterPivoted', { n: counts.pivoted }) },
      { key: 'partial', label: t('viz.rt.filterPartial', { n: counts.partial }) },
      { key: 'pending', label: t('viz.rt.filterPending', { n: counts.pending }) },
    ];

    filterRow.innerHTML = filters
      .map(
        (item) =>
          `<button type="button" class="viz-filter-pill ${state.deltaFilter === item.key ? 'active' : ''}" data-filter="${item.key}">${escapeHtml(item.label)}</button>`
      )
      .join('');
  }
}

function renderFlowMap(flow: ConversationFlow): void {
  const listEl = getEl<HTMLDivElement>('flow-map-list');
  if (!listEl) return;

  const visibleTurns = getFilteredTurns(flow);
  if (visibleTurns.length === 0) {
    listEl.innerHTML = `<p class="viz-muted">${t('viz.rt.noTurnsMatchFilter')}</p>`;
    return;
  }

  const parts: string[] = [];
  visibleTurns.forEach((turn, idx) => {
    if (idx > 0) {
      parts.push(
        `<div class="viz-connector" aria-hidden="true">
          <span class="viz-connector-line"></span>
          <span>↓ ${escapeHtml(turn.relation)}</span>
        </div>`
      );
    }

    const active = turn.id === state.selectedTurnId;
    const extrasLabel = turn.extras.length > 0 ? ` +${turn.extras.length}` : '';
    const promptPreview = turn.rawUserMessage.replace(/\s+/g, ' ').trim();
    const deltaLabel = turn.isStreaming
      ? t('viz.rt.statusRunningEllipsis')
      : `${formatDeltaLabel(turn.delta)}${extrasLabel}`;
    const focusBadge = turn.focusStatus
      ? `<span class="viz-delta-badge viz-focus-${turn.focusStatus}">${escapeHtml(formatLocalizedFocus(turn.focusStatus))}</span>`
      : '';

    parts.push(
      `<button
        type="button"
        role="option"
        aria-selected="${active ? 'true' : 'false'}"
        class="viz-node-btn ${active ? 'active' : ''}"
        data-turn-id="${escapeHtml(turn.id)}"
      >
        <div class="viz-node-top">
          <span class="viz-node-title">#${turn.index} ${escapeHtml(turn.title)}</span>
          <div class="viz-pill-row" style="margin:0;">
            ${focusBadge}
            <span class="viz-delta-badge viz-delta-${turn.delta}">
              ${escapeHtml(deltaLabel)}
            </span>
          </div>
        </div>
        <div class="viz-node-prompt">“${escapeHtml(promptPreview)}”</div>
        <div class="viz-muted-sm">
          ${escapeHtml(turn.contractDetected ? t('viz.rt.tagContract') : t('viz.rt.tagHeuristic'))} • ${escapeHtml(turn.relation)}
        </div>
      </button>`
    );
  });

  listEl.innerHTML = parts.join('');
  if (listEl.scrollHeight > listEl.clientHeight) {
    const activeNode = listEl.querySelector<HTMLButtonElement>('.viz-node-btn.active');
    activeNode?.scrollIntoView({ block: 'nearest' });
  }
}

function renderTurnInspector(flow: ConversationFlow): void {
  const inspector = getEl<HTMLDivElement>('turn-inspector');
  if (!inspector) return;

  const selectedTurn =
    flow.turns.find((turn) => turn.id === state.selectedTurnId) ??
    flow.turns[0] ??
    null;

  if (!selectedTurn) {
    inspector.innerHTML = `<p class="viz-muted">${escapeHtml(t('viz.rt.noTurnSelected'))}</p>`;
    return;
  }

  if (state.isEditingTurn) {
    inspector.innerHTML = `
      <div class="viz-inspector-head">
        <div>
          <span class="clay-badge">${escapeHtml(t('viz.rt.editingTurnBadge', { index: selectedTurn.index }))}</span>
          <h2 class="viz-h2" style="margin-top:8px;">${escapeHtml(t('viz.rt.editTurnHeading'))}</h2>
        </div>
        <div class="viz-btn-group">
          <button type="button" class="clay-btn viz-btn-sm viz-btn-primary" id="btn-save-turn-edit">${escapeHtml(t('viz.rt.applyChangesBtn'))}</button>
          <button type="button" class="clay-btn viz-btn-sm" id="btn-cancel-turn-edit">${escapeHtml(t('viz.rt.cancelBtn'))}</button>
        </div>
      </div>
      <form id="turn-edit-form" class="viz-edit-form">
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldTurnTitle'))}</span>
          <input name="title" type="text" class="viz-inline-area" value="${escapeHtml(selectedTurn.title)}" />
        </label>
        <div class="viz-compare-grid" style="margin:0;">
          <label>
            <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldRelation'))}</span>
            <select name="relation" class="viz-select" style="width:100%;">
              ${(['initial', 'follow-up', 'clarification', 'research-detour', 'pivot', 'refinement'] as const)
                .map(
                  (rel) =>
                    `<option value="${rel}" ${selectedTurn.relation === rel ? 'selected' : ''}>${escapeHtml(rel)}</option>`
                )
                .join('')}
            </select>
          </label>
          <label>
            <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldDelta'))}</span>
            <select name="delta" class="viz-select" style="width:100%;">
              ${(['matched', 'expanded', 'pivoted', 'partial', 'pending'] as const)
                .map(
                  (d) =>
                    `<option value="${d}" ${selectedTurn.delta === d ? 'selected' : ''}>${escapeHtml(formatDeltaLabel(d))}</option>`
                )
                .join('')}
            </select>
          </label>
          <label>
            <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldFocus'))}</span>
            <select name="focusStatus" class="viz-select" style="width:100%;">
              <option value="" ${!selectedTurn.focusStatus ? 'selected' : ''}>${escapeHtml(t('viz.rt.fieldFocusUnset'))}</option>
              ${(['on-topic', 'adjacent', 'off-topic'] as const)
                .map(
                  (f) =>
                    `<option value="${f}" ${selectedTurn.focusStatus === f ? 'selected' : ''}>${escapeHtml(formatLocalizedFocus(f))}</option>`
                )
                .join('')}
            </select>
          </label>
        </div>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldRawPrompt'))}</span>
          <textarea name="rawUserMessage" class="viz-inline-area" rows="3">${escapeHtml(selectedTurn.rawUserMessage)}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldIntent'))}</span>
          <textarea name="intent" class="viz-inline-area" rows="2">${escapeHtml(selectedTurn.intent)}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldInputSummary'))}</span>
          <textarea name="inputSummary" class="viz-inline-area" rows="2">${escapeHtml(selectedTurn.inputSummary)}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldExpected'))}</span>
          <textarea name="expectedOutput" class="viz-inline-area" rows="3">${escapeHtml(selectedTurn.expectedOutput)}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldActual'))}</span>
          <textarea name="actualOutput" class="viz-inline-area" rows="3">${escapeHtml(selectedTurn.actualOutput)}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldDeltaNote'))}</span>
          <textarea name="deltaNote" class="viz-inline-area" rows="2">${escapeHtml(selectedTurn.deltaNote)}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldExtras'))}</span>
          <textarea name="extras" class="viz-inline-area" rows="3">${escapeHtml(selectedTurn.extras.join('\n'))}</textarea>
        </label>
        <label>
          <span class="viz-sub-label">${escapeHtml(t('viz.rt.fieldParked'))}</span>
          <textarea name="parkedTopics" class="viz-inline-area" rows="2">${escapeHtml((selectedTurn.parkedTopics ?? []).join('\n'))}</textarea>
        </label>
      </form>
    `;
    return;
  }

  const extrasSection =
    selectedTurn.extras.length > 0
      ? `<div class="viz-extras-card">
          <div class="viz-sub-label">${escapeHtml(t('viz.rt.extrasHeading', { n: selectedTurn.extras.length }))}</div>
          <ul class="viz-extras-list">
            ${selectedTurn.extras.map((ex) => `<li>${escapeHtml(ex)}</li>`).join('')}
          </ul>
        </div>`
      : '';

  const parkedTurnSection =
    selectedTurn.parkedTopics && selectedTurn.parkedTopics.length > 0
      ? `<div class="viz-raw-box" style="background:var(--status-warn-bg);color:var(--status-warn-fg);">
          <div class="viz-sub-label" style="color:inherit;">${escapeHtml(t('viz.rt.parkedHeading', { n: selectedTurn.parkedTopics.length }))}</div>
          <ul class="viz-extras-list">
            ${selectedTurn.parkedTopics.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>`
      : '';

  const focusPill = selectedTurn.focusStatus
    ? `<span class="viz-delta-badge viz-focus-${selectedTurn.focusStatus}">${escapeHtml(formatLocalizedFocus(selectedTurn.focusStatus))}</span>`
    : '';
  const scopePill = selectedTurn.scopeSize
    ? `<span class="clay-badge">${escapeHtml(t('viz.rt.scopeLabel', { scope: formatScopeLabel(selectedTurn.scopeSize) }))}</span>`
    : '';

  const toolSummarySection = selectedTurn.toolSummary
    ? `<div class="viz-raw-box" style="background:var(--color-expected-bg);">
        <span class="viz-sub-label">${escapeHtml(t('viz.rt.toolsExecuted'))}</span>
        <div style="color:var(--color-text-secondary);font-size:0.9rem;">${escapeHtml(selectedTurn.toolSummary)}</div>
      </div>`
    : '';

  const rawAssistantSection = selectedTurn.rawAssistantMessage
    ? `<details style="margin-top:10px;">
        <summary style="cursor:pointer;font-weight:700;color:var(--color-text-secondary);">
          ${escapeHtml(t('viz.rt.viewRawReply'))}
        </summary>
        <div class="viz-raw-box" style="margin-top:10px;">
          <pre class="viz-raw-pre">${escapeHtml(selectedTurn.rawAssistantMessage)}</pre>
        </div>
      </details>`
    : '';

  const deleteButtonHtml =
    flow.turns.length > 1
      ? `<button type="button" class="clay-btn viz-btn-sm viz-btn-danger" id="btn-delete-turn">${escapeHtml(t('viz.rt.deleteTurnBtn'))}</button>`
      : '';

  inspector.innerHTML = `
    <div class="viz-inspector-head">
      <div>
        <div class="viz-pill-row" style="margin-bottom:8px;">
          <span class="clay-badge">${escapeHtml(t('viz.rt.turnBadge', { index: selectedTurn.index }))}</span>
          <span class="clay-badge">${escapeHtml(selectedTurn.relation)}</span>
          ${focusPill}
          ${scopePill}
          <span class="viz-delta-badge viz-delta-${selectedTurn.delta}">
            ${escapeHtml(formatDeltaLabel(selectedTurn.delta))}${selectedTurn.extras.length > 0 ? ` (+${selectedTurn.extras.length})` : ''}
          </span>
        </div>
        <h2 class="viz-h2">${escapeHtml(selectedTurn.title)}</h2>
      </div>
      <div class="viz-btn-group">
        <button type="button" class="clay-btn viz-btn-sm" id="btn-edit-turn">${escapeHtml(t('viz.rt.editTurnBtn'))}</button>
        ${deleteButtonHtml}
      </div>
    </div>

    <div class="viz-raw-box">
      <div class="viz-drawer-head" style="align-items:center;">
        <span class="viz-sub-label" style="margin:0;">${escapeHtml(t('viz.rt.verbatimPromptLabel'))}</span>
        <div class="viz-btn-group">
          <button type="button" class="clay-btn viz-btn-sm" id="btn-toggle-raw-prompt">
            ${escapeHtml(state.isPromptExpanded ? t('viz.rt.collapseBtn') : t('viz.rt.expandBtn'))}
          </button>
          <button type="button" class="clay-btn viz-btn-sm" id="btn-copy-raw-prompt">
            ${escapeHtml(t('viz.rt.copyPromptBtn'))}
          </button>
        </div>
      </div>
      <pre class="viz-raw-pre ${state.isPromptExpanded ? '' : 'clamped'}">${escapeHtml(selectedTurn.rawUserMessage)}</pre>
    </div>

    <div class="viz-raw-box" style="background:var(--color-surface);border:1px solid var(--color-border-subtle);">
      <div style="margin-bottom:8px;">
        <span class="viz-sub-label">${escapeHtml(t('viz.rt.intentLabel'))}</span>
        <div>${escapeHtml(selectedTurn.intent)}</div>
      </div>
      <div>
        <span class="viz-sub-label">${escapeHtml(t('viz.rt.inputsLabel'))}</span>
        <div style="color:var(--color-text-secondary);">${escapeHtml(selectedTurn.inputSummary)}</div>
      </div>
    </div>

    ${toolSummarySection}

    <div class="viz-compare-grid">
      <div class="viz-compare-card expected">
        <div class="viz-sub-label">${escapeHtml(t('viz.rt.expectedLabel'))}</div>
        <div>${escapeHtml(selectedTurn.expectedOutput)}</div>
      </div>
      <div class="viz-compare-card actual">
        <div class="viz-sub-label">${escapeHtml(t('viz.rt.actualLabel'))}</div>
        <div>${escapeHtml(selectedTurn.actualOutput)}</div>
      </div>
    </div>

    ${
      selectedTurn.deltaNote
        ? `<div class="viz-raw-box" style="background:var(--status-warn-bg);">
            <span class="viz-sub-label">${escapeHtml(t('viz.rt.deltaNoteLabel'))}</span>
            <div>${escapeHtml(selectedTurn.deltaNote)}</div>
          </div>`
        : ''
    }

    ${extrasSection}
    ${parkedTurnSection}
    ${rawAssistantSection}
  `;
}

function renderAll(): void {
  renderDesktopLiveBar();
  renderWarnings();
  renderHistoryDrawer();

  const intakeBody = getEl<HTMLDivElement>('intake-body');
  const intakeToggle = getEl<HTMLButtonElement>('btn-toggle-intake');
  if (intakeBody && intakeToggle) {
    intakeBody.classList.toggle('hidden', state.isIntakeCollapsed);
    intakeToggle.textContent = state.isIntakeCollapsed
      ? t('viz.intake.expand')
      : t('viz.intake.collapse');
  }

  const workspace = getEl<HTMLElement>('workspace-section');
  if (!workspace) return;

  if (!state.flow || state.flow.turns.length === 0) {
    workspace.classList.add('hidden');
    getEl<HTMLElement>('parking-lot-card')?.classList.add('hidden');
    return;
  }

  workspace.classList.remove('hidden');
  renderMissionSummary(state.flow);
  renderParkingLot(state.flow);
  renderFlowMap(state.flow);
  renderTurnInspector(state.flow);
}

function applyFlowLive(flow: ConversationFlow, sessionId: string): void {
  if (state.isEditingTurn && state.activeDesktopSessionId === sessionId) {
    return;
  }
  const prevTurnCount = state.flow?.turns.length ?? 0;
  const wasOnLatestTurn = Boolean(
    state.flow &&
      state.selectedTurnId === state.flow.turns[state.flow.turns.length - 1]?.id
  );
  const switchedSession = state.activeDesktopSessionId !== sessionId;

  state.activeDesktopSessionId = sessionId;
  state.flow = flow;
  state.warnings = [];
  state.isIntakeCollapsed = true;
  state.isEditingTurn = false;

  if (
    switchedSession ||
    !state.selectedTurnId ||
    !flow.turns.some((turn) => turn.id === state.selectedTurnId) ||
    (wasOnLatestTurn && flow.turns.length > prevTurnCount)
  ) {
    state.selectedTurnId = flow.turns[flow.turns.length - 1]?.id ?? null;
  }

  renderAll();
}

async function fetchDesktopSession(sessionId: string): Promise<void> {
  try {
    const res = await fetch(
      `${getDesktopApiBase()}/api/sessions/${encodeURIComponent(sessionId)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      readonly session?: DesktopSessionSummary;
      readonly flow?: ConversationFlow;
    };
    if (data.flow && Array.isArray(data.flow.turns)) {
      applyFlowLive(data.flow, sessionId);
    }
  } catch {
    // Ignore transient network errors
  }
}

async function refreshDesktopSessions(selectLatestIfNeeded: boolean): Promise<void> {
  try {
    const res = await fetch(`${getDesktopApiBase()}/api/sessions`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      readonly sessions?: readonly DesktopSessionSummary[];
    };
    if (!Array.isArray(data.sessions)) return;

    state.desktopSessions = data.sessions;
    renderDesktopLiveBar();

    if (
      selectLatestIfNeeded &&
      state.autoFollowDesktop &&
      data.sessions[0] &&
      (!state.activeDesktopSessionId ||
        data.sessions[0].id !== state.activeDesktopSessionId)
    ) {
      await fetchDesktopSession(data.sessions[0].id);
    }
  } catch {
    // Ignore transient errors
  }
}

async function connectDesktopBridge(): Promise<void> {
  const base = getDesktopApiBase();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok) return;
    state.desktopBridgeOnline = true;
  } catch {
    window.clearTimeout(timer);
    return;
  }

  const shouldAutoLoad = !state.flow && !window.location.hash.startsWith('#flow=');
  await refreshDesktopSessions(shouldAutoLoad);

  const es = new EventSource(`${base}/api/events`);
  es.addEventListener('sessions', (evt: MessageEvent) => {
    try {
      const payload = JSON.parse(String(evt.data)) as {
        readonly sessions?: readonly DesktopSessionSummary[];
      };
      if (!Array.isArray(payload.sessions)) return;
      state.desktopSessions = payload.sessions;
      renderDesktopLiveBar();

      const top = payload.sessions[0];
      if (
        state.autoFollowDesktop &&
        top &&
        top.id !== state.activeDesktopSessionId
      ) {
        void fetchDesktopSession(top.id);
      }
    } catch {
      // Ignore malformed SSE payload
    }
  });

  es.addEventListener('flow', (evt: MessageEvent) => {
    try {
      const payload = JSON.parse(String(evt.data)) as {
        readonly session?: DesktopSessionSummary;
        readonly flow?: ConversationFlow;
      };
      if (!payload.session || !payload.flow) return;
      const incomingId = payload.session.id;
      const shouldApply =
        incomingId === state.activeDesktopSessionId ||
        (state.autoFollowDesktop &&
          (!state.flow || payload.session.isStreaming));
      if (shouldApply) {
        applyFlowLive(payload.flow, incomingId);
      }
    } catch {
      // Ignore malformed SSE payload
    }
  });
}

function applyParsedInput(
  rawText: string,
  platformHint: AIPlatform,
  collapseIntake: boolean
): void {
  const result = parseConversation(rawText, platformHint);
  state.activeDesktopSessionId = null;
  state.flow = result.flow;
  state.warnings = result.warnings;
  state.selectedTurnId = result.flow.turns[0]?.id ?? null;
  state.deltaFilter = 'all';
  state.isEditingTurn = false;
  state.isPromptExpanded = false;
  state.activeSavedId = undefined;
  if (collapseIntake && result.flow.turns.length > 0) {
    state.isIntakeCollapsed = true;
  }
  renderAll();
}

function updateSelectedTurn(
  updater: (turn: ConversationTurn) => ConversationTurn
): void {
  if (!state.flow || !state.selectedTurnId) return;
  const updatedTurns = state.flow.turns.map((turn) =>
    turn.id === state.selectedTurnId ? updater(turn) : turn
  );
  const lastTurn = updatedTurns[updatedTurns.length - 1];
  state.flow = {
    ...state.flow,
    finalOutcome: lastTurn?.actualOutput || state.flow.finalOutcome,
    turns: updatedTurns,
  };
}

function bindStaticEvents(): void {
  const rawInput = getEl<HTMLTextAreaElement>('raw-input');
  const platformSelect = getEl<HTMLSelectElement>('platform-select');

  getEl<HTMLButtonElement>('btn-demo-contract')?.addEventListener('click', () => {
    const preset = SAMPLE_PRESETS[0];
    if (!preset || !rawInput || !platformSelect) return;
    const text =
      getLang() === 'vi' && preset.rawTextVi ? preset.rawTextVi : preset.rawText;
    rawInput.value = text;
    platformSelect.value = preset.platform;
    applyParsedInput(text, preset.platform, true);
    showToast(t('viz.toast.demoContractLoaded'));
  });

  getEl<HTMLButtonElement>('btn-demo-raw')?.addEventListener('click', () => {
    const preset = SAMPLE_PRESETS[1];
    if (!preset || !rawInput || !platformSelect) return;
    const text =
      getLang() === 'vi' && preset.rawTextVi ? preset.rawTextVi : preset.rawText;
    rawInput.value = text;
    platformSelect.value = preset.platform;
    applyParsedInput(text, preset.platform, true);
    showToast(t('viz.toast.demoRawLoaded'));
  });

  getEl<HTMLButtonElement>('btn-visualize')?.addEventListener('click', () => {
    if (!rawInput || !platformSelect) return;
    applyParsedInput(
      rawInput.value,
      platformSelect.value as AIPlatform,
      true
    );
  });

  getEl<HTMLButtonElement>('btn-copy-analyzer')?.addEventListener('click', () => {
    const text =
      rawInput && rawInput.value.trim().length > 0
        ? rawInput.value
        : state.flow
          ? state.flow.turns
              .map(
                (turn) =>
                  `User:\n${turn.rawUserMessage}\n\nAssistant:\n${turn.rawAssistantMessage || turn.actualOutput}`
              )
              .join('\n\n')
          : '';
    if (!text.trim()) {
      showToast(t('viz.toast.pasteFirst'));
      return;
    }
    const hint = (platformSelect?.value as AIPlatform | undefined) ?? 'generic';
    const prompt = buildAnalyzerPrompt(text, hint);
    void copyText(prompt, t('viz.toast.analyzerCopied'));
  });

  getEl<HTMLButtonElement>('btn-clear-input')?.addEventListener('click', () => {
    if (rawInput) rawInput.value = '';
    state.activeDesktopSessionId = null;
    state.flow = null;
    state.warnings = [];
    state.selectedTurnId = null;
    state.isIntakeCollapsed = false;
    renderAll();
  });

  getEl<HTMLButtonElement>('btn-toggle-intake')?.addEventListener('click', () => {
    state.isIntakeCollapsed = !state.isIntakeCollapsed;
    renderAll();
  });

  // Desktop Live Bar events
  getEl<HTMLInputElement>('chk-auto-follow')?.addEventListener('change', (e) => {
    state.autoFollowDesktop = (e.target as HTMLInputElement).checked;
  });
  getEl<HTMLButtonElement>('btn-refresh-desktop')?.addEventListener('click', () => {
    void refreshDesktopSessions(false).then(() => {
      if (state.activeDesktopSessionId) {
        return fetchDesktopSession(state.activeDesktopSessionId);
      }
      return undefined;
    });
    showToast(t('viz.toast.desktopRefreshed'));
  });
  getEl<HTMLDivElement>('desktop-sessions-list')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-session-id]');
    if (!btn || !btn.dataset.sessionId) return;
    void fetchDesktopSession(btn.dataset.sessionId);
  });

  // Mission Summary edits
  getEl<HTMLInputElement>('flow-title-input')?.addEventListener('input', (e) => {
    if (!state.flow) return;
    state.flow = {
      ...state.flow,
      title: (e.target as HTMLInputElement).value,
    };
  });

  getEl<HTMLTextAreaElement>('overall-goal-input')?.addEventListener('input', (e) => {
    if (!state.flow) return;
    state.flow = {
      ...state.flow,
      overallGoal: (e.target as HTMLTextAreaElement).value,
    };
  });

  getEl<HTMLTextAreaElement>('final-outcome-input')?.addEventListener('input', (e) => {
    if (!state.flow) return;
    state.flow = {
      ...state.flow,
      finalOutcome: (e.target as HTMLTextAreaElement).value,
    };
  });

  // Delta filter pills
  getEl<HTMLDivElement>('delta-filters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!btn || !state.flow) return;
    const key = btn.dataset.filter as DeltaStatus | 'all' | undefined;
    if (!key) return;
    state.deltaFilter = key;
    const filtered = getFilteredTurns(state.flow);
    if (filtered.length > 0 && !filtered.some((turn) => turn.id === state.selectedTurnId)) {
      state.selectedTurnId = filtered[0]?.id ?? null;
    }
    renderAll();
  });

  // Parking lot copy kickoff prompt
  getEl<HTMLDivElement>('parking-lot-list')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-parked-topic]');
    const topic = btn?.dataset.parkedTopic;
    if (!topic) return;
    const promptText = buildParkedFollowUpPrompt(topic, state.flow?.sessionTopic);
    void copyText(promptText, t('viz.toast.parkedPromptCopied', { topic }));
  });

  // Flow map turn clicks & keyboard navigation
  const flowList = getEl<HTMLDivElement>('flow-map-list');
  flowList?.addEventListener('click', (e) => {
    const node = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-turn-id]');
    if (!node || !node.dataset.turnId) return;
    state.selectedTurnId = node.dataset.turnId;
    state.isEditingTurn = false;
    state.isPromptExpanded = false;
    renderAll();
  });

  flowList?.addEventListener('keydown', (e) => {
    if (!state.flow || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const visible = getFilteredTurns(state.flow);
    const currentIdx = visible.findIndex((turn) => turn.id === state.selectedTurnId);
    if (currentIdx === -1) return;
    const nextIdx =
      e.key === 'ArrowDown'
        ? Math.min(visible.length - 1, currentIdx + 1)
        : Math.max(0, currentIdx - 1);
    const nextTurn = visible[nextIdx];
    if (nextTurn) {
      state.selectedTurnId = nextTurn.id;
      state.isEditingTurn = false;
      renderAll();
    }
  });

  getEl<HTMLButtonElement>('btn-add-turn')?.addEventListener('click', () => {
    if (!state.flow) return;
    const nextIndex = state.flow.turns.length + 1;
    const newTurn: ConversationTurn = {
      id: `turn-${Date.now().toString(36)}`,
      index: nextIndex,
      title: t('viz.rt.newTurnTitle', { index: nextIndex }),
      relation: 'follow-up',
      rawUserMessage: t('viz.rt.newTurnPrompt'),
      rawAssistantMessage: '',
      intent: t('viz.rt.newTurnIntent'),
      inputSummary: t('viz.rt.newTurnInput'),
      expectedOutput: t('viz.rt.newTurnExpected'),
      actualOutput: t('viz.rt.newTurnActual'),
      delta: 'pending',
      deltaNote: '',
      extras: [],
      contractDetected: false,
      isStreaming: false,
    };
    state.flow = {
      ...state.flow,
      turns: [...state.flow.turns, newTurn],
    };
    state.selectedTurnId = newTurn.id;
    state.deltaFilter = 'all';
    state.isEditingTurn = true;
    renderAll();
  });

  // Inspector delegated clicks
  getEl<HTMLDivElement>('turn-inspector')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>('button');
    if (!btn || !state.flow) return;

    if (btn.id === 'btn-edit-turn') {
      state.isEditingTurn = true;
      renderAll();
      return;
    }

    if (btn.id === 'btn-cancel-turn-edit') {
      state.isEditingTurn = false;
      renderAll();
      return;
    }

    if (btn.id === 'btn-save-turn-edit') {
      const form = getEl<HTMLFormElement>('turn-edit-form');
      if (!form) return;
      const fd = new FormData(form);
      const extrasRaw = String(fd.get('extras') ?? '');
      const extras = extrasRaw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const parkedRaw = String(fd.get('parkedTopics') ?? '');
      const parkedTopics = parkedRaw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const focusStatus = normalizeFocusStatus(String(fd.get('focusStatus') ?? ''));

      updateSelectedTurn((turn) => ({
        ...turn,
        title: String(fd.get('title') ?? turn.title).trim() || turn.title,
        relation: String(fd.get('relation') ?? turn.relation) as TurnRelation,
        delta: String(fd.get('delta') ?? turn.delta) as DeltaStatus,
        focusStatus,
        rawUserMessage: String(fd.get('rawUserMessage') ?? turn.rawUserMessage),
        intent: String(fd.get('intent') ?? turn.intent).trim(),
        inputSummary: String(fd.get('inputSummary') ?? turn.inputSummary).trim(),
        expectedOutput: String(fd.get('expectedOutput') ?? turn.expectedOutput).trim(),
        actualOutput: String(fd.get('actualOutput') ?? turn.actualOutput).trim(),
        deltaNote: String(fd.get('deltaNote') ?? turn.deltaNote).trim(),
        extras,
        ...(parkedTopics.length > 0 ? { parkedTopics } : { parkedTopics: undefined }),
      }));
      if (state.flow) {
        const mergedParked = collectParkedTopics(state.flow.turns);
        state.flow = {
          ...state.flow,
          parkedTopics: mergedParked.length > 0 ? mergedParked : undefined,
        };
      }
      state.isEditingTurn = false;
      renderAll();
      showToast(t('viz.toast.turnUpdated'));
      return;
    }

    if (btn.id === 'btn-delete-turn') {
      if (state.flow.turns.length <= 1 || !state.selectedTurnId) return;
      const remaining = state.flow.turns
        .filter((turn) => turn.id !== state.selectedTurnId)
        .map((turn, i) => ({ ...turn, index: i + 1 }));
      const mergedParked = collectParkedTopics(remaining);
      state.flow = {
        ...state.flow,
        parkedTopics: mergedParked.length > 0 ? mergedParked : undefined,
        turns: remaining,
      };
      state.selectedTurnId = remaining[0]?.id ?? null;
      state.isEditingTurn = false;
      renderAll();
      showToast(t('viz.toast.turnRemoved'));
      return;
    }

    if (btn.id === 'btn-toggle-raw-prompt') {
      state.isPromptExpanded = !state.isPromptExpanded;
      renderTurnInspector(state.flow);
      return;
    }

    if (btn.id === 'btn-copy-raw-prompt') {
      const turn = state.flow.turns.find((item) => item.id === state.selectedTurnId);
      if (turn) {
        void copyText(turn.rawUserMessage, t('viz.toast.promptCopied'));
      }
    }
  });

  // Export & Local Save buttons
  getEl<HTMLButtonElement>('btn-export-html')?.addEventListener('click', () => {
    if (!state.flow) return;
    const html = exportFlowAsStandaloneHtml(state.flow);
    downloadFile(html, `${slugifyTitle(state.flow.title)}.html`, 'text/html;charset=utf-8');
    showToast(t('viz.toast.exportedHtml'));
  });

  getEl<HTMLButtonElement>('btn-copy-md')?.addEventListener('click', () => {
    if (!state.flow) return;
    void copyText(exportFlowAsMarkdown(state.flow), t('viz.toast.copiedMd'));
  });

  getEl<HTMLButtonElement>('btn-export-json')?.addEventListener('click', () => {
    if (!state.flow) return;
    downloadFile(
      exportFlowAsJson(state.flow),
      `${slugifyTitle(state.flow.title)}.flow.local.json`,
      'application/json;charset=utf-8'
    );
    showToast(t('viz.toast.exportedJson'));
  });

  getEl<HTMLButtonElement>('btn-save-local')?.addEventListener('click', () => {
    if (!state.flow) return;
    const saved = saveFlowEntry(state.flow, state.activeSavedId);
    state.activeSavedId = saved[0]?.id;
    renderHistoryDrawer();
    showToast(t('viz.toast.savedLocal'));
  });

  // Local History Drawer
  const historyDrawer = getEl<HTMLElement>('history-drawer');
  getEl<HTMLButtonElement>('btn-toggle-history')?.addEventListener('click', () => {
    historyDrawer?.classList.toggle('hidden');
  });
  getEl<HTMLButtonElement>('btn-close-history')?.addEventListener('click', () => {
    historyDrawer?.classList.add('hidden');
  });
  getEl<HTMLButtonElement>('btn-clear-history')?.addEventListener('click', () => {
    clearAllSavedFlows();
    state.activeSavedId = undefined;
    renderHistoryDrawer();
    showToast(t('viz.toast.clearedHistory'));
  });
  getEl<HTMLDivElement>('history-list')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (btn.dataset.action === 'delete-entry') {
      deleteFlowEntry(id);
      if (state.activeSavedId === id) state.activeSavedId = undefined;
      renderHistoryDrawer();
      return;
    }
    if (btn.dataset.action === 'load-entry') {
      const entry = loadSavedFlows().find((item) => item.id === id);
      if (!entry) return;
      state.activeDesktopSessionId = null;
      state.flow = entry.flow;
      state.warnings = [];
      state.selectedTurnId = entry.flow.turns[0]?.id ?? null;
      state.deltaFilter = 'all';
      state.isEditingTurn = false;
      state.activeSavedId = entry.id;
      state.isIntakeCollapsed = true;
      historyDrawer?.classList.add('hidden');
      renderAll();
      showToast(t('viz.toast.loadedSavedFlow', { title: entry.flow.title }));
    }
  });

  // Rule Modal
  const ruleModal = getEl<HTMLDialogElement>('rule-modal');
  const rulePreview = getEl<HTMLPreElement>('rule-snippet-preview');
  if (rulePreview) {
    rulePreview.textContent = getAdaptiveRuleSnippet();
  }
  getEl<HTMLButtonElement>('btn-open-rule-modal')?.addEventListener('click', () => {
    ruleModal?.showModal();
  });
  getEl<HTMLButtonElement>('btn-close-rule-modal')?.addEventListener('click', () => {
    ruleModal?.close();
  });
  getEl<HTMLButtonElement>('btn-copy-rule-snippet')?.addEventListener('click', () => {
    void copyText(
      getAdaptiveRuleSnippet(),
      t('viz.toast.ruleCopied')
    );
  });

  // Desktop Setup Modal
  const desktopModal = getEl<HTMLDialogElement>('desktop-modal');
  const claudeMcpPreview = getEl<HTMLPreElement>('claude-mcp-preview');
  const agyMcpPreview = getEl<HTMLPreElement>('agy-mcp-preview');
  const mcpSnippet = getMcpConfigSnippet();
  if (claudeMcpPreview) claudeMcpPreview.textContent = mcpSnippet;
  if (agyMcpPreview) agyMcpPreview.textContent = mcpSnippet;

  getEl<HTMLButtonElement>('btn-open-desktop-modal')?.addEventListener('click', () => {
    desktopModal?.showModal();
  });
  getEl<HTMLButtonElement>('btn-close-desktop-modal')?.addEventListener('click', () => {
    desktopModal?.close();
  });
  getEl<HTMLButtonElement>('btn-copy-claude-mcp')?.addEventListener('click', () => {
    void copyText(
      mcpSnippet,
      t('viz.toast.claudeMcpCopied')
    );
  });
  getEl<HTMLButtonElement>('btn-copy-claude-instructions')?.addEventListener('click', () => {
    void copyText(
      getClaudeDesktopInstructionSnippet(),
      t('viz.toast.claudeInstCopied')
    );
  });
  getEl<HTMLButtonElement>('btn-copy-agy-mcp')?.addEventListener('click', () => {
    void copyText(
      mcpSnippet,
      t('viz.toast.agyMcpCopied')
    );
  });
}

async function importFromUrlHashIfPresent(): Promise<void> {
  if (!window.location.hash.startsWith('#flow=')) {
    return;
  }
  const imported = await decodeFlowFromHash(window.location.hash);
  if (!imported) {
    showToast(t('viz.toast.hashDecodeFailed'));
    return;
  }
  state.flow = imported;
  state.warnings = [];
  state.selectedTurnId = imported.turns[0]?.id ?? null;
  state.deltaFilter = 'all';
  state.isIntakeCollapsed = true;
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  );
  renderAll();
  showToast(
    t('viz.toast.hashImported', {
      platform: imported.platform.toUpperCase(),
    })
  );
}

async function init(): Promise<void> {
  bindStaticEvents();
  onLangChange((lang) => {
    const rawInput = getEl<HTMLTextAreaElement>('raw-input');
    const platformSelect = getEl<HTMLSelectElement>('platform-select');
    if (rawInput) {
      for (const preset of SAMPLE_PRESETS) {
        if (
          rawInput.value === preset.rawText ||
          (preset.rawTextVi && rawInput.value === preset.rawTextVi)
        ) {
          const nextText =
            lang === 'vi' && preset.rawTextVi ? preset.rawTextVi : preset.rawText;
          rawInput.value = nextText;
          if (platformSelect) platformSelect.value = preset.platform;
          applyParsedInput(nextText, preset.platform, state.isIntakeCollapsed);
          return;
        }
      }
    }
    renderAll();
  });
  renderAll();
  await importFromUrlHashIfPresent();
  await connectDesktopBridge();
}

void init();
