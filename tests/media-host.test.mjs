// Pictures load from media.gaydio.co.uk, never media.gaydio.link (20 Oct 2026):
// some company firewalls block gaydio.link. Runs after the build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const files = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(html|js|json|xml|css)$/.test(name) || name === '_headers') out.push(full);
  }
  return out;
};

test('nothing the site serves names media.gaydio.link', () => {
  assert.ok(existsSync(dist), 'dist/ is missing: build first');
  assert.deepEqual(files(dist).filter((f) => readFileSync(f, 'utf8').includes('media.gaydio.link')).map((f) => path.relative(dist, f)), []);
});

test('the CSP allows media.gaydio.co.uk for pictures, and the build rewrites the old name', () => {
  const imgSrc = readFileSync(path.join(root, 'public/_headers'), 'utf8').match(/img-src ([^;]+)/)[1];
  assert.ok(imgSrc.split(/\s+/).includes('https://media.gaydio.co.uk'), imgSrc);
  assert.ok(!imgSrc.includes('media.gaydio.link'), imgSrc);
  assert.match(readFileSync(path.join(root, 'build.mjs'), 'utf8'), /\.replaceAll\(MEDIA_OLD, MEDIA\)/);
});
