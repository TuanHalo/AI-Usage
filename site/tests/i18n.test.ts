import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { en } from '../src/i18n/en';
import { vi } from '../src/i18n/vi';
import { RULES_VI, SKILLS_VI } from '../src/i18n/assets-vi';
import { isLang, translate, type TKey } from '../src/i18n/index';
import skillsJson from '../src/data/skills.json';
import rulesJson from '../src/data/rules.json';
import { exportFlowAsStandaloneHtml } from '../src/lib/conversation-flow/exporter';
import { SAMPLE_PRESETS } from '../src/lib/conversation-flow/samples';
import { parseConversation } from '../src/lib/conversation-flow/parser';

function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{(\w+)\}/g) ?? [];
  return [...new Set(matches)].sort();
}

function collectHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

test('EN and VI dictionaries have exact key parity and non-empty values', () => {
  const enKeys = Object.keys(en).sort();
  const viKeys = Object.keys(vi).sort();

  assert.deepEqual(
    viKeys,
    enKeys,
    'VI dictionary keys must match EN dictionary keys exactly'
  );

  for (const key of enKeys as TKey[]) {
    assert.ok(en[key].trim().length > 0, `EN key "${key}" must not be empty`);
    assert.ok(vi[key].trim().length > 0, `VI key "${key}" must not be empty`);
  }
});

test('EN and VI dictionaries preserve matching {param} placeholders for every key', () => {
  const enKeys = Object.keys(en) as TKey[];
  for (const key of enKeys) {
    const enParams = extractPlaceholders(en[key]);
    const viParams = extractPlaceholders(vi[key]);
    assert.deepEqual(
      viParams,
      enParams,
      `Placeholder mismatch on key "${key}": EN=${JSON.stringify(enParams)} vs VI=${JSON.stringify(viParams)}`
    );
  }
});

test('translate() interpolates parameters and supports both en and vi', () => {
  assert.equal(
    translate('en', 'home.cat.skills.count', { n: 6 }),
    '6 Active'
  );
  assert.equal(
    translate('vi', 'home.cat.skills.count', { n: 6 }),
    '6 Hoạt động'
  );
  assert.equal(
    translate('vi', 'viz.toast.loadedSavedFlow', { title: 'Demo' }),
    'Đã nạp luồng đã lưu "Demo".'
  );
  assert.equal(isLang('en'), true);
  assert.equal(isLang('vi'), true);
  assert.equal(isLang('fr'), false);
});

test('All canonical skills and rules have Vietnamese translations in assets-vi.ts', () => {
  for (const skill of skillsJson) {
    const tr = SKILLS_VI[skill.name];
    assert.ok(tr, `Missing SKILLS_VI entry for skill "${skill.name}"`);
    assert.ok(tr.descriptionVi.length > 10);
    assert.equal(
      tr.itemsVi.length,
      skill.steps.length,
      `Step count mismatch for skill "${skill.name}"`
    );
  }

  for (const rule of rulesJson) {
    const tr = RULES_VI[rule.name];
    assert.ok(tr, `Missing RULES_VI entry for rule "${rule.name}"`);
    assert.ok(tr.descriptionVi.length > 10);
    assert.equal(
      tr.itemsVi.length,
      rule.guidelines.length,
      `Guideline count mismatch for rule "${rule.name}"`
    );
  }
});

test('All standalone HTML outputs and exported flow HTML include Dark/Light and EN/VI support', () => {
  const outputsRoot = path.resolve(process.cwd(), '..', 'outputs');
  const htmlFiles = [
    ...collectHtmlFiles(path.join(outputsRoot, 'learning')),
    ...collectHtmlFiles(path.join(outputsRoot, 'diagrams')),
    ...collectHtmlFiles(path.join(outputsRoot, 'research')),
  ];

  assert.ok(
    htmlFiles.length >= 18,
    `Expected at least 18 standalone HTML outputs, found ${htmlFiles.length}`
  );

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      content.includes('output-prefs.css') &&
        content.includes('output-i18n-data.js') &&
        content.includes('output-prefs.js'),
      `Standalone output ${path.relative(outputsRoot, file)} is missing shared theme/i18n controller`
    );
  }

  const parsed = parseConversation(SAMPLE_PRESETS[0].rawText, 'antigravity');
  const exportedHtml = exportFlowAsStandaloneHtml(parsed.flow);
  assert.ok(
    exportedHtml.includes('html[data-theme="dark"]') &&
      exportedHtml.includes('data-set-lang="vi"'),
    'Exported standalone flow HTML must support Dark/Light theme and EN/VI language switching'
  );
});
