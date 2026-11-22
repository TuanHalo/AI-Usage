import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

test('No hardcoded hex or rgb/rgba color literals in .astro or client script files', () => {
  const srcRoot = path.resolve(process.cwd(), 'src');
  const files = [
    ...collectFiles(path.join(srcRoot, 'components'), ['.astro']),
    ...collectFiles(path.join(srcRoot, 'layouts'), ['.astro']),
    ...collectFiles(path.join(srcRoot, 'pages'), ['.astro']),
    ...collectFiles(path.join(srcRoot, 'scripts'), ['.ts']),
  ];

  assert.ok(files.length >= 10, 'Expected to scan at least 10 source files');

  const colorPattern = /#[0-9a-fA-F]{3,6}\b|rgba?\s*\(/g;
  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(colorPattern);
    if (matches && matches.length > 0) {
      const rel = path.relative(srcRoot, file);
      violations.push(`${rel}: ${matches.join(', ')}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found hardcoded colors outside clay.css:\n${violations.join('\n')}`
  );
});

test('clay.css defines both light :root tokens, dark html[data-theme="dark"] overrides, and .i18n rules', () => {
  const clayCssPath = path.resolve(process.cwd(), 'src', 'styles', 'clay.css');
  const css = fs.readFileSync(clayCssPath, 'utf8');

  assert.ok(css.includes(':root'), 'clay.css must define :root tokens');
  assert.ok(
    css.includes('html[data-theme="dark"]'),
    'clay.css must define html[data-theme="dark"] overrides'
  );
  assert.ok(
    css.includes('html[data-lang="en"] .i18n[lang="vi"]'),
    'clay.css must hide inactive VI spans when data-lang="en"'
  );
  assert.ok(
    css.includes('html[data-lang="vi"] .i18n[lang="en"]'),
    'clay.css must hide inactive EN spans when data-lang="vi"'
  );
});
