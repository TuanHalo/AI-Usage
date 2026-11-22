import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  ConversationFlow,
  DesktopSessionSummary,
} from '../../site/src/lib/conversation-flow/types';
import { getMcpSessionsDir, listMcpSessions } from './mcp-store';
import { parseAntigravityTranscript } from './parsers/antigravity-jsonl';
import { parseClaudeCodeTranscript } from './parsers/claude-code-jsonl';

export interface LiveServerOptions {
  readonly port?: number;
  readonly host?: string;
  readonly siteDistDir?: string;
  readonly antigravityBrainDirs?: readonly string[];
  readonly claudeProjectsDir?: string;
}

export interface RunningLiveServer {
  readonly port: number;
  readonly host: string;
  close(): Promise<void>;
}

interface CachedSessionEntry {
  readonly signature: string;
  readonly summary: DesktopSessionSummary;
  readonly flow: ConversationFlow;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveDefaultRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function getDefaultAntigravityBrainDirs(): readonly string[] {
  const envVal = process.env.PROMPTFLOW_ANTIGRAVITY_DIRS;
  if (envVal && envVal.trim().length > 0) {
    return envVal
      .split(path.delimiter)
      .map((p) => path.resolve(p.trim()))
      .filter((p) => p.length > 0);
  }
  const home = os.homedir();
  return [
    path.join(home, '.gemini', 'antigravity', 'brain'),
    path.join(home, '.gemini', 'antigravity-ide', 'brain'),
    path.join(home, '.gemini', 'antigravity-cli', 'brain'),
  ];
}

function getDefaultClaudeProjectsDir(): string {
  const envVal = process.env.PROMPTFLOW_CLAUDE_PROJECTS_DIR;
  if (envVal && envVal.trim().length > 0) {
    return path.resolve(envVal.trim());
  }
  return path.join(os.homedir(), '.claude', 'projects');
}

function getCorsOrigin(originHeader: string | undefined, port: number): string {
  if (!originHeader) {
    return `http://127.0.0.1:${port}`;
  }
  if (
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(originHeader) ||
    originHeader === 'https://tuanhalo.github.io'
  ) {
    return originHeader;
  }
  return `http://127.0.0.1:${port}`;
}

function findClaudeJsonlFiles(rootDir: string, depth: number): readonly string[] {
  if (depth > 3 || !fs.existsSync(rootDir)) {
    return [];
  }
  const results: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'subagents') continue;
      results.push(...findClaudeJsonlFiles(fullPath, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(fullPath);
    }
  }
  return results;
}

export function createDesktopLiveServer(
  options?: LiveServerOptions
): Promise<RunningLiveServer> {
  const host = options?.host ?? '127.0.0.1';
  const requestedPort = options?.port ?? (Number(process.env.PROMPTFLOW_PORT) || 4328);
  const siteDistDir = path.resolve(
    options?.siteDistDir ?? path.join(resolveDefaultRepoRoot(), 'site', 'dist')
  );
  const antigravityDirs = options?.antigravityBrainDirs ?? getDefaultAntigravityBrainDirs();
  const claudeProjectsDir = options?.claudeProjectsDir ?? getDefaultClaudeProjectsDir();

  const cache = new Map<string, CachedSessionEntry>();
  const sseClients = new Set<http.ServerResponse>();
  let sessionsById = new Map<string, CachedSessionEntry>();
  let lastSessionsFingerprint = '';

  function scanAntigravity(): readonly CachedSessionEntry[] {
    const found: CachedSessionEntry[] = [];
    for (const brainRoot of antigravityDirs) {
      if (!fs.existsSync(brainRoot)) continue;
      let subdirs: fs.Dirent[] = [];
      try {
        subdirs = fs.readdirSync(brainRoot, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const dir of subdirs) {
        if (!dir.isDirectory()) continue;
        const logDir = path.join(brainRoot, dir.name, '.system_generated', 'logs');
        const transcriptPath = path.join(logDir, 'transcript.jsonl');
        if (!fs.existsSync(transcriptPath)) continue;

        let stat: fs.Stats;
        try {
          stat = fs.statSync(transcriptPath);
        } catch {
          continue;
        }
        if (stat.size === 0) continue;

        const fullPath = path.join(logDir, 'transcript_full.jsonl');
        let fullStatSig = 'none';
        if (fs.existsSync(fullPath)) {
          try {
            const fsStat = fs.statSync(fullPath);
            fullStatSig = `${fsStat.mtimeMs}:${fsStat.size}`;
          } catch {
            fullStatSig = 'err';
          }
        }

        const id = `agy:${dir.name}`;
        const sig = `${stat.mtimeMs}:${stat.size}:${fullStatSig}`;
        const cached = cache.get(id);
        if (cached && cached.signature === sig) {
          found.push(cached);
          continue;
        }

        try {
          const jsonl = fs.readFileSync(transcriptPath, 'utf8');
          const fullJsonl =
            fullStatSig !== 'none' && fullStatSig !== 'err'
              ? fs.readFileSync(fullPath, 'utf8')
              : undefined;
          const flow = parseAntigravityTranscript(jsonl, {
            fullJsonlContent: fullJsonl,
            sessionId: dir.name,
            sourcePath: transcriptPath,
          });
          if (flow.turns.length === 0) continue;

          const updatedAt = stat.mtime.toISOString();
          const entry: CachedSessionEntry = {
            signature: sig,
            flow,
            summary: {
              id,
              source: 'antigravity-jsonl',
              platform: 'antigravity',
              title: flow.title,
              updatedAt,
              turnCount: flow.turns.length,
              isStreaming: flow.isStreaming,
              sourcePath: transcriptPath,
            },
          };
          cache.set(id, entry);
          found.push(entry);
        } catch {
          // Skip transient read error while file is actively rotating
        }
      }
    }
    return found;
  }

  function scanClaudeCode(): readonly CachedSessionEntry[] {
    const found: CachedSessionEntry[] = [];
    const jsonlFiles = findClaudeJsonlFiles(claudeProjectsDir, 0);

    for (const filePath of jsonlFiles) {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (stat.size === 0) continue;

      const sessionName = path.basename(filePath, '.jsonl');
      const id = `claude-code:${sessionName}`;
      const sig = `${stat.mtimeMs}:${stat.size}`;
      const cached = cache.get(id);
      if (cached && cached.signature === sig) {
        found.push(cached);
        continue;
      }

      try {
        const jsonl = fs.readFileSync(filePath, 'utf8');
        const flow = parseClaudeCodeTranscript(jsonl, {
          sessionId: sessionName,
          sourcePath: filePath,
        });
        if (flow.turns.length === 0) continue;

        const entry: CachedSessionEntry = {
          signature: sig,
          flow,
          summary: {
            id,
            source: 'claude-code-jsonl',
            platform: 'claude',
            title: flow.title,
            updatedAt: stat.mtime.toISOString(),
            turnCount: flow.turns.length,
            isStreaming: flow.isStreaming,
            sourcePath: filePath,
          },
        };
        cache.set(id, entry);
        found.push(entry);
      } catch {
        // Ignore transient write error
      }
    }
    return found;
  }

  function scanMcp(): readonly CachedSessionEntry[] {
    const mcpLoaded = listMcpSessions();
    return mcpLoaded.map((item) => ({
      signature: item.summary.updatedAt,
      summary: item.summary,
      flow: item.flow,
    }));
  }

  function broadcastSse(eventName: string, payload: unknown): void {
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function refreshSessions(): void {
    const allEntries: CachedSessionEntry[] = [
      ...scanMcp(),
      ...scanAntigravity(),
      ...scanClaudeCode(),
    ];
    allEntries.sort((a, b) =>
      b.summary.updatedAt.localeCompare(a.summary.updatedAt)
    );
    const trimmed = allEntries.slice(0, 40);

    const nextMap = new Map<string, CachedSessionEntry>();
    const changedEntries: CachedSessionEntry[] = [];
    for (const entry of trimmed) {
      nextMap.set(entry.summary.id, entry);
      const prev = sessionsById.get(entry.summary.id);
      if (!prev || prev.signature !== entry.signature || prev.summary.isStreaming !== entry.summary.isStreaming) {
        changedEntries.push(entry);
      }
    }

    sessionsById = nextMap;
    const summaries = trimmed.map((item) => item.summary);
    const listFingerprint = JSON.stringify(summaries);

    if (listFingerprint !== lastSessionsFingerprint) {
      lastSessionsFingerprint = listFingerprint;
      broadcastSse('sessions', { sessions: summaries });
    }

    for (const changed of changedEntries) {
      broadcastSse('flow', {
        session: changed.summary,
        flow: changed.flow,
      });
    }
  }

  function serveStaticSite(
    reqPath: string,
    res: http.ServerResponse
  ): boolean {
    if (!fs.existsSync(siteDistDir)) {
      return false;
    }

    let relative = reqPath;
    if (relative === '/' || relative === '') {
      res.writeHead(302, { Location: '/AI-Usage/visualizer' });
      res.end();
      return true;
    }

    if (relative.startsWith('/AI-Usage')) {
      relative = relative.slice('/AI-Usage'.length) || '/';
    }

    const sanitized = relative.replace(/^\/+/, '');
    const candidates: string[] = [];
    if (!sanitized) {
      candidates.push(path.join(siteDistDir, 'index.html'));
    } else {
      candidates.push(path.join(siteDistDir, sanitized));
      candidates.push(path.join(siteDistDir, sanitized, 'index.html'));
    }

    for (const candidate of candidates) {
      const resolved = path.resolve(candidate);
      if (
        resolved !== siteDistDir &&
        !resolved.startsWith(`${siteDistDir}${path.sep}`)
      ) {
        continue;
      }
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        });
        fs.createReadStream(resolved).pipe(res);
        return true;
      }
    }

    return false;
  }

  refreshSessions();

  const watchers: fs.FSWatcher[] = [];
  let watchDebounce: NodeJS.Timeout | null = null;
  const triggerScan = (): void => {
    if (watchDebounce) clearTimeout(watchDebounce);
    watchDebounce = setTimeout(() => {
      watchDebounce = null;
      refreshSessions();
    }, 220);
  };

  for (const rootDir of [...antigravityDirs, claudeProjectsDir, getMcpSessionsDir()]) {
    if (!fs.existsSync(rootDir)) continue;
    try {
      const w = fs.watch(rootDir, { recursive: true }, triggerScan);
      watchers.push(w);
    } catch {
      // Polling fallback below handles systems where recursive watch is unavailable
    }
  }

  const pollTimer = setInterval(refreshSessions, 1200);
  const heartbeatTimer = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': ping\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 20000);

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url ?? '/', `http://${host}:${requestedPort}`);
    const actualPort = (server.address() as { readonly port: number } | null)?.port ?? requestedPort;
    const corsOrigin = getCorsOrigin(req.headers.origin, actualPort);

    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (reqUrl.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          mode: 'desktop-live',
          port: actualPort,
          sessionCount: sessionsById.size,
        })
      );
      return;
    }

    if (reqUrl.pathname === '/api/sessions') {
      refreshSessions();
      const summaries = Array.from(sessionsById.values()).map((s) => s.summary);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ sessions: summaries }));
      return;
    }

    if (reqUrl.pathname.startsWith('/api/sessions/')) {
      refreshSessions();
      const rawId = decodeURIComponent(reqUrl.pathname.slice('/api/sessions/'.length));
      const found = sessionsById.get(rawId);
      if (!found) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ session: found.summary, flow: found.flow }));
      return;
    }

    if (reqUrl.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      sseClients.add(res);
      const summaries = Array.from(sessionsById.values()).map((s) => s.summary);
      res.write(`event: sessions\ndata: ${JSON.stringify({ sessions: summaries })}\n\n`);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    if (serveStaticSite(reqUrl.pathname, res)) {
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found. Build site first (cd site && npm run build) or open /api/sessions.');
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(requestedPort, host, () => {
      const addr = server.address() as { readonly port: number };
      resolve({
        port: addr.port,
        host,
        close(): Promise<void> {
          clearInterval(pollTimer);
          clearInterval(heartbeatTimer);
          if (watchDebounce) clearTimeout(watchDebounce);
          for (const w of watchers) w.close();
          for (const client of sseClients) client.end();
          sseClients.clear();
          return new Promise((resClose) => {
            server.close(() => resClose());
          });
        },
      });
    });
  });
}

function isDirectCliRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectCliRun()) {
  createDesktopLiveServer()
    .then((srv) => {
      console.log(
        `[PromptFlow Desktop Live] Listening on http://${srv.host}:${srv.port}/AI-Usage/visualizer`
      );
      console.log(
        `[PromptFlow Desktop Live] Auto-watching Antigravity, Claude Code, and MCP sessions (${getMcpSessionsDir()})`
      );
    })
    .catch((err) => {
      console.error('[ERROR] Failed to start PromptFlow Desktop Live server:', err);
      process.exit(1);
    });
}
