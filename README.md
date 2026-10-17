# Gaydio website (gaydio-main-site)

The Gaydio website, www.gaydio.co.uk, being rebuilt off Aiir onto Gaydio's own
systems. Edited in the hub's Site Editor (hub.gaydio.co.uk/siteeditor, "Gaydio
(main site)"), built by Cloudflare Pages on every push to `main`.

**Status: being built.** No custom domain, hidden from search engines, behind
a Cloudflare Access policy for Ian and Kriss. gaydio.co.uk's DNS is not
touched by anything here. The project plan is in the hub repo:
`docs/aiir-rebuild-pack/PROJECT-HANDOVER.md` and `docs/aiir-migration.md`.

## How it works

The same shape as the Academy site and OutThere GM: content is JSON in
`content/`, one file per item, and `build.mjs` renders it into `dist/`, one
real page per address, with no framework and no dependencies. The build runs
the same way on a laptop and on Cloudflare.

```
content/
  pages/              one file per page: title, summary, body (Markdown),
                      template, metadata, availability dates
  sectionals/         reusable card lists, as in Aiir (link, tagged page, content)
  content-areas.json  the homepage and page columns as ordered block lists
                      (Aiir's Template Builder > Content Areas)
  page-tree.json      every page in order, folders, redirects, the menu and
                      the footer (Aiir's Page Manager)
  settings.json       Site Settings
  theme.json          Theme Settings, including the time-of-day headers
public/
  assets/             stylesheet, script, fonts (Effra), pictures
  admin/config.yml    the content model the Site Editor reads. Never published
  _headers _redirects _routes.json robots.txt 404.html
lib/
  page-tree.mjs       the tree's rules (addresses, menu, footer, redirects)
  blocks.mjs          the block registry: what a content area can hold
  markdown.mjs        page text to HTML, everything escaped
  dates.mjs           start and end dates in London time
build.mjs             content -> dist/
tests/                npm test: builds, then checks the built site
```

**Hybrid, by decision (Ian, 17 Oct 2026):** what the Site Editor edits
(pages, sectionals, navigation, settings, theme) lives here in git and is
built into static pages. Anything live or with entries (now playing, the
schedule, news, the guide, competition entries, ads, the Listener Club) is
held by the hub Worker and read by the page, never committed here. The
blocks and sections for those draw a labelled placeholder until each is
built; `lib/blocks.mjs` lists them.

## Addresses

The page tree sets every address, as Aiir's Page Manager does: a folder is a
level of address, a page's address is its folder's plus its own slug, a
folder's default page is served at the folder's own address, and a section
(the schedule, news, the guide...) has a fixed address the build makes. The
addresses in the brief's section 14 are kept, so the cut-over needs a 301
only where an address is chosen to change. Localised addresses (`/uk/...`)
are not built yet: see the migration register.

## Running it

```
npm run build     # dist/
npm start         # build and serve on http://localhost:8099
npm test          # build, then the tests
```

Node 22 or later. No `npm install` is needed: there are no dependencies.

`PUBLIC_SITE=true npm run build` is the launch build: pages ask to be
indexed and the sitemap lists them. Until then every build is noindex. At
launch, also remove the `X-Robots-Tag` line from `public/_headers` and the
`Disallow` from `public/robots.txt`.

## Cloudflare

Pages project `gaydio-main`, connected to this repository: production branch
`main`, build command `npm run build`, output directory `dist`. Scheduled
blocks and sectional items appear and expire at build time, so a nightly
rebuild (a deploy hook, as OutThere has) is needed once anything is scheduled.
