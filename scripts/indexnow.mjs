#!/usr/bin/env node
// Pings IndexNow (Bing, Yandex, Seznam, Naver) with the indexable URLs a deploy
// actually changed. Strictly mirrors the sitemap's indexable URL set so noindex
// pages are never submitted.
//
// Usage:
//   node scripts/indexnow.mjs                 # URLs affected by HEAD~1..HEAD
//   node scripts/indexnow.mjs --base <sha>    # explicit diff base
//   node scripts/indexnow.mjs --all           # every indexable URL on the site
//   node scripts/indexnow.mjs --dry-run       # print, don't submit
//   node scripts/indexnow.mjs --no-wait       # skip waiting for the deploy

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'wattlibrary.com';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

function readKey() {
  const file = readdirSync(join(ROOT, 'public')).find((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
  if (!file) throw new Error('No IndexNow key file in public/ — expected <key>.txt');
  const key = readFileSync(join(ROOT, 'public', file), 'utf8').trim();
  if (file !== `${key}.txt`) throw new Error(`Key file name ${file} does not match its contents`);
  return key;
}

const brandSlug = (brand) =>
  brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const db = JSON.parse(readFileSync(join(ROOT, 'src/data/power_stations.json'), 'utf8'));
const stations = db.power_stations;
const pairs = JSON.parse(readFileSync(join(ROOT, 'src/data/compare_pairs.json'), 'utf8')).pairs;

const MODEL_URLS = stations.map((s) => `${ORIGIN}/power-stations/${s.slug}/`);
const BRAND_URLS = [
  `${ORIGIN}/brands/`,
  ...[...new Set(stations.map((s) => s.brand))].map((b) => `${ORIGIN}/brands/${brandSlug(b)}/`),
];
// Only submit indexable comparison pages (matches astro.config.mjs sitemap filter).
const PAIR_URLS = pairs
  .filter((p) => p.index === true)
  .map((p) => `${ORIGIN}/compare/${p.a}-vs-${p.b}/`);
const STATIC_URLS = [
  `${ORIGIN}/`,
  `${ORIGIN}/about/`,
  `${ORIGIN}/calculator/`,
  `${ORIGIN}/power-stations/`,
  `${ORIGIN}/compare/`,
];
const GUIDE_URLS = [
  '',
  'power-station-for-cpap/',
  'power-station-for-refrigerator/',
  'power-station-for-starlink/',
  'power-station-for-home-office-ups/',
  'power-station-for-space-heater/',
  'solar-panel-compatibility/',
].map((p) => `${ORIGIN}/guides/${p}`);

const ALL_URLS = [...STATIC_URLS, ...BRAND_URLS, ...GUIDE_URLS, ...MODEL_URLS, ...PAIR_URLS];

const RULES = [
  [/^src\/layouts\//, () => ALL_URLS],
  [/^src\/lib\//, () => ALL_URLS],
  [/^src\/data\//, () => ALL_URLS],
  [/^astro\.config\.mjs$/, () => ALL_URLS],
  [/^src\/pages\/index\.astro$/, () => [`${ORIGIN}/`]],
  [/^src\/pages\/about\.astro$/, () => [`${ORIGIN}/about/`]],
  [/^src\/pages\/calculator\.astro$/, () => [`${ORIGIN}/calculator/`]],
  [/^src\/pages\/power-stations\/index\.astro$/, () => [`${ORIGIN}/power-stations/`]],
  [/^src\/pages\/power-stations\/\[slug\]\.astro$/, () => MODEL_URLS],
  [/^src\/pages\/brands\//, () => BRAND_URLS],
  [/^src\/pages\/compare\/index\.astro$/, () => [`${ORIGIN}/compare/`]],
  [/^src\/pages\/compare\/\[pair\]\.astro$/, () => PAIR_URLS],
  [/^src\/pages\/guides\//, () => GUIDE_URLS],
  [/^src\/pages\/404\.astro$/, () => []],
  [/^public\//, () => []],
];

function changedFiles(base) {
  const range = base ? `${base}..HEAD` : 'HEAD~1..HEAD';
  const out = execSync(`git diff --name-only ${range}`, { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

function urlsForFiles(files) {
  const set = new Set();
  for (const f of files) {
    const rule = RULES.find(([re]) => re.test(f));
    if (rule) for (const u of rule[1]()) set.add(u);
  }
  return [...set];
}

// Wait briefly for Cloudflare Pages to finish building after push, and confirm
// the sitemap is reachable with our expected URL count before pinging IndexNow.
async function waitForDeploy(expectedCount, { timeoutMs = 4 * 60_000, everyMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  await new Promise((r) => setTimeout(r, 30_000));
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ORIGIN}/sitemap-0.xml`, { cache: 'no-store' });
      if (res.ok) {
        const xml = await res.text();
        const locs = xml.match(/<loc>/g)?.length ?? 0;
        if (locs >= expectedCount) {
          console.log(`Deploy verified live (sitemap has ${locs} URLs).`);
          return true;
        }
      }
    } catch (err) {
      console.log(`Sitemap not reachable yet: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  console.log('Timed out waiting for updated sitemap; submitting anyway.');
  return false;
}

async function submit(urlList, key) {
  const body = {
    host: HOST,
    key,
    keyLocation: `${ORIGIN}/${key}.txt`,
    urlList: urlList.slice(0, MAX_URLS),
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`IndexNow responded ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
  if (![200, 202].includes(res.status)) process.exit(1);
}

const key = readKey();
const urls = has('--all') ? ALL_URLS : urlsForFiles(changedFiles(valueOf('--base')));

if (urls.length === 0) {
  console.log('No indexable URL changed in this push — nothing to submit.');
  process.exit(0);
}

console.log(`${urls.length} URL(s) to submit:`);
for (const u of urls) console.log(`  ${u}`);

if (has('--dry-run')) process.exit(0);
if (!has('--no-wait')) await waitForDeploy(ALL_URLS.length);
await submit(urls, key);
