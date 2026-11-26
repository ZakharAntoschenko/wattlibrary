// Derived metrics and shared helpers. All computed from power_stations.json at build time.

export const INVERTER_EFFICIENCY = 0.85;
export const SOLAR_EFFECTIVE_FACTOR = 0.78; // real-world panel harvest (~85% of STC) × ~92% MPPT/charge efficiency

export const GUIDE_URLS = {
  cpap: '/guides/power-station-for-cpap/',
  fridge: '/guides/power-station-for-refrigerator/',
  starlink: '/guides/power-station-for-starlink/',
  ups: '/guides/power-station-for-home-office-ups/',
  heater: '/guides/power-station-for-space-heater/',
  solar: '/guides/solar-panel-compatibility/',
};

export const BRAND_INFO = {
  EcoFlow: {
    summary: 'Known for very fast wall charging (X-Stream), XT60 solar ports, and broad capacity expansion across the DELTA line.',
    connectorNote: 'Most models use standard XT60 (or XT60i) solar inputs, making third-party solar panels straightforward to connect.',
    strengths: 'Fast AC recharge, sub-10ms UPS on Gen 3 models, strong expansion ecosystem.',
  },
  Bluetti: {
    summary: 'Heavy focus on long-life LiFePO4 packs (up to 6,000 cycles on the Elite 200 V2) and high solar input ceilings.',
    connectorNote: 'Newer models (AC70, Elite 100 V2, Elite 200 V2) use XT60; older models use DC7909 with an included MC4 adapter cable.',
    strengths: 'High cycle-life ratings, 1,000W+ solar on compact units, strong launch $/Wh value.',
  },
  Anker: {
    summary: 'Anker SOLIX targets rapid AC recharging, high USB-C PD output (dual 140W on newer units), and heavy 120/240V home backup.',
    connectorNote: 'Uses XT60 / XT60i solar connectors across the lineup, with 11–60V windows on mid-size units and 11–165V on the F3800 series.',
    strengths: '49-minute wall charging on C1000 Gen 2, 6,000W split-phase 240V on F3800/Plus, strong USB-C ports.',
  },
  Jackery: {
    summary: 'Prioritizes simple controls and low carry weight — the Explorer 2000 v2 is the lightest 2kWh LiFePO4 unit in this database.',
    connectorNote: 'Uses proprietary DC8020 / DC8mm barrel inputs; connecting non-Jackery MC4 panels requires an MC4-to-DC8020 adapter.',
    strengths: 'Lightweight designs, low idle/standby drain, straightforward front-panel interface.',
  },
  'Goal Zero': {
    summary: 'Early pioneer in portable power; legacy X-series units tracked here use older NMC lithium cells with slower charging.',
    connectorNote: 'Uses 8mm barrel ports on smaller units and High Power Port (Anderson/HPP) inputs on larger stations.',
    strengths: 'Broad legacy accessory support, though modern LFP rivals offer 6× the cycle life and much faster AC charging.',
  },
  DJI: {
    summary: 'Built around ultra-quiet cooling (23–29dB), strong continuous inverters, dual 140W USB-C, and native SDC drone fast-charging.',
    connectorNote: 'Solar charging routes through proprietary SDC ports using an optional DJI MPPT or 1.8kW Super Fast Charger adapter.',
    strengths: 'Lowest acoustic noise in class, high continuous wattage, massive 22.5kWh expansion on Power 2000.',
  },
};

export function brandSlug(brand) {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function kgToLbs(kg) {
  return +(kg * 2.20462).toFixed(1);
}

export function formatWeight(kg) {
  return `${kg} kg (${kgToLbs(kg)} lbs)`;
}

export function parseVoltageWindow(range) {
  const m = String(range ?? '').match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (!m) return { min: 11, max: 60 };
  return { min: Number(m[1]), max: Number(m[2]) };
}

// Estimated hours of peak direct sunlight to refill 0–100% at the given panel
// wattage (capped at the station's MPPT ceiling). Applies SOLAR_EFFECTIVE_FACTOR
// because real panels rarely deliver 100% of STC nameplate wattage.
export function solarChargeHours(station, panelWatts = station.solar_input_w) {
  const effectiveIn = Math.min(panelWatts, station.solar_input_w) * SOLAR_EFFECTIVE_FACTOR;
  if (!effectiveIn || effectiveIn <= 0) return null;
  return station.capacity_wh / effectiveIn;
}

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
  { slug: 'wifi-router', name: 'Wi-Fi router + modem', watts: 15, guide: GUIDE_URLS.ups },
  { slug: 'cpap', name: 'CPAP machine (no humidifier)', watts: 40, guide: GUIDE_URLS.cpap },
  { slug: 'starlink', name: 'Starlink (Standard kit)', watts: 55, guide: GUIDE_URLS.starlink },
  { slug: 'fan', name: 'Box fan', watts: 50 },
  { slug: 'laptop', name: 'Laptop', watts: 60, guide: GUIDE_URLS.ups },
  { slug: 'tv', name: '55" LED TV', watts: 100 },
  { slug: 'mini-fridge', name: 'Mini fridge', watts: compressor('mini').average_w, load: compressor('mini'), guide: GUIDE_URLS.fridge },
  { slug: 'fridge', name: 'Full-size refrigerator', watts: compressor('full').average_w, load: compressor('full'), guide: GUIDE_URLS.fridge },
  { slug: 'chest-freezer', name: 'Chest freezer', watts: compressor('freezer').average_w, load: compressor('freezer'), guide: GUIDE_URLS.fridge },
  { slug: 'coffee-maker', name: 'Coffee maker', watts: 900 },
  { slug: 'microwave', name: 'Microwave (700W cooking)', watts: 1000 },
  { slug: 'space-heater', name: 'Space heater', watts: 1500, guide: GUIDE_URLS.heater },
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

const META_LABELS = {
  fridge: 'fridge',
  laptop: 'laptop',
  cpap: 'CPAP',
  'wifi-router': 'router',
  'mini-fridge': 'mini fridge',
  starlink: 'Starlink',
  tv: 'TV',
};

function shortRuntime(hours) {
  return formatRuntime(hours).replace(/ hours?$/, ' h').replace(/ minutes$/, ' min');
}

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

// Closest-capacity models from the SAME brand.
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
