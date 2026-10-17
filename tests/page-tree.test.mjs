/* The page tree rules (lib/page-tree.mjs), on made-up trees, then the real one. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolvePageTree } from '../lib/page-tree.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sections = {
  home: { route: '/', label: 'Home' },
  schedule: { route: '/on-air/', label: 'Schedule' },
  news: { route: '/whats-new/news/', label: 'News' },
};
const pages = new Map([
  ['whats-new', { slug: 'whats-new', title: "What's New" }],
  ['win', { slug: 'win', title: 'Win' }],
  ['privacy', { slug: 'privacy', title: 'Privacy' }],
]);
const resolve = (items, opts = {}) => resolvePageTree({ items }, { sections, pages, ...opts });

test('a folder\'s default page is served at the folder\'s own address, as in Aiir', () => {
  const t = resolve([
    { type: 'folder', slug: 'whats-new', label: "What's New", inNav: true, default: 'whats-new' },
    { type: 'page', page: 'whats-new', parent: 'whats-new' },
    { type: 'section', id: 'news', parent: 'whats-new', label: 'News', inNav: true },
  ]);
  assert.deepEqual(t.errors, []);
  assert.deepEqual(t.pages.map((p) => p.route), ['/whats-new/']);
  assert.deepEqual(t.redirects, [], 'no redirect: the page is at the folder address');
  assert.equal(t.nav[0].path, '/whats-new/');
  assert.deepEqual(t.nav[0].items.map((i) => [i.label, i.path]), [['News', '/whats-new/news/']], 'a folder\'s menu items are its dropdown');
});

test('a section can be grouped under a folder whose address leads to it, and be its default', () => {
  const t = resolve([
    { type: 'folder', slug: 'on-air', label: 'Radio', inNav: true, default: 'schedule' },
    { type: 'section', id: 'schedule', parent: 'on-air', label: 'Schedule', inNav: true },
  ]);
  assert.deepEqual(t.errors, []);
  assert.equal(t.nav[0].path, '/on-air/');
  assert.match(resolve([{ type: 'folder', slug: 'radio' }, { type: 'section', id: 'schedule', parent: 'radio' }]).errors.join(), /isn't inside \/radio\//);
});

test('a folder with no default sends you to its first item', () => {
  const t = resolve([{ type: 'folder', slug: 'info' }, { type: 'page', page: 'privacy', parent: 'info' }, { type: 'page', page: 'win', parent: 'info' }]);
  assert.deepEqual(t.redirects, [{ from: '/info/', to: '/info/privacy/', status: 302 }]);
});

test('a page and a folder may share a slug; two folders may not', () => {
  assert.deepEqual(resolve([{ type: 'folder', slug: 'win', default: 'win' }, { type: 'page', page: 'win', parent: 'win' }]).errors, []);
  assert.match(resolve([{ type: 'folder', slug: 'a' }, { type: 'folder', slug: 'a' }]).errors.join(), /in the tree twice/);
  assert.match(resolve([{ type: 'folder', slug: 'a' }, { type: 'redirect', slug: 'x', to: '/', parent: 'a' }, { type: 'redirect', slug: 'x', to: '/', parent: 'a' }]).errors.join(), /twice in the same place/);
  assert.deepEqual(resolve([{ type: 'folder', slug: 'a' }, { type: 'redirect', slug: 'x', to: '/', parent: 'a' }, { type: 'redirect', slug: 'x', to: '/' }]).errors, [], 'the same redirect slug in two folders is fine');
});

test('Showing off takes an item and everything inside it off the site', () => {
  const t = resolve([
    { type: 'folder', slug: 'info', inNav: true, showing: false },
    { type: 'page', page: 'privacy', parent: 'info', footer: 'legal' },
  ]);
  assert.deepEqual(t.errors, []);
  assert.deepEqual(t.pages, []);
  assert.deepEqual(t.nav, []);
  assert.deepEqual(t.footerLegal, []);
});

test('a page outside its available dates is off the public build and on the preview', () => {
  const items = [{ type: 'page', page: 'win' }];
  assert.deepEqual(resolve(items, { isPublished: () => false }).pages, []);
  assert.equal(resolve(items).pages.length, 1);
});

test('mistakes are refused with a message', () => {
  const cases = [
    [[{ type: 'section', id: 'shop' }], /no section called "shop"/],
    [[{ type: 'page', page: 'nope' }], /no page "nope"/],
    [[{ type: 'folder', slug: 'Info Pages' }], /lower-case letters/],
    [[{ type: 'page', page: 'win', parent: 'nowhere' }], /parent "nowhere" isn't in the tree/],
    [[{ type: 'folder', slug: 'a', parent: 'b' }, { type: 'folder', slug: 'b', parent: 'a' }], /inside itself/],
    [[{ type: 'section', id: 'news', showing: false }], /can't be switched off/],
    [[{ type: 'redirect', slug: 'x', to: 'javascript:alert(1)' }], /https:\/\//],
    [[{ type: 'folder', slug: 'news' }], /name of a section/],
    [[{ type: 'folder', slug: 'info', default: 'win' }], /isn't inside it/],
    [[{ type: 'page', page: 'privacy', footer: 'sidebar' }], /footer must be/],
    [[{ type: 'widget' }], /unknown kind/],
  ];
  for (const [items, message] of cases) assert.match(resolve(items).errors.join(' | '), message, JSON.stringify(items));
});

test('the real tree gives the main menu from the brief', async () => {
  const home = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
  const nav = home.match(/<ul id="primary-menu"[\s\S]*?<a class="listen-button"/)[0].replace(/<ul id="menu-[\s\S]*?<\/ul>/g, '');
  const top = [...nav.matchAll(/<li(?: class="[^"]*")?>(?:<button[^>]*>|<a[^>]*>)([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(top, ['Radio', 'Podcasts', 'What&#039;s New', 'Win', 'Events', 'Connect', 'Academy']);
});
