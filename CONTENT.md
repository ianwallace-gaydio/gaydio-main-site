# Changing the Gaydio website

**Most of the time you want the Site Editor, not this file:** hub.gaydio.co.uk/siteeditor,
with "Gaydio (main site)" chosen at the top. It needs no code and no deploy and
changes exactly the content described here. This file is for changing things in
the repository directly.

## Pages (`content/pages/`)

One JSON file per page, named after its slug.

| Field | What it is |
|---|---|
| `title` | The heading on the page and the default browser title |
| `slug` | The last part of the address. Where the page sits is the page tree's to say |
| `summary` | The description for search results and sharing, and the summary when the page is tagged into a sectional |
| `body` | Markdown: paragraphs, `##` and `###` headings, lists, bold, italic, links. Everything else comes out as the characters typed |
| `template` | `pages` (with the secondary column), `pages-wide`, or `plain` |
| `sectionals` | Sectionals shown under the body, by identifier, in order |
| `metaTitle`, `keywords`, `shareImage` | Aiir's Metadata panel |
| `showFrom`, `showUntil` | Aiir's Page Available: outside them the page is off the public site and the navigation |
| `editorNotes` | Never shown |

## Sectionals (`content/sectionals/`)

An internal `title`, an identifier `slug`, a `layout` (`cards`, `list`, `lead`),
`randomise` with `pinFirst`, `limit`, `hideExpired`, and `items`. An item is one of:

- `link`: `title`, `summary`, `image`, `link`, `newWindow`
- `page`: `page` (a page's slug); it takes the page's title, summary and share picture unless overridden
- `content`: `title`, `summary`, `image`

Every item can have `start` and `end` (London time, `2026-10-17T09:00`).

## Content areas (`content/content-areas.json`)

Three areas, as on Gaydio's Aiir theme: `homepagePrimary`, `pagesSecondary`,
`pagesUnderContent`. Each is a list of blocks: `name`, `type`, optional `start`
and `end`, and `settings`. The types are in `lib/blocks.mjs`; `sectional` and
`customHtml` are real, the rest draw placeholders until built.

## The page tree (`content/page-tree.json`)

Page Manager. Four kinds of item: `section` (a part of the site the build makes,
fixed address), `page`, `folder`, `redirect`. `parent` names the folder (or
section) an item sits in. A folder's `default` is the page or section served at
the folder's own address. `inNav` puts a top-level item in the menu, or a
folder's item in its dropdown. `footer` is `primary` (the footer links) or
`legal`. `showing: false` takes an item and everything in it off the site. A
mistake stops the build with a message and the live site stays as it was.

## Settings and theme

`content/settings.json` is Site Settings (names, description, the Listen button,
social addresses, the footer line). `content/theme.json` is Theme Settings: logo,
colours, and the three time-of-day header images with the hours each shows.

## Adding a block type or a section

A block type is an entry in `lib/blocks.mjs` plus a renderer, and an option in
`public/admin/config.yml`. A section is an entry in `SECTIONS` in `build.mjs`
plus an option in the page tree's section list in `config.yml`.
`tests/editor.test.mjs` fails if the two lists drift apart.
