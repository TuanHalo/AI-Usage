import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const desktopRoot = path.join(repoRoot, 'desktop');
const desktopDist = path.join(desktopRoot, 'dist');

const requireFromSite = createRequire(path.join(repoRoot, 'site', 'package.json'));
const esbuild = requireFromSite('esbuild');

async function main() {
  fs.rmSync(desktopDist, { recursive: true, force: true });
  fs.mkdirSync(desktopDist, { recursive: true });

  await Promise.all([
    esbuild.build({
      entryPoints: [path.join(desktopRoot, 'src', 'mcp-server.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node20'],
      banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      outfile: path.join(desktopDist, 'mcp-server.mjs'),
    }),
    esbuild.build({
      entryPoints: [path.join(desktopRoot, 'src', 'live-server.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node20'],
      banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
      outfile: path.join(desktopDist, 'live-server.mjs'),
    }),
  ]);

  console.log(`[OK] Built PromptFlow Desktop bundles in ${desktopDist}`);
}

main().catch((err) => {
  console.error('[ERROR] Desktop build failed:', err);
  process.exit(1);
});
