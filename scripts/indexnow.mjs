#!/usr/bin/env node
// Pings IndexNow (Bing, Yandex, Seznam, Naver) with the URLs a deploy actually
// changed. Bing flagged "IndexNow not configured" as a High recommendation; the
// sitemap alone gets re-read every few weeks, this gets read in minutes.
//
// Usage:
//   node scripts/indexnow.mjs                 # URLs affected by HEAD~1..HEAD
//   node scripts/indexnow.mjs --base <sha>    # explicit diff base
//   node scripts/indexnow.mjs --all           # every URL on the site
//   node scripts/indexnow.mjs --dry-run       # print, don't submit
//   node scripts/indexnow.mjs --no-wait       # skip waiting for the deploy
//
// Why a file diff and not the sitemap's lastmod: on Cloudflare the build runs
// from a shallow clone, so every route reports the build time and "recently
// changed" would mean "all 58 URLs, every deploy". The diff is exact.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'wattlibrary.com';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000; // protocol limit per request

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

// ---------------------------------------------------------------- key
function readKey() {
  const file = readdirSync(join(ROOT, 'public')).find((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
  if (!file) throw new Error('No IndexNow key file in public/ — expected <key>.txt');
  const key = readFileSync(join(ROOT, 'public', file), 'utf8').trim();
  if (file !== `${key}.txt`) throw new Error(`Key file name ${file} does not match its contents`);
  return key;
}

// ---------------------------------------------------------------- routes
const stations = JSON.parse(readFileSync(join(ROOT, 'src/data/power_stations.json'), 'utf8')).power_stations;
const pairs = JSON.parse(readFileSync(join(ROOT, 'src/data/compare_pairs.json'), 'utf8')).pairs;

const MODEL_URLS = stations.map((s) => `${ORIGIN}/power-stations/${s.slug}/`);
const PAIR_URLS = pairs.map((p) => `${ORIGIN}/compare/${p.a}-vs-${p.b}/`);
const STATIC_URLS = [`${ORIGIN}/`, `${ORIGIN}/about/`, `${ORIGIN}/power-stations/`, `${ORIGIN}/compare/`];
const ALL_URLS = [...STATIC_URLS, ...MODEL_URLS, ...PAIR_URLS];

// Which URLs a changed source file can affect. Anything shared (layout, helpers,
// data, config) invalidates the whole site, which is correct and still cheap.
const RULES = [
  [/^src\/layouts\//, () => ALL_URLS],
  [/^src\/lib\//, () => ALL_URLS],
  [/^src\/data\//, () => ALL_URLS],
  [/^astro\.config\.mjs$/, () => ALL_URLS],
  [/^src\/pages\/index\.astro$/, () => [`${ORIGIN}/`]],
  [/^src\/pages\/about\.astro$/, () => [`${ORIGIN}/about/`]],
  [/^src\/pages\/power-stations\/index\.astro$/, () => [`${ORIGIN}/power-stations/`]],
  [/^src\/pages\/power-stations\/\[slug\]\.astro$/, () => MODEL_URLS],
  [/^src\/pages\/compare\/index\.astro$/, () => [`${ORIGIN}/compare/`]],
  [/^src\/pages\/compare\/\[pair\]\.astro$/, () => PAIR_URLS],
  [/^src\/pages\/404\.astro$/, () => []], // never worth submitting
  [/^public\//, () => []], // assets, robots, key file — not indexable pages
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

// ---------------------------------------------------------------- deploy wait
// Cloudflare builds after the push, so pinging immediately can point the
// crawler at the previous build. The sitemap's lastmod moves on every deploy,
// which makes it a reliable "the new build is live" marker.
async function waitForDeploy(since, { timeoutMs = 10 * 60_000, everyMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ORIGIN}/sitemap-0.xml`, { cache: 'no-store' });
      if (res.ok) {
        const xml = await res.text();
        const stamps = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => Date.parse(m[1]));
        const newest = stamps.length ? Math.max(...stamps) : 0;
        if (newest >= since) {
          console.log(`Deploy is live (sitemap lastmod ${new Date(newest).toISOString()}).`);
          return true;
        }
      }
    } catch (err) {
      console.log(`Sitemap not reachable yet: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  console.log('Timed out waiting for the deploy; submitting anyway.');
  return false;
}

// ---------------------------------------------------------------- submit
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
  // 200 accepted, 202 accepted but key still being validated. Anything else fails the job.
  if (![200, 202].includes(res.status)) process.exit(1);
}

// ---------------------------------------------------------------- main
const key = readKey();
const urls = has('--all') ? ALL_URLS : urlsForFiles(changedFiles(valueOf('--base')));

if (urls.length === 0) {
  console.log('No indexable URL changed in this push — nothing to submit.');
  process.exit(0);
}

console.log(`${urls.length} URL(s) to submit:`);
for (const u of urls) console.log(`  ${u}`);

if (has('--dry-run')) process.exit(0);
if (!has('--no-wait')) await waitForDeploy(Date.now() - 60_000);
await submit(urls, key);
