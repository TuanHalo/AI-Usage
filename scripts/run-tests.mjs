import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const requireFromSite = createRequire(path.join(repoRoot, 'site', 'package.json'));
const esbuild = requireFromSite('esbuild');

async function main() {
  const testEntry = path.join(repoRoot, 'site', 'tests', 'conversation-flow.test.ts');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-tests-'));
  const bundleOut = path.join(tempDir, 'conversation-flow.test.mjs');

  try {
    await esbuild.build({
      entryPoints: [testEntry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node22'],
      packages: 'external',
      outfile: bundleOut,
    });

    const result = spawnSync(process.execPath, ['--test', bundleOut], {
      stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[ERROR] Test runner failed:', err);
  process.exit(1);
});
