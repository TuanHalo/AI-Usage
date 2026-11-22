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
  const testsDir = path.join(repoRoot, 'site', 'tests');
  const testEntries = fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith('.test.ts'))
    .sort()
    .map((f) => path.join(testsDir, f));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-tests-'));

  try {
    await esbuild.build({
      entryPoints: testEntries,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node22'],
      packages: 'external',
      outdir: tempDir,
      outExtension: { '.js': '.mjs' },
    });

    const bundledTests = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith('.test.mjs'))
      .sort()
      .map((f) => path.join(tempDir, f));

    const result = spawnSync(process.execPath, ['--test', ...bundledTests], {
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
