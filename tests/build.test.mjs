/* The built site: every address, hidden from search until launch, the
   homepage's blocks in order, pictures and markup escaped. */
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, cp, writeFile } from 'node:fs/promises';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const routeFile = (route) => (route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.replace(/^\/+|\/+$/g, ''), 'index.html'));
const read = (p) => readFile(path.join(root, p), 'utf8');

const aiirAddresses = ['/', '/on-air/', '/on-air/presenters/', '/player/on-demand/', '/music/', '/music/mixshows/', '/music/artist/', '/podcasts/', '/whats-new/', '/whats-new/news/', '/win/', '/events/', '/events/the-guide/', '/contact/', '/contact/press-releases/', '/club/'];

test('every address from the brief (section 14) is built', async () => {
  for (const route of aiirAddresses) await assert.doesNotReject(access(routeFile(route)), `Missing ${route}`);
});

test('the preview build is hidden from search three ways', async () => {
  const home = await read('dist/index.html');
  assert.match(home, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(await read('dist/robots.txt'), /Disallow: \//);
  assert.match(await read('dist/_headers'), /X-Robots-Tag: noindex, nofollow/);
  assert.doesNotMatch(await read('dist/sitemap.xml'), /<loc>/, 'nothing in the sitemap until launch');
});

test('the editor configuration is not published', async () => {
  await assert.rejects(access(path.join(dist, 'admin')));
});

test('the homepage carries the brief\'s blocks in order, placeholders labelled', async () => {
  const home = await read('dist/index.html');
  const blocks = [...home.matchAll(/data-block="([^"]*)"/g)].map((m) => m[1]);
  const sectionals = [...home.matchAll(/data-sectional="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(sectionals, ['homepage-lead', 'whats-new', 'more-from-gaydio']);
  assert.deepEqual(blocks, ['Ad - Billboard', 'Recently Played', 'News', 'Local / Social / VIP', 'Leaderboard', 'Billboard 2', 'Podcasts']);
  assert.match(home, /On air/);
  assert.match(home, /data-header-images='\{/);
});

test('a page with the Pages template has the secondary column; Pages Wide does not', async () => {
  assert.match(await read('dist/win/index.html'), /layout__secondary/);
  assert.doesNotMatch(await read('dist/podcasts/index.html'), /layout__secondary/);
  assert.match(await read('dist/podcasts/index.html'), /data-sectional="gaydio-original-podcasts"/);
});

test('markup typed into a page comes out as text', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'gaydio-site-'));
  const content = await mkdtemp(path.join(os.tmpdir(), 'gaydio-content-'));
  try {
    await cp(path.join(root, 'content'), content, { recursive: true });
    const page = JSON.parse(await readFile(path.join(content, 'pages', 'win.json'), 'utf8'));
    page.body = 'Hello <img src=x onerror="alert(1)"> and [a link](javascript:alert(1)) and **bold**.';
    await writeFile(path.join(content, 'pages', 'win.json'), JSON.stringify(page));
    await execFileAsync('node', [path.join(root, 'build.mjs')], { env: { ...process.env, DIST_DIR: out, CONTENT_DIR: content } });
    const html = await readFile(path.join(out, 'win', 'index.html'), 'utf8');
    assert.match(html, /&lt;img src=x onerror=/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.doesNotMatch(html, /javascript:/);
    assert.match(html, /<strong>bold<\/strong>/);
  } finally {
    await rm(out, { recursive: true, force: true });
    await rm(content, { recursive: true, force: true });
  }
});

test('a block of an unknown type stops the build', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'gaydio-site-'));
  const content = await mkdtemp(path.join(os.tmpdir(), 'gaydio-content-'));
  try {
    await cp(path.join(root, 'content'), content, { recursive: true });
    const areas = JSON.parse(await readFile(path.join(content, 'content-areas.json'), 'utf8'));
    areas.homepagePrimary.push({ name: 'Mystery', type: 'flipbook' });
    await writeFile(path.join(content, 'content-areas.json'), JSON.stringify(areas));
    await assert.rejects(execFileAsync('node', [path.join(root, 'build.mjs')], { env: { ...process.env, DIST_DIR: out, CONTENT_DIR: content } }), /unknown type "flipbook"/);
  } finally {
    await rm(out, { recursive: true, force: true });
    await rm(content, { recursive: true, force: true });
  }
});

test('every content file is well-formed JSON with a slug that matches its file name', async () => {
  for (const folder of ['pages', 'sectionals']) {
    for (const file of (await readdir(path.join(root, 'content', folder))).filter((f) => f.endsWith('.json'))) {
      const record = JSON.parse(await read(`content/${folder}/${file}`));
      assert.equal(record.slug, file.replace(/\.json$/, ''), `${folder}/${file}`);
    }
  }
});
