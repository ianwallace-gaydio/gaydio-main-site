/* The page tree: every item on the site in order, as in Aiir's Page Manager.
 * It lives in content/page-tree.json, one ordered list, and the build reads
 * the main menu, the footer links, every page's address, the folders and
 * the redirects from it and from nowhere else.
 *
 * Four kinds of item:
 *   section   a part of the site the build makes itself (the schedule, news,
 *             the podcasts index...). Its address is fixed, because the items
 *             it lists hang off it. The tree says what it is called, whether
 *             it is in the menu, and which folder it is grouped under.
 *   page      a page from content/pages (Pages in the editor). Its address is
 *             its parent's address plus its own slug, or, when it is a
 *             folder's default page, the folder's own address.
 *   folder    a level in the address, e.g. /on-air/. Served at its address by
 *             its default page; with none named it sends you to its first item.
 *   redirect  an address that sends you somewhere else, on this site or off it.
 *
 * Every item has a key: a section's id, a page's slug, a folder's or
 * redirect's slug. A child names its parent by that key. Only top-level items
 * can be in the header menu; a folder's items in the menu are its dropdown.
 *
 * "Showing" off takes an item, and everything under it, off the site. A
 * section can't be switched off: other pages link to them all.
 *
 * Mistakes stop the build with a message saying what is wrong, so the live
 * site stays as it was rather than going out with a broken address.
 *
 * Adapted from outthere-gm-site/lib/page-tree.mjs with two changes for Aiir's
 * conventions: a section may be grouped under a folder whose address is a
 * prefix of its own (Radio at /on-air/ holds the Schedule section at /on-air/),
 * and a folder's default page is served at the folder's address rather than
 * redirected to. */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TYPES = new Set(['section', 'page', 'folder', 'redirect']);
const FOOTER = new Set(['', 'primary', 'legal']);

const joinPath = (parent, slug) => `${parent === '/' ? '' : parent.replace(/\/$/, '')}/${slug}/`;
const keyOf = (item) => (item.type === 'section' ? item.id : item.type === 'page' ? item.page : item.slug);
// Keys are unique per kind of thing, as slugs are unique per folder in Aiir:
// a folder and a section share one space (either can be a parent, so a
// parent is named by its key alone); a page's slug is unique among pages
// because each is a file; a redirect's slug is unique within its parent.
const idOf = (item) => (item.type === 'page' ? `page:${item.page}` : item.type === 'redirect' ? `redirect:${item.parent || ''}/${item.slug}` : keyOf(item));

/**
 * @param {{items: object[]}} tree
 * @param {{sections: Record<string, {route: string, label: string}>, pages: Map<string, object>, isPublished?: (page: object) => boolean}} ctx
 */
export function resolvePageTree(tree, { sections, pages, isPublished = () => true }) {
  const errors = [];
  const items = Array.isArray(tree?.items) ? tree.items : [];
  if (!Array.isArray(tree?.items)) errors.push('The page tree has no items list.');

  const byKey = new Map();
  for (const [i, raw] of items.entries()) {
    const item = { ...raw, type: raw?.type };
    const where = `Item ${i + 1}${raw?.label ? ` (${raw.label})` : ''}`;
    if (!TYPES.has(item.type)) { errors.push(`${where}: unknown kind "${item.type}".`); continue; }
    const key = keyOf(item);
    if (item.type === 'section' && !sections[key]) { errors.push(`${where}: there is no section called "${key}".`); continue; }
    if (item.type === 'page' && !pages.has(key)) { errors.push(`${where}: there is no page "${key}" in Pages.`); continue; }
    if ((item.type === 'folder' || item.type === 'redirect') && !SLUG.test(String(key || ''))) {
      errors.push(`${where}: the web address must be lower-case letters, numbers and hyphens.`); continue;
    }
    const id = idOf(item);
    if (byKey.has(id)) { errors.push(`${where}: "${key}" is in the tree twice${item.type === 'redirect' ? ' in the same place' : ''}.`); continue; }
    if (item.type === 'folder' && sections[key]) { errors.push(`${where}: "${key}" is the name of a section, so it can't be a folder.`); continue; }
    if (!FOOTER.has(item.footer || '')) errors.push(`${where}: footer must be empty, "primary" or "legal".`);
    if (item.type === 'redirect' && !/^(\/|https:\/\/)/.test(String(item.to || ''))) {
      errors.push(`${where}: a redirect goes to an address on this site (starting /) or a full https:// address.`);
    }
    byKey.set(id, { ...item, key, id, order: i });
  }

  // Sections the tree doesn't mention still exist: they go on the end, out of
  // the menu, so leaving one out can't take a part of the site down.
  for (const [id, s] of Object.entries(sections)) {
    if (!byKey.has(id)) byKey.set(id, { type: 'section', id, key: id, label: s.label, inNav: false, order: items.length + byKey.size });
  }

  const nodes = [...byKey.values()].sort((a, b) => a.order - b.order);
  const folders = nodes.filter((n) => n.type === 'folder');

  // Addresses, parents first. A section's address is its own; a folder's
  // default page takes the folder's address; everything else hangs off its
  // parent's address.
  const resolving = new Set();
  const pathOf = (node) => {
    if (node.path) return node.path;
    if (node.type === 'section') { node.path = sections[node.key].route; return node.path; }
    if (resolving.has(node.id)) { errors.push(`"${node.key}" is inside itself.`); return null; }
    resolving.add(node.id);
    let base = '/';
    let parent = null;
    if (node.parent) {
      parent = byKey.get(node.parent);
      if (!parent) errors.push(`"${node.key}": its parent "${node.parent}" isn't in the tree.`);
      else if (parent.type !== 'folder' && parent.type !== 'section') errors.push(`"${node.key}": only a folder or a section can have items inside it.`);
      else base = pathOf(parent) || '/';
    }
    resolving.delete(node.id);
    node.path = (parent && parent.type === 'folder' && parent.default === node.key && node.type === 'page')
      ? parent.path
      : joinPath(base, node.key);
    return node.path;
  };

  for (const node of nodes) {
    if (node.type === 'section' && node.showing === false) errors.push(`"${node.key}": a section can't be switched off, because other pages link to it. Take it out of the menu instead.`);
    pathOf(node);
  }
  // A section grouped under a folder: only where the folder's address leads
  // to the section's, so the grouping matches the address.
  for (const node of nodes.filter((n) => n.type === 'section' && n.parent)) {
    const parent = byKey.get(node.parent);
    if (!parent || parent.type !== 'folder') errors.push(`"${node.key}": a section can only be grouped under a folder.`);
    else if (parent.path && !node.path.startsWith(parent.path)) errors.push(`"${node.key}": its address ${node.path} isn't inside ${parent.path}, so it can't be grouped under "${parent.key}".`);
  }
  // A folder's default: a page or a section inside it.
  for (const folder of folders) {
    if (!folder.default) continue;
    const target = byKey.get(`page:${folder.default}`) || byKey.get(folder.default);
    if (!target || target.parent !== folder.key) errors.push(`"${folder.key}": its default page "${folder.default}" isn't inside it.`);
    else if (target.type === 'section' && target.path !== folder.path) errors.push(`"${folder.key}": the section "${target.key}" is at ${target.path}, not at the folder's own address ${folder.path}, so it can't be the default.`);
    else if (target.type === 'folder' || target.type === 'redirect') errors.push(`"${folder.key}": the default must be a page or a section.`);
  }

  // Showing: off here or on anything above, or a page not published for this
  // build, and it isn't on the site.
  const shown = (node) => {
    for (let n = node, hops = 0; n && hops < 50; n = n.parent ? byKey.get(n.parent) : null, hops += 1) {
      if (n.showing === false) return false;
      if (n.type === 'page' && !isPublished(pages.get(n.key))) return false;
    }
    return true;
  };
  for (const node of nodes) node.visible = shown(node);

  // One address each. A folder's address belongs to its default page (or
  // section), so the folder itself is left out of the check.
  const seen = new Map();
  for (const node of nodes.filter((n) => n.visible && n.path && n.type !== 'folder')) {
    if (seen.has(node.path)) errors.push(`"${node.key}" and "${seen.get(node.path)}" both have the address ${node.path}.`);
    else seen.set(node.path, node.key);
  }

  const children = (key) => nodes.filter((n) => n.parent === key && n.visible);
  const redirects = [];
  for (const node of nodes.filter((n) => n.visible)) {
    if (node.type === 'redirect') redirects.push({ from: node.path, to: node.to, status: node.permanent ? 301 : 302 });
    if (node.type === 'folder') {
      const target = node.default ? (byKey.get(`page:${node.default}`) || byKey.get(node.default)) : null;
      if (target && target.visible) node.goesTo = target.path;
      else if (!node.default) { const first = children(node.key).find((c) => c.type !== 'folder' || c.goesTo); if (first) node.goesTo = first.type === 'redirect' ? first.to : first.path; }
      if (node.goesTo && node.goesTo !== node.path) redirects.push({ from: node.path, to: node.goesTo, status: 302 });
    }
  }

  // Where a link to an item goes: a redirect straight to its target, a folder
  // to its default page. A folder with nothing showing inside links nowhere.
  const link = (node) => {
    if (node.type === 'redirect') return node.to;
    if (node.type === 'folder') return node.goesTo || null;
    return node.path;
  };
  const labelOf = (node) => String(node.label || '').trim()
    || (node.type === 'page' ? pages.get(node.key)?.title : '')
    || (node.type === 'section' ? sections[node.key].label : node.key);
  const linkable = (n) => n.visible && link(n);
  const entry = (node) => ({
    key: node.key,
    type: node.type,
    label: labelOf(node),
    path: link(node),
    external: /^https:/.test(link(node) || ''),
    newWindow: node.newWindow === true,
    // A folder's items marked for the menu are its dropdown.
    items: node.type === 'folder' ? children(node.key).filter((c) => c.inNav && linkable(c)).map((c) => ({ key: c.key, label: labelOf(c), path: link(c), external: /^https:/.test(link(c) || ''), newWindow: c.newWindow === true })) : [],
  });

  return {
    nodes,
    nav: nodes.filter((n) => !n.parent && n.inNav && linkable(n)).map(entry),
    footerPrimary: nodes.filter((n) => n.footer === 'primary' && linkable(n)).map(entry),
    footerLegal: nodes.filter((n) => n.footer === 'legal' && linkable(n)).map(entry),
    pages: nodes.filter((n) => n.type === 'page' && n.visible).map((n) => ({ page: pages.get(n.key), route: n.path, node: n })),
    sections: nodes.filter((n) => n.type === 'section').map((n) => ({ id: n.key, route: n.path, label: labelOf(n), node: n })),
    redirects,
    pathOf: (pageSlug) => byKey.get(`page:${pageSlug}`)?.path || null,
    errors,
  };
}
