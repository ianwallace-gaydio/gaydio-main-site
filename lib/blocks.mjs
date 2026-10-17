/* The block registry: every kind of block a content area can hold, as in
 * Aiir's Template Builder. A content area (content/content-areas.json) is an
 * ordered list of blocks, each with a name, a type, optional start and end
 * dates and its own settings. The build renders each one here.
 *
 * Two kinds are real in this first build: a sectional and custom HTML. The
 * rest are placeholders that draw a labelled box saying what will feed them,
 * so the homepage has its shape while the live data behind each is built
 * (docs/aiir-migration.md in the hub repo tracks each one). A block of an
 * unknown type stops the build, so a typo can't silently blank a region.
 *
 * Custom HTML is rendered as written. Aiir does the same (it is how the ad
 * tags and the Messenger box got onto the site), and only people with a Site
 * Editor grant can write one. It is the one place on the site where markup is
 * not escaped, which is why the CSP in public/_headers stays strict: a tag
 * that needs a third-party host has to be allowed there deliberately. */

import { escapeHtml } from './markdown.mjs';
import { isLiveAt } from './dates.mjs';

export const BLOCK_TYPES = {
  sectional: { label: 'Sectional', live: true },
  customHtml: { label: 'Custom HTML', live: true },
  newsMix: { label: 'Gaydio: News Mix', live: false, feed: 'the hub Newsroom (two stories from one category, one from another)' },
  news: { label: 'News', live: false, feed: 'the hub Newsroom (latest stories from one category)' },
  recentlyPlayed: { label: 'Gaydio: Recently Played', live: false, feed: 'the now-playing service, read live' },
  localSocialVip: { label: 'Gaydio: Local / Social / VIP', live: false, feed: 'location choice, social links from Site Settings, Listener Club' },
  podcastsLatest: { label: 'Podcasts: Latest episodes', live: false, feed: 'the podcast feeds' },
  onDemandLatest: { label: 'On Demand: Latest items', live: false, feed: 'SharpStream recordings through the hub' },
  ad: { label: 'Advert', live: false, feed: 'the ad server (Google Ad Manager tags today)' },
};

export function liveBlocks(area, now = Date.now()) {
  return (Array.isArray(area) ? area : []).filter((b) => b && b.type && isLiveAt(b, now));
}

/** @param {object} block  @param {{sectionals: Map<string, object>, renderSectional: (s: object, header?: string) => string}} ctx */
export function renderBlock(block, ctx) {
  const def = BLOCK_TYPES[block.type];
  if (!def) throw new Error(`Content area block "${block.name || '(unnamed)'}" has an unknown type "${block.type}".`);
  const settings = block.settings || {};
  if (block.type === 'sectional') {
    const sectional = ctx.sectionals.get(settings.sectional);
    if (!sectional) throw new Error(`Content area block "${block.name || '(unnamed)'}" points at a sectional "${settings.sectional}" that doesn't exist.`);
    return ctx.renderSectional(sectional, settings.header);
  }
  if (block.type === 'customHtml') {
    return `<section class="block block--custom-html" data-block="${escapeHtml(block.name || '')}">${String(settings.html || '')}</section>`;
  }
  const header = settings.header ? `<h2 class="block__heading">${escapeHtml(settings.header)}</h2>` : '';
  return `<section class="block block--placeholder" data-block="${escapeHtml(block.name || '')}" data-block-type="${escapeHtml(block.type)}">${header}
    <div class="placeholder"><p class="placeholder__label">${escapeHtml(def.label)}</p><p>Coming here: ${escapeHtml(block.name || def.label)}, fed by ${escapeHtml(def.feed)}.</p></div>
  </section>`;
}
