/* The build: turns content/ into real pages at real addresses in dist/.
 *
 * Reads public/ (the shell, stylesheet, script, fonts, pictures) and
 * content/ (settings, theme, the page tree, pages, sectionals, content
 * areas), writes one file per address, the sitemap and the redirects.
 * No framework, no dependencies: Node 22 and this file.
 *
 *   npm run build      build dist/
 *   npm start          build and serve it on :8099
 *   npm test           build, then check it
 *
 * Addresses come from the page tree (content/page-tree.json, lib/page-tree.mjs),
 * as in Aiir's Page Manager: a folder is a level of address, a page sits in
 * one, a section is a part of the site this file makes itself. The Aiir
 * addresses in the brief (section 14) are kept where this site has the same
 * thing, so a cut-over needs 301s only where an address is chosen to change.
 *
 * PUBLIC_SITE=true is the launch build: pages ask to be indexed and the
 * sitemap is honest. Without it (every build until launch) every page is
 * noindex, nofollow, on top of robots.txt and the X-Robots-Tag header. */

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderStoryBody as renderMarkdown } from './lib/markdown.mjs';
import { resolvePageTree } from './lib/page-tree.mjs';
import { BLOCK_TYPES, liveBlocks, renderBlock } from './lib/blocks.mjs';
import { isLiveAt } from './lib/dates.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.join(root, 'content');
const publicRoot = path.join(root, 'public');
const distRoot = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(root, 'dist');
const isPublic = process.env.PUBLIC_SITE === 'true';
const buildTime = Date.now();

// Pictures from the hub's picture library are served at media.gaydio.co.uk since
// 20 Oct 2026. They were at media.gaydio.link, the same files, which some company
// firewalls block outright. Any address still on the old name is rewritten here,
// so no built page can name it.
const MEDIA_OLD = 'https://media.gaydio.link/';
const MEDIA = 'https://media.gaydio.co.uk/';
const readJson = async (file) => JSON.parse((await readFile(file, 'utf8')).replaceAll(MEDIA_OLD, MEDIA));
async function readCollection(name) {
  const directory = path.join(contentRoot, name);
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(files.map((file) => readJson(path.join(directory, file))));
}
const fingerprint = (content) => createHash('sha256').update(content).digest('hex').slice(0, 10);
const assetVersion = {
  css: fingerprint(await readFile(path.join(publicRoot, 'assets', 'css', 'site.css'))),
  js: fingerprint(await readFile(path.join(publicRoot, 'assets', 'js', 'site.js'))),
};
const pkg = await readJson(path.join(root, 'package.json'));

/* ── the content ─────────────────────────────────────────────────────── */
const settings = await readJson(path.join(contentRoot, 'settings.json'));
const theme = await readJson(path.join(contentRoot, 'theme.json'));
const areas = await readJson(path.join(contentRoot, 'content-areas.json'));
const pageList = await readCollection('pages');
const sectionalList = await readCollection('sectionals');

const CLEAN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
{
  const bad = [
    ...pageList.filter((p) => typeof p.slug !== 'string' || !CLEAN_SLUG.test(p.slug)).map((p) => `page "${p.title || 'untitled'}" has web address ${JSON.stringify(p.slug ?? null)}`),
    ...sectionalList.filter((s) => typeof s.slug !== 'string' || !CLEAN_SLUG.test(s.slug)).map((s) => `sectional "${s.title || 'untitled'}" has identifier ${JSON.stringify(s.slug ?? null)}`),
  ];
  if (bad.length) throw new Error(`A web address must be lower-case letters, numbers and single hyphens:\n- ${bad.join('\n- ')}`);
}
const pagesBySlug = new Map(pageList.map((p) => [p.slug, p]));
const sectionals = new Map(sectionalList.map((s) => [s.slug, s]));

/* The sections: the parts of the site this build makes itself. Each has a
   fixed address (brief section 14) and, in this first build, a placeholder
   page saying what will feed it. */
const SECTIONS = {
  home: { route: '/', label: 'Home' },
  schedule: { route: '/on-air/', label: 'Schedule', feed: 'the hub\'s weekly schedule (Day to Day Operations) and the now-playing service' },
  presenters: { route: '/on-air/presenters/', label: 'Presenters', feed: 'the hub\'s presenter list and programme pages' },
  news: { route: '/whats-new/news/', label: 'News', feed: 'the hub Newsroom' },
  guide: { route: '/events/the-guide/', label: 'The Guide', feed: 'Signal\'s approved event listings' },
  artists: { route: '/music/artist/', label: 'Artists', feed: 'the now-playing service\'s artist pages' },
  'on-demand': { route: '/player/on-demand/', label: 'On Demand', feed: 'SharpStream recordings through the hub' },
  club: { route: '/club/', label: 'Listener Club', feed: 'the hub, once the Listener Club is built' },
  search: { route: '/search/', label: 'Search', feed: 'a search index built from every page' },
};

const tree = resolvePageTree(await readJson(path.join(contentRoot, 'page-tree.json')), {
  sections: SECTIONS,
  pages: pagesBySlug,
  isPublished: (page) => !isPublic || isLiveAt({ start: page.showFrom, end: page.showUntil }, buildTime),
});
if (tree.errors.length) throw new Error(`The page tree (content/page-tree.json) has problems:\n- ${tree.errors.join('\n- ')}`);

/* ── rendering ───────────────────────────────────────────────────────── */
const absoluteUrl = (route) => new URL(route, settings.siteUrl).toString();
const attr = (v) => escapeHtml(String(v ?? ''));

function navLink(entry, extraClass = '') {
  const target = entry.newWindow || entry.external ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${extraClass}" href="${attr(entry.path)}"${target}>${escapeHtml(entry.label)}</a>`;
}

function mainNav(route) {
  const items = tree.nav.map((entry) => {
    if (entry.type === 'folder' && entry.items.length) {
      const open = entry.path && route.startsWith(entry.path) ? ' primary-nav__folder--current' : '';
      return `<li class="primary-nav__folder${open}"><button type="button" aria-expanded="false" aria-controls="menu-${attr(entry.key)}">${escapeHtml(entry.label)}</button>
        <ul id="menu-${attr(entry.key)}" class="primary-nav__dropdown">${entry.items.map((i) => `<li>${navLink(i)}</li>`).join('')}</ul></li>`;
    }
    const current = entry.path === route ? ' aria-current="page"' : '';
    return `<li>${navLink(entry).replace('<a ', `<a${current} `)}</li>`;
  }).join('');
  return `<nav class="primary-nav" aria-label="Main">
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-menu">Menu</button>
    <ul id="primary-menu" class="primary-nav__list">${items}</ul>
    <a class="listen-button" href="${attr(settings.listenUrl)}" target="_blank" rel="noopener"><span class="listen-button__icon" aria-hidden="true"></span>${escapeHtml(settings.listenLabel || 'Listen')}</a>
  </nav>`;
}

function siteHeader(route) {
  return `<header class="site-header" data-header-images='${attr(JSON.stringify(theme.headers || {}))}'>
    <div class="site-header__inner wrap">
      <a class="site-header__logo" href="/" aria-label="${attr(settings.siteName)} home"><img src="${attr(theme.logo)}" alt="${attr(settings.siteName)}" width="300" height="78"></a>
      ${theme.presenterCutout ? `<img class="site-header__presenter" src="${attr(theme.presenterCutout)}" alt="" width="360" height="300">` : ''}
    </div>
    <div class="on-air-bar" data-on-air><div class="wrap"><span class="on-air-bar__badge">On air</span> <span class="on-air-bar__text">Who's on and what's playing will appear here, read live from the hub.</span></div></div>
    ${mainNav(route)}
  </header>`;
}

function footer() {
  const links = (list) => list.map((e) => `<li>${navLink(e)}</li>`).join('');
  const socials = Object.entries(settings.social || {}).filter(([, url]) => url).map(([name, url]) => `<li><a href="${attr(url)}" target="_blank" rel="noopener">${escapeHtml(name === 'x' ? 'X' : name[0].toUpperCase() + name.slice(1))}</a></li>`).join('');
  return `<footer class="site-footer">
    <div class="wrap site-footer__inner">
      <img class="site-footer__logo" src="${attr(theme.logo)}" alt="" width="160" height="42">
      <ul class="site-footer__links">${links(tree.footerPrimary)}</ul>
      <ul class="site-footer__links site-footer__links--legal">${links(tree.footerLegal)}</ul>
      ${socials ? `<ul class="site-footer__social">${socials}</ul>` : ''}
      <p class="site-footer__line">${escapeHtml(settings.footerLine || '')}</p>
      <p class="site-footer__areas">${escapeHtml(settings.dabAreas || '')}${settings.fmAreas ? ` · ${escapeHtml(settings.fmAreas)}` : ''}</p>
    </div>
  </footer>`;
}

function shell({ title, description, route, body, pageClass = '', shareImage = '', index = true, searchTitle = '' }) {
  const headTitle = String(searchTitle || '').trim() || title;
  const fullTitle = route === '/' ? settings.siteTitle : `${headTitle} | ${settings.siteName}`;
  const robots = isPublic && index ? 'index,follow' : isPublic ? 'noindex,follow' : 'noindex,nofollow';
  const image = shareImage || theme.defaultShareImage || '';
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${attr(theme.accent || '#5b68d9')}">
  <meta name="robots" content="${robots}">
  <meta name="generator" content="${attr(pkg.name)} v${attr(pkg.version)}">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${attr(description)}">
  <link rel="canonical" href="${attr(absoluteUrl(route))}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${attr(settings.siteName)}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${attr(description)}">
  <meta property="og:url" content="${attr(absoluteUrl(route))}">${image ? `\n  <meta property="og:image" content="${attr(new URL(image, settings.siteUrl).toString())}">` : ''}
  <meta property="og:locale" content="en_GB">
  <link rel="preload" href="/assets/fonts/effra/effra-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/effra/effra-900.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/site.css?v=${assetVersion.css}">
  <style>:root{--accent:${attr(theme.accent || '#5b68d9')};--nav:${attr(theme.navBackground || '#2f3b5e')};--site-bg:${attr(theme.siteBackground || '#f1f1f1')};--header-image:url("${attr(theme.headers?.daytime?.image || '')}")}</style>
  <script src="/assets/js/site.js?v=${assetVersion.js}" defer></script>
</head>
<body class="${attr(pageClass)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${siteHeader(route)}
  <main id="main-content">${body}</main>
  ${footer()}
</body>
</html>`;
}

/* ── sectionals ──────────────────────────────────────────────────────── */
function sectionalItems(sectional) {
  let items = (sectional.items || []).map((item) => {
    if (item.type === 'page') {
      const page = pagesBySlug.get(item.page);
      if (!page) throw new Error(`Sectional "${sectional.title}" tags a page "${item.page}" that doesn't exist.`);
      return { ...item, title: item.title || page.title, summary: item.summary || page.summary, image: item.image || page.shareImage || '', link: tree.pathOf(page.slug) || '' };
    }
    return item;
  }).filter((item) => item.link || item.type === 'content');
  if (sectional.hideExpired !== false) items = items.filter((item) => isLiveAt(item, buildTime));
  if (sectional.randomise) {
    const pinned = items.slice(0, Number(sectional.pinFirst) || 0);
    const rest = items.slice(pinned.length);
    for (let i = rest.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    items = [...pinned, ...rest];
  }
  if (Number(sectional.limit) > 0) items = items.slice(0, Number(sectional.limit));
  return items;
}

function renderSectional(sectional, header) {
  const items = sectionalItems(sectional);
  const heading = header ? `<h2 class="block__heading">${escapeHtml(header)}</h2>` : '';
  if (!items.length) {
    return `<section class="block block--sectional block--empty" data-sectional="${attr(sectional.slug)}">${heading}<div class="placeholder"><p class="placeholder__label">Sectional</p><p>"${escapeHtml(sectional.title)}" has no items yet.</p></div></section>`;
  }
  const card = (item) => {
    const target = item.newWindow ? ' target="_blank" rel="noopener"' : '';
    const inner = `${item.image ? `<img src="${attr(item.image)}" alt="${attr(item.imageAlt || '')}" loading="lazy">` : '<span class="card__no-image" aria-hidden="true"></span>'}
      <span class="card__body"><span class="card__title">${escapeHtml(item.title || '')}</span>${item.summary ? `<span class="card__summary">${escapeHtml(item.summary)}</span>` : ''}</span>`;
    return item.link ? `<li class="card"><a href="${attr(item.link)}"${target}>${inner}</a></li>` : `<li class="card">${inner}</li>`;
  };
  const layout = ['cards', 'list', 'lead'].includes(sectional.layout) ? sectional.layout : 'cards';
  return `<section class="block block--sectional" data-sectional="${attr(sectional.slug)}">${heading}<ul class="cards cards--${layout}">${items.map(card).join('')}</ul></section>`;
}

const blockCtx = { sectionals, renderSectional };
const renderArea = (name) => liveBlocks(areas[name], buildTime).map((block) => renderBlock(block, blockCtx)).join('\n');

/* ── pages ───────────────────────────────────────────────────────────── */
const TEMPLATES = new Set(['pages', 'pages-wide', 'plain']);
function pageBody(page, route) {
  const template = TEMPLATES.has(page.template) ? page.template : 'pages';
  const embedded = (page.sectionals || []).map((slug) => {
    const s = sectionals.get(slug);
    if (!s) throw new Error(`Page "${page.title}" embeds a sectional "${slug}" that doesn't exist.`);
    return renderSectional(s, s.title);
  }).join('\n');
  const content = `<article class="page-content"><h1>${escapeHtml(page.title)}</h1>${renderMarkdown(page.body)}${embedded}</article>`;
  if (template === 'plain') return `<div class="wrap layout layout--plain">${content}</div>`;
  const under = `<div class="under-content">${renderArea('pagesUnderContent')}</div>`;
  if (template === 'pages-wide') return `<div class="wrap layout layout--wide">${content}${under}</div>`;
  return `<div class="wrap layout layout--pages"><div class="layout__main">${content}${under}</div><aside class="layout__secondary" aria-label="Also on Gaydio">${renderArea('pagesSecondary')}</aside></div>`;
}

function sectionBody(section) {
  if (section.id === 'home') return `<div class="wrap layout layout--home">${renderArea('homepagePrimary')}</div>`;
  const def = SECTIONS[section.id];
  return `<div class="wrap layout layout--pages"><div class="layout__main"><article class="page-content"><h1>${escapeHtml(section.label)}</h1>
    <div class="placeholder placeholder--section"><p class="placeholder__label">Section</p><p>${escapeHtml(section.label)} will be built here, fed by ${escapeHtml(def.feed)}.</p></div></article></div>
    <aside class="layout__secondary" aria-label="Also on Gaydio">${renderArea('pagesSecondary')}</aside></div>`;
}

const pages = [
  ...tree.sections.filter((s) => s.node.visible).map((s) => ({
    route: s.route,
    index: true,
    html: shell({ title: s.label, description: settings.description, route: s.route, body: sectionBody(s), pageClass: `section section-${s.id}` }),
  })),
  ...tree.pages.map(({ page, route }) => ({
    route,
    index: true,
    html: shell({ title: page.title, description: page.summary || settings.description, route, body: pageBody(page, route), pageClass: `page page-${page.slug} template-${TEMPLATES.has(page.template) ? page.template : 'pages'}`, shareImage: page.shareImage, searchTitle: page.metaTitle }),
  })),
];

/* ── write ───────────────────────────────────────────────────────────── */
const pageFile = (route) => (route === '/' ? path.join(distRoot, 'index.html') : path.join(distRoot, route.replace(/^\/+|\/+$/g, ''), 'index.html'));

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
await cp(publicRoot, distRoot, { recursive: true, filter: (src) => !src.includes(`${path.sep}admin`) });

if (tree.redirects.length) {
  const lines = tree.redirects.flatMap(({ from, to, status }) => [`${from} ${to} ${status}`, `${from.replace(/\/$/, '')} ${to} ${status}`]);
  const fixed = await readFile(path.join(distRoot, '_redirects'), 'utf8').catch(() => '');
  await writeFile(path.join(distRoot, '_redirects'), `${fixed.replace(/\n*$/, '\n')}# From the page tree (content/page-tree.json)\n${lines.join('\n')}\n`);
}

for (const page of pages) {
  const target = pageFile(page.route);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, page.html);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p.index && isPublic).map((p) => `  <url><loc>${escapeHtml(absoluteUrl(p.route))}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(distRoot, 'sitemap.xml'), sitemap);

const placeholders = Object.entries(BLOCK_TYPES).filter(([, d]) => !d.live).map(([k]) => k);
console.log(`Built ${pages.length} pages into dist/ (${isPublic ? 'public indexing' : 'preview no-index'}). Placeholder block types still to build: ${placeholders.join(', ')}.`);
