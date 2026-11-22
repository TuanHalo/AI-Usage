import type { ConversationFlow, DeltaStatus } from './types';

export function escapeHtml(raw: string): string {
  return raw
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
    `- **Captured:** ${flow.createdAt}`,
    `- **Turns:** ${flow.turns.length}`,
    `- **Original Goal:** ${flow.overallGoal}`,
    `- **Final Outcome:** ${flow.finalOutcome}`,
    '',
    '---',
    '',
  ];

  for (const turn of flow.turns) {
    lines.push(
      `## Turn ${turn.index}: ${turn.title} [${formatDeltaLabel(turn.delta)}]`
    );
    lines.push(`- **Relation:** \`${turn.relation}\``);
    lines.push(`- **Intent:** ${turn.intent}`);
    lines.push(`- **Input Summary:** ${turn.inputSummary}`);
    lines.push(`- **Expected Output:** ${turn.expectedOutput}`);
    lines.push(`- **Actual Output:** ${turn.actualOutput}`);
    if (turn.deltaNote) {
      lines.push(`- **Delta Note:** ${turn.deltaNote}`);
    }
    if (turn.toolSummary) {
      lines.push(`- **Tools Executed:** ${turn.toolSummary}`);
    }
    if (turn.extras.length > 0) {
      lines.push(`- **Bonus / Research Extras:**`);
      for (const extra of turn.extras) {
        lines.push(`  - ${extra}`);
      }
    }
    lines.push('');
    lines.push('### Verbatim User Prompt');
    lines.push('```text');
    lines.push(turn.rawUserMessage.replace(/```/g, 'ʼʼʼ'));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function deltaBadgeColors(delta: DeltaStatus): {
  readonly bg: string;
  readonly fg: string;
} {
  switch (delta) {
    case 'matched':
      return { bg: 'var(--status-ok-bg)', fg: 'var(--status-ok-fg)' };
    case 'expanded':
      return { bg: 'var(--status-exp-bg)', fg: 'var(--status-exp-fg)' };
    case 'pivoted':
      return { bg: 'var(--status-warn-bg)', fg: 'var(--status-warn-fg)' };
    case 'partial':
      return { bg: 'var(--status-err-bg)', fg: 'var(--status-err-fg)' };
    case 'pending':
      return { bg: 'var(--status-info-bg)', fg: 'var(--status-info-fg)' };
  }
}

function dualSpan(enText: string, viText: string): string {
  return `<span class="i18n" lang="en">${enText}</span><span class="i18n" lang="vi">${viText}</span>`;
}

export function exportFlowAsStandaloneHtml(flow: ConversationFlow): string {
  const safeTitle = escapeHtml(flow.title);
  const safePlatform = escapeHtml(flow.platform.toUpperCase());
  const safeGoal = escapeHtml(flow.overallGoal);
  const safeOutcome = escapeHtml(flow.finalOutcome);
  const safeDate = escapeHtml(flow.createdAt.slice(0, 10));

  const turnCardsHtml = flow.turns
    .map((turn) => {
      const colors = deltaBadgeColors(turn.delta);
      const extrasHtml =
        turn.extras.length > 0
          ? `<div class="extras-box">
              <div class="sub-label">✨ ${dualSpan(
                `Bonus / Research Discoveries Beyond Expected (${turn.extras.length})`,
                `Phát hiện Nghiên cứu Bổ sung Ngoài Kỳ vọng (${turn.extras.length})`
              )}</div>
              <ul>
                ${turn.extras.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>`
          : '';

      const rawAssistantHtml = turn.rawAssistantMessage
        ? `<details class="raw-assistant">
            <summary>${dualSpan('View Full Assistant Response', 'Xem Toàn bộ Phản hồi của AI')}</summary>
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
          <div class="sub-label">${dualSpan('Verbatim Raw User Message', 'Tin nhắn Người dùng Nguyên bản (Raw Prompt)')}</div>
          <pre>${escapeHtml(turn.rawUserMessage)}</pre>
        </div>
        <div class="intent-row">
          <div><strong>${dualSpan('Intent:', 'Ý định:')}</strong> ${escapeHtml(turn.intent)}</div>
          <div><strong>${dualSpan('Input:', 'Đầu vào:')}</strong> ${escapeHtml(turn.inputSummary)}</div>
        </div>
        <div class="compare-grid">
          <div class="compare-box expected">
            <div class="sub-label">${dualSpan('Expected Output', 'Kết quả Kỳ vọng')}</div>
            <p>${escapeHtml(turn.expectedOutput)}</p>
          </div>
          <div class="compare-box actual">
            <div class="sub-label">${dualSpan('Actual Output', 'Kết quả Thực tế')}</div>
            <p>${escapeHtml(turn.actualOutput)}</p>
          </div>
        </div>
        ${turn.deltaNote ? `<p class="delta-note"><strong>${dualSpan('Delta Note:', 'Ghi chú Độ lệch:')}</strong> ${escapeHtml(turn.deltaNote)}</p>` : ''}
        ${turn.toolSummary ? `<p class="delta-note"><strong>${dualSpan('Tools Executed:', 'Công cụ đã Thực thi:')}</strong> ${escapeHtml(turn.toolSummary)}</p>` : ''}
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
<html lang="en" data-lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — Conversation Flow Export</title>
  <style>
    :root {
      color-scheme: light;
      --canvas: #f0f0f8;
      --surface: #ffffff;
      --surface-soft: rgba(255,255,255,.85);
      --surface-sunken: #f8f7fc;
      --hero-bg: #e4dffd;
      --text: #2e1065;
      --text-2: #4a3080;
      --muted: #6b5f8f;
      --accent: #7c3aed;
      --on-accent: #ffffff;
      --expected-bg: #eef6ff;
      --actual-bg: #edf9f5;
      --extras-bg: #f3f0ff;
      --status-ok-bg: #d4f0e8; --status-ok-fg: #065f46;
      --status-exp-bg: #e4dffd; --status-exp-fg: #5b21b6;
      --status-warn-bg: #fde8d0; --status-warn-fg: #9a3412;
      --status-err-bg: #fcd5ce; --status-err-fg: #9f1239;
      --status-info-bg: #d0e8fd; --status-info-fg: #075985;
      --clay: 0 18px 36px -14px rgba(120,90,180,.22), inset 0 -6px 14px rgba(100,60,150,.12), inset 0 6px 14px rgba(255,255,255,.88);
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --canvas: #14111d;
      --surface: #201b2e;
      --surface-soft: rgba(18,14,28,.65);
      --surface-sunken: #181423;
      --hero-bg: #251e3e;
      --text: #f3f0ff;
      --text-2: #cec4f2;
      --muted: #9e91c4;
      --accent: #a78bfa;
      --on-accent: #190d2c;
      --expected-bg: #16293c;
      --actual-bg: #142e28;
      --extras-bg: #2e2550;
      --status-ok-bg: #11362d; --status-ok-fg: #6ee7b7;
      --status-exp-bg: #2e2550; --status-exp-fg: #ddd6fe;
      --status-warn-bg: #3b2815; --status-warn-fg: #fdba74;
      --status-err-bg: #401c24; --status-err-fg: #fda4af;
      --status-info-bg: #142f47; --status-info-fg: #7dd3fc;
      --clay: 0 18px 36px -14px rgba(0,0,0,.58), inset 0 -6px 14px rgba(0,0,0,.44), inset 0 6px 14px rgba(255,255,255,.07);
    }
    html[data-lang="en"] .i18n[lang="vi"],
    html:not([data-lang]) .i18n[lang="vi"],
    html[data-lang="vi"] .i18n[lang="en"] {
      display: none !important;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 18px 56px;
      background: var(--canvas);
      color: var(--text);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.55;
      transition: background-color 0.25s ease, color 0.25s ease;
    }
    .wrap { max-width: 1020px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }
    .hero, .turn-card {
      background: var(--surface);
      border-radius: 30px;
      padding: 24px 28px;
      box-shadow: var(--clay);
    }
    .hero { background: var(--hero-bg); }
    .hero-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
    h1 { margin: 0 0 10px; font-size: 1.9rem; line-height: 1.2; }
    h2 { margin: 0; font-size: 1.18rem; }
    .badges, .quick-nav, .turn-meta, .pref-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.82rem;
      font-weight: 700;
      box-shadow: 0 4px 10px rgba(0,0,0,.1);
    }
    .pref-btn {
      border: none;
      border-radius: 999px;
      padding: 5px 11px;
      background: var(--surface);
      color: var(--text);
      font-weight: 800;
      font-size: 0.78rem;
      cursor: pointer;
    }
    html[data-lang="en"] .pref-btn[data-set-lang="en"],
    html[data-lang="vi"] .pref-btn[data-set-lang="vi"] {
      background: var(--accent);
      color: var(--on-accent);
    }
    .mission-grid, .compare-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      margin-top: 14px;
    }
    .mission-box, .compare-box, .raw-prompt, .extras-box {
      background: var(--surface-soft);
      border-radius: 18px;
      padding: 14px 16px;
    }
    .compare-box.expected { background: var(--expected-bg); }
    .compare-box.actual { background: var(--actual-bg); }
    .extras-box { background: var(--extras-bg); margin-top: 12px; }
    .extras-box ul { margin: 6px 0 0 18px; padding: 0; }
    .sub-label {
      font-size: 0.76rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .raw-prompt { background: var(--surface-sunken); margin-top: 12px; }
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
      background: var(--surface);
      padding: 6px 12px;
      border-radius: 14px;
      font-size: 0.84rem;
      font-weight: 700;
      box-shadow: 0 4px 10px rgba(0,0,0,.12);
    }
    .raw-assistant { margin-top: 12px; }
    .raw-assistant summary { cursor: pointer; font-weight: 700; color: var(--muted); font-size: 0.88rem; }
    .raw-assistant pre { margin-top: 8px; background: var(--surface-sunken); padding: 12px; border-radius: 14px; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="hero-top">
        <div class="badges">
          <span class="pill">${safePlatform}</span>
          <span class="pill">${flow.turns.length} ${dualSpan('Turns', 'Lượt')}</span>
          <span class="pill">${safeDate}</span>
          <span class="pill">${dualSpan('Offline Self-Contained Export', 'Bản xuất Độc lập Ngoại tuyến')}</span>
        </div>
        <div class="pref-bar">
          <button type="button" class="pref-btn" data-set-lang="en">EN</button>
          <button type="button" class="pref-btn" data-set-lang="vi">VI</button>
          <button type="button" class="pref-btn" id="btn-export-theme">🌙 / ☀️</button>
        </div>
      </div>
      <h1>${safeTitle}</h1>
      <div class="mission-grid">
        <div class="mission-box">
          <div class="sub-label">${dualSpan('Original Goal', 'Mục tiêu Ban đầu')}</div>
          <p style="margin:0;">${safeGoal}</p>
        </div>
        <div class="mission-box">
          <div class="sub-label">${dualSpan('Final Outcome', 'Kết quả Cuối cùng')}</div>
          <p style="margin:0;">${safeOutcome}</p>
        </div>
      </div>
    </section>
    <nav class="quick-nav" aria-label="Turn shortcuts">${quickNavHtml}</nav>
    ${turnCardsHtml}
  </main>
  <script>
    (function(){
      var d = document.documentElement;
      try {
        var t = localStorage.getItem('ai-usage:theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var l = localStorage.getItem('ai-usage:lang') || 'en';
        d.dataset.theme = t; d.dataset.lang = l; d.lang = l;
      } catch(e) {}
      document.addEventListener('click', function(e){
        var b = e.target.closest('[data-set-lang]');
        if (b) {
          var nl = b.getAttribute('data-set-lang');
          d.dataset.lang = nl; d.lang = nl;
          try { localStorage.setItem('ai-usage:lang', nl); } catch(err) {}
        }
        if (e.target.closest('#btn-export-theme')) {
          var nt = d.dataset.theme === 'dark' ? 'light' : 'dark';
          d.dataset.theme = nt;
          try { localStorage.setItem('ai-usage:theme', nt); } catch(err) {}
        }
      });
    })();
  </script>
</body>
</html>`;
}
