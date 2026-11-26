import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

// Explicit, shallow-clone-safe lastmod dates. Relying on `git log` breaks on
// Cloudflare Pages shallow clones (depth=1), causing every deploy to stamp
// every URL with the build timestamp — which trains Google to ignore lastmod.
// Data-driven pages inherit the database `updated` date; individual static and
// guide pages record when their content actually changed.
const db = JSON.parse(readFileSync(new URL('./src/data/power_stations.json', import.meta.url), 'utf8'));
const pairs = JSON.parse(readFileSync(new URL('./src/data/compare_pairs.json', import.meta.url), 'utf8')).pairs;

const DATA_UPDATED = `${db.updated}T00:00:00.000Z`;

const ROUTE_LASTMOD = {
  '/': DATA_UPDATED,
  '/about/': '2026-11-26T00:00:00.000Z',
  '/calculator/': DATA_UPDATED,
  '/power-stations/': DATA_UPDATED,
  '/brands/': DATA_UPDATED,
  '/compare/': DATA_UPDATED,
  '/guides/': DATA_UPDATED,
  '/guides/power-station-for-cpap/': DATA_UPDATED,
  '/guides/power-station-for-refrigerator/': DATA_UPDATED,
  '/guides/power-station-for-starlink/': DATA_UPDATED,
  '/guides/power-station-for-home-office-ups/': DATA_UPDATED,
  '/guides/power-station-for-space-heater/': DATA_UPDATED,
  '/guides/solar-panel-compatibility/': DATA_UPDATED,
};

function lastmodFor(url) {
  const path = new URL(url).pathname;
  return ROUTE_LASTMOD[path] ?? DATA_UPDATED;
}

// Secondary comparison pairs carry noindex, follow; filter them out of the
// sitemap so Google and Bing never see mixed sitemap + noindex signals.
const NOINDEX_PATHS = new Set(
  pairs.filter((p) => p.index !== true).map((p) => `/compare/${p.a}-vs-${p.b}/`)
);

export default defineConfig({
  site: 'https://wattlibrary.com',
  integrations: [
    sitemap({
      filter: (page) => !NOINDEX_PATHS.has(new URL(page).pathname),
      serialize(item) {
        item.lastmod = lastmodFor(item.url);
        return item;
      },
    }),
  ],
  trailingSlash: 'always',
});
