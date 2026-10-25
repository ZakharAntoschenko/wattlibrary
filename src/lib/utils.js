// Derived metrics and shared helpers. All computed from power_stations.json at build time.

export const INVERTER_EFFICIENCY = 0.85;

export const GUIDE_URLS = {
  cpap: '/guides/power-station-for-cpap/',
  fridge: '/guides/power-station-for-refrigerator/',
};

// Compressor appliances are two problems, not one. Feeding them is an
// average-draw problem: the compressor cycles and runs roughly a third of the
// day, so the 24h average (EnergyGuide kWh/year ÷ 8,760) is what drains the
// pack. Starting them is a surge problem: every restart asks for 2–3× the
// running wattage for a second or two. The guides and the model cards both
// read these figures, so a card can never contradict a guide again.
export const COMPRESSOR_LOADS = [
  { key: 'mini', slug: 'mini-fridge', label: 'Mini fridge', average_w: 25, running_w: 80, surge_w: 400 },
  { key: 'full', slug: 'fridge', label: 'Full-size refrigerator', average_w: 60, running_w: 150, surge_w: 900 },
  { key: 'freezer', slug: 'chest-freezer', label: 'Chest freezer', average_w: 50, running_w: 130, surge_w: 800 },
];

// Continuous rating, not boost: boost is a short-term figure and a fridge
// runs for hours. The surge check is separate and uses the surge rating.
export function canStart(station, load) {
  return station.ac_surge_w >= load.surge_w && station.ac_output_w >= load.running_w;
}

const compressor = (key) => COMPRESSOR_LOADS.find((l) => l.key === key);

// Typical appliance draw in watts (running average, not nameplate). For
// compressor appliances `watts` is the 24h average and `load` carries the
// running and surge figures used for the start check.
export const APPLIANCES = [
  { slug: 'led-bulb', name: 'LED bulb', watts: 10 },
  { slug: 'wifi-router', name: 'Wi-Fi router + modem', watts: 15 },
  { slug: 'cpap', name: 'CPAP machine (no humidifier)', watts: 40, guide: GUIDE_URLS.cpap },
  { slug: 'starlink', name: 'Starlink (standard kit)', watts: 50 },
  { slug: 'fan', name: 'Box fan', watts: 50 },
  { slug: 'laptop', name: 'Laptop', watts: 60 },
  { slug: 'tv', name: '55" LED TV', watts: 100 },
  { slug: 'mini-fridge', name: 'Mini fridge', watts: compressor('mini').average_w, load: compressor('mini'), guide: GUIDE_URLS.fridge },
  { slug: 'fridge', name: 'Full-size refrigerator', watts: compressor('full').average_w, load: compressor('full'), guide: GUIDE_URLS.fridge },
  { slug: 'chest-freezer', name: 'Chest freezer', watts: compressor('freezer').average_w, load: compressor('freezer'), guide: GUIDE_URLS.fridge },
  { slug: 'coffee-maker', name: 'Coffee maker', watts: 900 },
  { slug: 'microwave', name: 'Microwave (700W cooking)', watts: 1000 },
  { slug: 'space-heater', name: 'Space heater', watts: 1500 },
];

export function runtimeHours(station, watts) {
  if (watts > effectiveOutput(station)) return null; // can't run it
  return (station.capacity_wh * INVERTER_EFFICIENCY) / watts;
}

// Runtime for one APPLIANCES entry, with the reason when there is none.
// A compressor that the unit cannot start gets no runtime at all, however
// many watt-hours are in the pack.
export function applianceRuntime(station, appliance) {
  if (appliance.load && !canStart(station, appliance.load)) return { hours: null, reason: 'surge' };
  const hours = runtimeHours(station, appliance.watts);
  return hours === null ? { hours: null, reason: 'output' } : { hours, reason: null };
}

export function effectiveOutput(station) {
  return station.boost_mode_w && station.boost_mode_w > station.ac_output_w
    ? station.boost_mode_w
    : station.ac_output_w;
}

// Rounded DOWN everywhere, cards and guides alike: 0.96 of a night is not a
// night, and two pages rounding the same estimate differently read as two
// different answers.
const floor1 = (x) => Math.floor(x * 10) / 10;

export function formatRuntime(hours) {
  if (hours === null) return null;
  if (hours >= 48) return `${floor1(hours / 24)} days`;
  if (hours >= 10) return `${Math.floor(hours)} hours`;
  if (hours >= 1) {
    const h = floor1(hours);
    return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  return `${Math.floor(hours * 60)} minutes`;
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
// "runs a fridge ~14 h" line in meta descriptions. Short labels and short
// units on purpose: every character saved here is one the snippet can spend
// on another number. A fridge is named without watts: its average (60W) is
// not a number anyone recognises from their fridge, and its plate figure
// (150W) is not what the runtime is based on.
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

// CPAP before laptop: at a 60W fridge average a laptop would just repeat the
// fridge's number, and CPAP runtime is one of the questions people bring here.
export function headlineRuntimes(station, slugs = ['fridge', 'cpap', 'laptop', 'wifi-router']) {
  const out = [];
  for (const slug of slugs) {
    const a = APPLIANCES.find((x) => x.slug === slug);
    const h = a && applianceRuntime(station, a).hours;
    if (h) {
      const label = META_LABELS[slug] ?? a.name.toLowerCase();
      out.push({ phrase: a.load ? `a ${label}` : `a ${a.watts}W ${label}`, text: shortRuntime(h) });
    }
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
