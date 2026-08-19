import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';

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

const LASTMOD = {
  home: at('src/pages/index.astro', ...STATIONS),
  about: at('src/pages/about.astro'),
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
  if (path === '/compare/') return LASTMOD.compareIndex;
  if (path.startsWith('/compare/')) return LASTMOD.comparePair;
  return buildTime;
}

export default defineConfig({
  site: 'https://wattlibrary.com',
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = lastmodFor(item.url).toISOString();
        return item;
      },
    }),
  ],
  trailingSlash: 'always',
});
