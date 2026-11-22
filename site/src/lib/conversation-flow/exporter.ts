import type { ConversationFlow, DeltaStatus } from './types';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDeltaLabel(delta: DeltaStatus): string {
  switch (delta) {
    case 'matched':
      return 'Matched';
    case 'expanded':
      return 'Expanded';
    case 'pivoted':
      return 'Pivoted';
    case 'partial':
      return 'Partial';
    case 'pending':
      return 'Needs Review';
  }
}

export function exportFlowAsJson(flow: ConversationFlow): string {
  return JSON.stringify(flow, null, 2);
}

export function exportFlowAsMarkdown(flow: ConversationFlow): string {
  const lines: string[] = [
    `# ${flow.title}`,
    '',
    `- **Platform:** ${flow.platform}`,
    `- **Parse Mode:** ${flow.parseMode}`,
    `- **Generated:** ${flow.createdAt}`,
    `- **Turns:** ${flow.turns.length}`,
    '',
    `## Original Goal`,
    flow.overallGoal,
    '',
    `## Final Outcome`,
    flow.finalOutcome,
    '',
    `## Delta Overview`,
    '',
    `| # | Turn | Relation | Expected vs Actual | Delta |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const turn of flow.turns) {
    const cleanTitle = turn.title.replace(/\|/g, '\\|');
    const cleanExpected = turn.expectedOutput.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    const deltaText =
      turn.extras.length > 0
        ? `${formatDeltaLabel(turn.delta)} (+${turn.extras.length})`
        : formatDeltaLabel(turn.delta);
    lines.push(
      `| ${turn.index} | ${cleanTitle} | ${turn.relation} | ${cleanExpected} | ${deltaText} |`
    );
  }

  lines.push('', '## Turn-by-Turn Breakdown', '');

  for (const turn of flow.turns) {
    lines.push(
      `### Turn ${turn.index}: ${turn.title} (${formatDeltaLabel(turn.delta)})`,
      '',
      `**Transition:** \`${turn.relation}\``,
      '',
      `**Raw User Message (Verbatim):**`,
      '```text',
      turn.rawUserMessage,
      '```',
      '',
      `- **Intent:** ${turn.intent}`,
      `- **Input Summary:** ${turn.inputSummary}`,
      `- **Expected Output:** ${turn.expectedOutput}`,
      `- **Actual Output:** ${turn.actualOutput}`
    );

    if (turn.deltaNote) {
      lines.push(`- **Delta Note:** ${turn.deltaNote}`);
    }
    if (turn.toolSummary) {
      lines.push(`- **Tools Executed:** ${turn.toolSummary}`);
    }
    if (turn.extras.length > 0) {
      lines.push(`- **Extra / Bonus Findings:**`);
      for (const extra of turn.extras) {
        lines.push(`  - ${extra}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function deltaBadgeColors(delta: DeltaStatus): { readonly bg: string; readonly fg: string } {
  switch (delta) {
    case 'matched':
      return { bg: '#d4f0e8', fg: '#065f46' };
    case 'expanded':
      return { bg: '#e4dffd', fg: '#5b21b6' };
    case 'pivoted':
      return { bg: '#fde8d0', fg: '#9a3412' };
    case 'partial':
      return { bg: '#fcd5ce', fg: '#9f1239' };
    case 'pending':
      return { bg: '#d0e8fd', fg: '#075985' };
  }
}

export function exportFlowAsStandaloneHtml(flow: ConversationFlow): string {
  const safeTitle = escapeHtml(flow.title);
  const safeGoal = escapeHtml(flow.overallGoal);
  const safeOutcome = escapeHtml(flow.finalOutcome);
  const safePlatform = escapeHtml(flow.platform.toUpperCase());
  const safeDate = escapeHtml(flow.createdAt.slice(0, 10));

  const turnCardsHtml = flow.turns
    .map((turn) => {
      const colors = deltaBadgeColors(turn.delta);
      const extrasHtml =
        turn.extras.length > 0
          ? `<div class="extras-box">
               <div class="sub-label">Bonus / Extra Discoveries (${turn.extras.length})</div>
               <ul>${turn.extras.map((ex) => `<li>${escapeHtml(ex)}</li>`).join('')}</ul>
             </div>`
          : '';

      const rawAssistantHtml = turn.rawAssistantMessage
        ? `<details class="raw-assistant">
             <summary>View Raw Assistant Reply</summary>
             <pre>${escapeHtml(turn.rawAssistantMessage)}</pre>
           </details>`
        : '';

      return `<article class="turn-card" id="turn-${turn.index}">
        <div class="turn-head">
          <div class="turn-meta">
            <span class="pill idx">#${turn.index}</span>
            <span class="pill rel">${escapeHtml(turn.relation)}</span>
            <h2>${escapeHtml(turn.title)}</h2>
          </div>
          <span class="pill delta" style="background:${colors.bg};color:${colors.fg};">
            ${escapeHtml(formatDeltaLabel(turn.delta))}${turn.extras.length > 0 ? ` (+${turn.extras.length})` : ''}
          </span>
        </div>
        <div class="raw-prompt">
          <div class="sub-label">Verbatim Raw User Message</div>
          <pre>${escapeHtml(turn.rawUserMessage)}</pre>
        </div>
        <div class="intent-row">
          <div><strong>Intent:</strong> ${escapeHtml(turn.intent)}</div>
          <div><strong>Input:</strong> ${escapeHtml(turn.inputSummary)}</div>
        </div>
        <div class="compare-grid">
          <div class="compare-box expected">
            <div class="sub-label">Expected Output</div>
            <p>${escapeHtml(turn.expectedOutput)}</p>
          </div>
          <div class="compare-box actual">
            <div class="sub-label">Actual Output</div>
            <p>${escapeHtml(turn.actualOutput)}</p>
          </div>
        </div>
        ${turn.deltaNote ? `<p class="delta-note"><strong>Delta Note:</strong> ${escapeHtml(turn.deltaNote)}</p>` : ''}
        ${turn.toolSummary ? `<p class="delta-note"><strong>Tools Executed:</strong> ${escapeHtml(turn.toolSummary)}</p>` : ''}
        ${extrasHtml}
        ${rawAssistantHtml}
      </article>`;
    })
    .join('\n');

  const quickNavHtml = flow.turns
    .map(
      (turn) =>
        `<a class="nav-pill" href="#turn-${turn.index}">#${turn.index} ${escapeHtml(turn.title)}</a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — Conversation Flow Export</title>
  <style>
    :root {
      --canvas: #f0f0f8;
      --text: #2e1065;
      --text-2: #4a3080;
      --muted: #6b5f8f;
      --clay: 0 18px 36px -14px rgba(120,90,180,.22), inset 0 -6px 14px rgba(100,60,150,.12), inset 0 6px 14px rgba(255,255,255,.88);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 18px 56px;
      background: var(--canvas);
      color: var(--text);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.55;
    }
    .wrap { max-width: 1020px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }
    .hero, .turn-card {
      background: #ffffff;
      border-radius: 30px;
      padding: 24px 28px;
      box-shadow: var(--clay);
    }
    .hero { background: #e4dffd; }
    h1 { margin: 0 0 10px; font-size: 1.9rem; line-height: 1.2; }
    h2 { margin: 0; font-size: 1.18rem; }
    .badges, .quick-nav, .turn-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: #fff;
      font-size: 0.82rem;
      font-weight: 700;
      box-shadow: 0 4px 10px rgba(120,90,180,.14);
    }
    .mission-grid, .compare-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      margin-top: 14px;
    }
    .mission-box, .compare-box, .raw-prompt, .extras-box {
      background: rgba(255,255,255,.85);
      border-radius: 18px;
      padding: 14px 16px;
    }
    .compare-box.expected { background: #eef6ff; }
    .compare-box.actual { background: #edf9f5; }
    .extras-box { background: #f3f0ff; margin-top: 12px; }
    .extras-box ul { margin: 6px 0 0 18px; padding: 0; }
    .sub-label {
      font-size: 0.76rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .raw-prompt { background: #f8f7fc; margin-top: 12px; }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.88rem;
      color: var(--text);
    }
    .turn-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .intent-row { margin-top: 12px; color: var(--text-2); font-size: 0.94rem; display: flex; flex-direction: column; gap: 4px; }
    .delta-note { margin: 12px 0 0; color: var(--text-2); font-size: 0.94rem; }
    .nav-pill {
      text-decoration: none;
      color: var(--text);
      background: #fff;
      padding: 6px 12px;
      border-radius: 14px;
      font-size: 0.84rem;
      font-weight: 700;
      box-shadow: 0 4px 10px rgba(120,90,180,.15);
    }
    .raw-assistant { margin-top: 12px; }
    .raw-assistant summary { cursor: pointer; font-weight: 700; color: var(--muted); font-size: 0.88rem; }
    .raw-assistant pre { margin-top: 8px; background: #f8f7fc; padding: 12px; border-radius: 14px; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="badges" style="margin-bottom:10px;">
        <span class="pill">${safePlatform}</span>
        <span class="pill">${flow.turns.length} Turns</span>
        <span class="pill">${safeDate}</span>
        <span class="pill">Offline Self-Contained Export</span>
      </div>
      <h1>${safeTitle}</h1>
      <div class="mission-grid">
        <div class="mission-box">
          <div class="sub-label">Original Goal</div>
          <p style="margin:0;">${safeGoal}</p>
        </div>
        <div class="mission-box">
          <div class="sub-label">Final Outcome</div>
          <p style="margin:0;">${safeOutcome}</p>
        </div>
      </div>
    </section>
    <nav class="quick-nav" aria-label="Turn shortcuts">${quickNavHtml}</nav>
    ${turnCardsHtml}
  </main>
</body>
</html>`;
}
