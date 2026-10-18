# Changelog

## 0.1.2 (18 Oct 2026)

Back to Cloudflare Pages. The hub's Site Editor is built for Pages projects
(draft previews on branch aliases, cache purge, the site list) and the other
five Gaydio sites run the same way, so the Worker made by the dashboard's
Create flow in 0.1.1 is deleted and wrangler.toml is the Pages shape again,
which also stops Pages warning that the file is invalid. The Pages project is
gaydio-main at gaydio-main.pages.dev. Adds the nightly rebuild workflow
(needs the CF_PAGES_DEPLOY_HOOK secret) so scheduled blocks and sectional
items appear and expire without anybody publishing.

## 0.1.1 (17 Oct 2026)

Deploys as a Cloudflare Worker with static assets instead of a Pages project,
because the dashboard's Create flow made a Worker and the first deploy failed
on the Pages-only wrangler.toml. wrangler.toml now names the Worker
gaydio-main-site and serves dist/ as assets with 404.html for anything not
found. The site's preview address is gaydio-main-site.gaydio.workers.dev.
_headers and _redirects work unchanged.

## 0.1.0 (17 Oct 2026)

First build: the skeleton of the Gaydio website, hidden from search, with the
page tree from the brief (Radio, Podcasts, What's New, Win, Events, Connect,
Academy, and the hidden folders), placeholder pages at every address from the
brief's section 14, the footer links, the homepage and page columns as block
lists with placeholders for the live blocks, sectionals, Site Settings, Theme
Settings with the time-of-day header, and the Site Editor configuration. No
words or pictures from the live site yet.
