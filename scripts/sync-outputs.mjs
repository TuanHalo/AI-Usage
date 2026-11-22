import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceOutputsDir = path.join(repoRoot, 'outputs');
const targetOutputsDir = path.join(repoRoot, 'site', 'public', 'outputs');

const SYNC_SUBDIRS = ['shared', 'learning', 'diagrams', 'research'];

const SHARED_INJECTION_MARKER = 'output-prefs.js';
const SHARED_SNIPPET = [
  '  <!-- AI-Usage Shared Theme (Light/Dark) & Bilingual (EN/VI) Controller -->',
  '  <link rel="stylesheet" href="../../shared/output-prefs.css">',
  '  <script src="../../shared/output-i18n-data.js"></script>',
  '  <script src="../../shared/output-prefs.js"></script>',
].join('\n');

function ensureSharedScriptsInHtmlDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      ensureSharedScriptsInHtmlDir(full);
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8');
      if (!html.includes(SHARED_INJECTION_MARKER) && html.includes('</head>')) {
        const updated = html.replace('</head>', `${SHARED_SNIPPET}\n</head>`);
        fs.writeFileSync(full, updated, 'utf8');
      }
    }
  }
}

function syncOutputs() {
  if (!fs.existsSync(sourceOutputsDir)) {
    return;
  }

  for (const sub of ['learning', 'diagrams', 'research']) {
    ensureSharedScriptsInHtmlDir(path.join(sourceOutputsDir, sub));
  }

  fs.mkdirSync(targetOutputsDir, { recursive: true });

  for (const sub of SYNC_SUBDIRS) {
    const src = path.join(sourceOutputsDir, sub);
    const dest = path.join(targetOutputsDir, sub);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
}

syncOutputs();
