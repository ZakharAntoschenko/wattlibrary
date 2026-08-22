// Derived metrics and shared helpers. All computed from power_stations.json at build time.

export const INVERTER_EFFICIENCY = 0.85;

// Typical appliance draw in watts (running average, not nameplate).
export const APPLIANCES = [
  { slug: 'led-bulb', name: 'LED bulb', watts: 10 },
  { slug: 'wifi-router', name: 'Wi-Fi router + modem', watts: 15 },
  { slug: 'cpap', name: 'CPAP machine (no humidifier)', watts: 40 },
  { slug: 'starlink', name: 'Starlink (standard kit)', watts: 50 },
  { slug: 'fan', name: 'Box fan', watts: 50 },
  { slug: 'laptop', name: 'Laptop', watts: 60 },
  { slug: 'tv', name: '55" LED TV', watts: 100 },
  { slug: 'fridge', name: 'Full-size refrigerator (avg)', watts: 150 },
  { slug: 'mini-fridge', name: 'Mini fridge (avg)', watts: 60 },
  { slug: 'coffee-maker', name: 'Coffee maker', watts: 900 },
  { slug: 'microwave', name: 'Microwave (700W cooking)', watts: 1000 },
  { slug: 'space-heater', name: 'Space heater', watts: 1500 },
];

export function runtimeHours(station, watts) {
  if (watts > effectiveOutput(station)) return null; // can't run it
  return (station.capacity_wh * INVERTER_EFFICIENCY) / watts;
}

export function effectiveOutput(station) {
  return station.boost_mode_w && station.boost_mode_w > station.ac_output_w
    ? station.boost_mode_w
    : station.ac_output_w;
}

export function formatRuntime(hours) {
  if (hours === null) return null;
  if (hours >= 48) return `${Math.round(hours / 24)} days`;
  if (hours >= 10) return `${Math.round(hours)} hours`;
  if (hours >= 1) return `${hours.toFixed(1)} hours`;
  return `${Math.round(hours * 60)} minutes`;
}

export function dollarsPerWh(station) {
  return station.msrp_usd / station.capacity_wh;
}

export function whPerKg(station) {
  return station.capacity_wh / station.weight_kg;
}

export function fullName(station) {
  return `${station.brand} ${station.model}`;
}

// Meta descriptions must stay under 160 chars (Bing rejects longer ones;
// Google truncates around the same point). Trims at a word boundary.
export function clampMeta(text, max = 158) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\-–—]$/, '') + '…';
}

// Builds a meta description out of ranked sentences: keeps adding them while
// the result still fits, so the number a searcher typed survives the truncation
// and the boilerplate tail is what gets dropped.
export function metaFromParts(parts, max = 158) {
  let out = '';
  for (const part of parts.filter(Boolean)) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  return out || clampMeta(parts.filter(Boolean)[0] ?? '', max);
}

// Two appliances this unit can actually run, heaviest first, for the
// "runs a 150W fridge ~1.5 h" line in meta descriptions. Short labels and
// short units on purpose: every character saved here is one the snippet can
// spend on another number.
const META_LABELS = {
  fridge: 'fridge',
  laptop: 'laptop',
  cpap: 'CPAP',
  'wifi-router': 'router',
  'mini-fridge': 'mini fridge',
  tv: 'TV',
};

function shortRuntime(hours) {
  return formatRuntime(hours).replace(/ hours?$/, ' h').replace(/ minutes$/, ' min');
}

export function headlineRuntimes(station, slugs = ['fridge', 'laptop', 'cpap', 'wifi-router']) {
  const out = [];
  for (const slug of slugs) {
    const a = APPLIANCES.find((x) => x.slug === slug);
    const h = a && runtimeHours(station, a.watts);
    if (h) out.push({ name: META_LABELS[slug] ?? a.name.toLowerCase(), watts: a.watts, text: shortRuntime(h) });
    if (out.length === 2) break;
  }
  return out;
}

// Titles get cut around 60 characters in both Google and Bing, and the model
// names here run long. Take the most informative variant that survives intact.
export function pickTitle(candidates, max = 60) {
  const list = candidates.filter(Boolean);
  return list.find((c) => c.length <= max) ?? list[list.length - 1];
}

export function chemistryLabel(station) {
  return station.chemistry === 'LFP' ? 'LiFePO4' : 'NMC lithium';
}

// 3 closest-capacity alternatives from other brands.
export function alternatives(station, all, n = 3) {
  return all
    .filter((s) => s.slug !== station.slug && s.brand !== station.brand)
    .sort(
      (a, b) =>
        Math.abs(a.capacity_wh - station.capacity_wh) -
        Math.abs(b.capacity_wh - station.capacity_wh)
    )
    .slice(0, n);
}

// Closest-capacity models from the SAME brand. Complements alternatives(),
// which deliberately only returns other brands.
export function sameBrandSiblings(station, all, n = 3) {
  return all
    .filter((s) => s.slug !== station.slug && s.brand === station.brand)
    .sort(
      (a, b) =>
        Math.abs(a.capacity_wh - station.capacity_wh) -
        Math.abs(b.capacity_wh - station.capacity_wh)
    )
    .slice(0, n);
}

export function capacityClass(wh) {
  if (wh < 500) return 'Small (under 500Wh)';
  if (wh < 1500) return 'Mid-size (500–1,500Wh)';
  if (wh < 3000) return 'Large (1,500–3,000Wh)';
  return 'Home backup (3,000Wh+)';
}
