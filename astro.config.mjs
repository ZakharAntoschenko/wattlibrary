import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// lastmod is only useful to Google if it is honest. A blanket build timestamp
// claims every page changed on every deploy, so instead each route reports the
// last commit that touched the sources it is actually rendered from: its own
// template, the shared layout/helpers, and the data files it reads.
// Falls back to build time when git history isn't available (shallow CI clone).
const buildTime = new Date();

function lastCommit(paths) {
  try {
    const out = execSync(`git log -1 --format=%cI -- ${paths.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? new Date(out) : null;
  } catch {
    return null; // no git, no history, or not a repo
  }
}

const SHARED = ['src/layouts/Base.astro', 'src/lib/utils.js'];
const STATIONS = ['src/data/power_stations.json'];
const PAIRS = ['src/data/compare_pairs.json', 'src/lib/compare.js'];

const at = (...paths) => lastCommit([...SHARED, ...paths]) ?? buildTime;

const GUIDES = ['src/lib/guides.js'];

const LASTMOD = {
  home: at('src/pages/index.astro', ...STATIONS),
  about: at('src/pages/about.astro'),
  guideIndex: at('src/pages/guides/index.astro', ...STATIONS),
  guideCpap: at('src/pages/guides/power-station-for-cpap.astro', ...STATIONS, ...GUIDES),
  guideFridge: at('src/pages/guides/power-station-for-refrigerator.astro', ...STATIONS, ...GUIDES),
  catalogue: at('src/pages/power-stations/index.astro', ...STATIONS, ...PAIRS),
  model: at('src/pages/power-stations/[slug].astro', ...STATIONS, ...PAIRS),
  compareIndex: at('src/pages/compare/index.astro', ...STATIONS, ...PAIRS),
  comparePair: at('src/pages/compare/[pair].astro', ...STATIONS, ...PAIRS),
};

function lastmodFor(url) {
  const path = new URL(url).pathname;
  if (path === '/') return LASTMOD.home;
  if (path === '/about/') return LASTMOD.about;
  if (path === '/power-stations/') return LASTMOD.catalogue;
  if (path.startsWith('/power-stations/')) return LASTMOD.model;
  if (path === '/guides/') return LASTMOD.guideIndex;
  if (path === '/guides/power-station-for-cpap/') return LASTMOD.guideCpap;
  if (path === '/guides/power-station-for-refrigerator/') return LASTMOD.guideFridge;
  if (path === '/compare/') return LASTMOD.compareIndex;
  if (path.startsWith('/compare/')) return LASTMOD.comparePair;
  return buildTime;
}

// Template comparisons without their own verdict carry noindex (see
// compare_pairs.json); a noindex URL in the sitemap is a mixed signal, so the
// sitemap lists only the pairs marked "index": true.
const pairs = JSON.parse(readFileSync(new URL('./src/data/compare_pairs.json', import.meta.url), 'utf8')).pairs;
const NOINDEX_PATHS = new Set(pairs.filter((p) => p.index !== true).map((p) => `/compare/${p.a}-vs-${p.b}/`));

export default defineConfig({
  site: 'https://wattlibrary.com',
  integrations: [
    sitemap({
      filter: (page) => !NOINDEX_PATHS.has(new URL(page).pathname),
      serialize(item) {
        item.lastmod = lastmodFor(item.url).toISOString();
        return item;
      },
    }),
  ],
  trailingSlash: 'always',
});
