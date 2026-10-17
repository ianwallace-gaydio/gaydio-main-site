# Changelog

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
