/* The Site Editor's configuration against the content it edits: a key the
   editor does not know is deleted the next time somebody saves, silently.
   Read from the text so the suite keeps its no-dependency rule. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = await readFile(path.join(root, 'public', 'admin', 'config.yml'), 'utf8');

function block(collection) {
  const start = config.indexOf(`\n  - name: ${collection}\n`);
  assert.ok(start >= 0, `config.yml has no collection called ${collection}`);
  const rest = config.slice(start + 1);
  const next = rest.indexOf('\n  - name: ', 1);
  return next > 0 ? rest.slice(0, next) : rest;
}
const names = (text) => new Set([...text.matchAll(/(?:^|\{\s*|\n\s*-\s+|\n\s*|,\s*)(?:name|typeKey):\s*([A-Za-z][A-Za-z0-9-]*)/g)].map((m) => m[1]));

for (const collection of ['pages', 'sectionals']) {
  test(`every key in content/${collection} is one the editor knows, so Save keeps it`, async () => {
    const known = names(block(collection));
    for (const file of (await readdir(path.join(root, 'content', collection))).filter((f) => f.endsWith('.json'))) {
      const record = JSON.parse(await readFile(path.join(root, 'content', collection, file), 'utf8'));
      const keys = Object.keys(record);
      for (const item of record.items || []) keys.push(...Object.keys(item));
      for (const key of keys) assert.ok(known.has(key), `content/${collection}/${file} has "${key}", which public/admin/config.yml does not describe.`);
    }
  });
}

for (const [collection, file] of [['settings', 'settings.json'], ['theme', 'theme.json'], ['content-areas', 'content-areas.json'], ['page-tree', 'page-tree.json']]) {
  test(`every key in content/${file} is declared for the editor`, async () => {
    const known = names(block(collection));
    const record = JSON.parse(await readFile(path.join(root, 'content', file), 'utf8'));
    const walk = (value, where) => {
      if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${where}[${i}]`)); return; }
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          assert.ok(known.has(k), `content/${file}: "${where}.${k}" is not described in public/admin/config.yml.`);
          walk(v, `${where}.${k}`);
        }
      }
    };
    walk(record, file);
  });
}

test('the configuration parses as the editor reads it (no lone apostrophes)', () => {
  // A single-quoted YAML scalar with an unescaped apostrophe inside it.
  for (const line of config.split('\n')) {
    for (const m of line.matchAll(/'((?:[^']|'')*)'/g)) assert.ok(!/(^|[^'])'([^']|$)/.test(m[1]), `A lone apostrophe inside quotes: ${line.trim()}`);
  }
});

test('every section the build makes is offered in the page tree, and no other', async () => {
  const build = await readFile(path.join(root, 'build.mjs'), 'utf8');
  const inBuild = [...build.match(/const SECTIONS = \{[\s\S]*?\n\};/)[0].matchAll(/^\s+'?([a-z-]+)'?: \{ route/gm)].map((m) => m[1]).sort();
  const inConfig = [...block('page-tree').matchAll(/\(\/[^)]*\)', value: ([a-z-]+) \}/g)].map((m) => m[1]).sort();
  assert.deepEqual(inConfig, inBuild);
});
