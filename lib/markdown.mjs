/* Story text, from the editor's Markdown to the page's HTML.
 *
 * The editor gives people bold, italic, links, lists and subheadings, and
 * stores what they write as Markdown. This turns that into HTML at build time.
 *
 * It is deliberately small and deliberately strict, because it is the one place
 * text somebody typed into a browser becomes markup on the public website:
 *
 *   - Everything is escaped FIRST. A `<script>` or an `<img onerror=...>` typed
 *     into a story comes out as visible text, never as an element. Raw HTML is
 *     not a feature here, and there is no switch to turn it on.
 *   - A link's address must be https, http, mailto, or a path on this site.
 *     Escaping stops an address breaking out of its attribute; it says nothing
 *     about what the address IS, and `javascript:` escapes perfectly well.
 *     Anything else is rendered as plain text, so the reader still sees the
 *     words and nothing runs.
 *   - Only what the editor's toolbar offers is recognised: paragraphs, `##` and
 *     `###` subheadings, bulleted and numbered lists, **bold**, *italic* and
 *     [links](https://...). Anything else stays as the characters typed.
 *
 * A story body that is still an array of paragraphs (the format before the
 * editor existed) is accepted too, and rendered as plain paragraphs.
 */

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

/** The address a link may point at, or null. Checked on the raw text, before escaping. */
export function safeHref(raw) {
  const href = String(raw || '').trim();
  if (!href) return null;
  // Control characters and whitespace inside a scheme are how `java\tscript:`
  // gets past a naive check, so an address carrying any of them is refused.
  if (/[\u0000- \u007F]/.test(href)) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return href;
  // A path on this site. `//host` is another site wearing a path's clothes.
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (href.startsWith('#')) return href;
  return null;
}

/* Inline formatting on text that has ALREADY been escaped. Links are matched
   first, and their text is formatted but their address is taken from the
   escaped source, un-escaped for the check, and re-escaped for the attribute. */
function inline(escaped) {
  const unescape = (s) => s
    .replaceAll('&quot;', '"').replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

  const parts = [];
  let last = 0;
  const linkPattern = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  for (const match of escaped.matchAll(linkPattern)) {
    parts.push(emphasis(escaped.slice(last, match.index)));
    const href = safeHref(unescape(match[2]));
    const text = emphasis(match[1]);
    if (href) {
      const external = /^https?:\/\//i.test(href) ? ' rel="external"' : '';
      parts.push(`<a href="${escapeHtml(href)}"${external}>${text}</a>`);
    } else {
      parts.push(text);
    }
    last = match.index + match[0].length;
  }
  parts.push(emphasis(escaped.slice(last)));
  return parts.join('');
}

function emphasis(text) {
  return text
    .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([^_\n]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?=\S)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w_])_(?=\S)([^_\n]+?)_(?![\w_])/g, '$1<em>$2</em>');
}

/** Markdown (or a legacy array of paragraphs) to HTML. */
export function renderStoryBody(body) {
  if (Array.isArray(body)) {
    return body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  }

  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = null; // { tag: 'ul' | 'ol', items: [] }

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(escapeHtml(paragraph.join(' ')))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(escapeHtml(item))}</li>`).join('')}</${list.tag}>`);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const tag = heading[1].length === 2 ? 'h2' : 'h3';
      out.push(`<${tag}>${inline(escapeHtml(heading[2]))}</${tag}>`);
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push((bullet || numbered)[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return out.join('');
}
