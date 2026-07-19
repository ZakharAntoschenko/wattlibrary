// Comparison logic: winner detection per metric + auto-generated verdicts.
import { dollarsPerWh, whPerKg, fullName, effectiveOutput } from './utils.js';

export function pairSlug(a, b) {
  return `${a.slug}-vs-${b.slug}`;
}

// Rows for the diff table. dir: 1 = higher wins, -1 = lower wins, 0 = no winner.
export function compareRows(a, b) {
  const rows = [
    ['Battery capacity', `${a.capacity_wh.toLocaleString()} Wh`, `${b.capacity_wh.toLocaleString()} Wh`, cmp(a.capacity_wh, b.capacity_wh, 1)],
    ['Battery chemistry', chemLabel(a), chemLabel(b), cmp(a.chemistry === 'LFP' ? 1 : 0, b.chemistry === 'LFP' ? 1 : 0, 1)],
    ['Cycle life (to 80%)', a.cycles_to_80pct.toLocaleString(), b.cycles_to_80pct.toLocaleString(), cmp(a.cycles_to_80pct, b.cycles_to_80pct, 1)],
    ['AC output (continuous)', `${a.ac_output_w.toLocaleString()} W`, `${b.ac_output_w.toLocaleString()} W`, cmp(a.ac_output_w, b.ac_output_w, 1)],
    ['AC output (surge)', `${a.ac_surge_w.toLocaleString()} W`, `${b.ac_surge_w.toLocaleString()} W`, cmp(a.ac_surge_w, b.ac_surge_w, 1)],
    ['240V output', a.output_240v ? 'Yes' : 'No', b.output_240v ? 'Yes' : 'No', cmp(a.output_240v ? 1 : 0, b.output_240v ? 1 : 0, 1)],
    ['Max solar input', `${a.solar_input_w} W`, `${b.solar_input_w} W`, cmp(a.solar_input_w, b.solar_input_w, 1)],
    ['Solar voltage window', a.solar_voltage_range, b.solar_voltage_range, 0],
    ['Max USB-C power', `${a.usb_c_max_w} W`, `${b.usb_c_max_w} W`, cmp(a.usb_c_max_w, b.usb_c_max_w, 1)],
    ['AC recharge 0–80%', minutes(a.ac_charge_minutes_0_80), minutes(b.ac_charge_minutes_0_80), cmp(a.ac_charge_minutes_0_80 ?? 9999, b.ac_charge_minutes_0_80 ?? 9999, -1)],
    ['UPS switchover', ups(a), ups(b), cmp(a.ups_switchover_ms ?? 9999, b.ups_switchover_ms ?? 9999, -1)],
    ['Expandable', expand(a), expand(b), cmp(a.expandable_max_wh ?? 0, b.expandable_max_wh ?? 0, 1)],
    ['Weight', `${a.weight_kg} kg`, `${b.weight_kg} kg`, cmp(a.weight_kg, b.weight_kg, -1)],
    ['Energy density', `${whPerKg(a).toFixed(0)} Wh/kg`, `${whPerKg(b).toFixed(0)} Wh/kg`, cmp(whPerKg(a), whPerKg(b), 1)],
    ['Launch price', `$${a.msrp_usd.toLocaleString()}`, `$${b.msrp_usd.toLocaleString()}`, 0],
    ['Value (launch $/Wh)', `$${dollarsPerWh(a).toFixed(2)}`, `$${dollarsPerWh(b).toFixed(2)}`, cmp(dollarsPerWh(a), dollarsPerWh(b), -1)],
  ];
  return rows;
}

function cmp(av, bv, dir) {
  if (av === bv) return 0;
  return (av > bv ? 1 : -1) * dir; // 1 => a wins, -1 => b wins
}
const chemLabel = (s) => (s.chemistry === 'LFP' ? 'LiFePO4' : 'NMC');
const minutes = (m) => (m ? `${m} min` : '—');
const ups = (s) => (s.ups_switchover_ms ? `${s.ups_switchover_ms} ms` : 'None');
const expand = (s) => (s.expandable_max_wh ? `to ${s.expandable_max_wh.toLocaleString()} Wh` : 'No');

// Human-readable strength list for one side.
function strengths(x, y) {
  const out = [];
  const capRatio = x.capacity_wh / y.capacity_wh;
  if (capRatio >= 1.15) out.push(`${Math.round((capRatio - 1) * 100)}% more capacity`);
  if (x.chemistry === 'LFP' && y.chemistry === 'NMC') out.push(`a far longer-lived LiFePO4 battery (${x.cycles_to_80pct.toLocaleString()} vs ${y.cycles_to_80pct.toLocaleString()} cycles)`);
  else if (x.cycles_to_80pct >= y.cycles_to_80pct * 1.4) out.push(`${x.cycles_to_80pct.toLocaleString()}-cycle battery life vs ${y.cycles_to_80pct.toLocaleString()}`);
  if (effectiveOutput(x) >= effectiveOutput(y) * 1.2) out.push(`${effectiveOutput(x).toLocaleString()}W output vs ${effectiveOutput(y).toLocaleString()}W`);
  if (x.output_240v && !y.output_240v) out.push('240V output for home circuits');
  if (dollarsPerWh(x) <= dollarsPerWh(y) * 0.85) out.push(`better value at launch ($${dollarsPerWh(x).toFixed(2)}/Wh vs $${dollarsPerWh(y).toFixed(2)}/Wh)`);
  if (x.weight_kg <= y.weight_kg * 0.8) {
    const diff = y.weight_kg - x.weight_kg;
    out.push(`a ${diff % 1 === 0 ? diff : diff.toFixed(1)} kg weight saving`);
  }
  if ((x.ac_charge_minutes_0_80 ?? 9999) <= (y.ac_charge_minutes_0_80 ?? 9999) * 0.7) out.push('a much faster AC recharge');
  if ((x.ups_switchover_ms ?? 9999) < (y.ups_switchover_ms ?? 9999)) {
    if (x.ups_switchover_ms && x.ups_switchover_ms <= 15) out.push(`${x.ups_switchover_ms}ms UPS switchover (safe for desktop PCs)`);
    else if (x.ups_switchover_ms && !y.ups_switchover_ms) out.push('a UPS mode the other lacks');
  }
  if (x.solar_input_w >= y.solar_input_w * 1.5) out.push(`${x.solar_input_w}W solar input vs ${y.solar_input_w}W`);
  if ((x.expandable_max_wh ?? 0) > (y.expandable_max_wh ?? 0)) out.push(`expandability to ${x.expandable_max_wh.toLocaleString()} Wh`);
  return out;
}

function listOut(items, max = 3) {
  const l = items.slice(0, max);
  if (l.length <= 1) return l[0] ?? '';
  return l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
}

// Deterministic verdict paragraphs generated from the data.
// Phrasing varies per pair (seeded by slugs) so pages don't read like clones,
// but a given pair always renders the same text build after build.
function seedFrom(a, b) {
  let h = 0;
  for (const ch of a.slug + b.slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
}

export function autoVerdict(a, b) {
  const an = fullName(a);
  const bn = fullName(b);
  const aS = strengths(a, b);
  const bS = strengths(b, a);
  const seed = seedFrom(a, b);
  const paras = [];

  const sameClass = Math.max(a.capacity_wh, b.capacity_wh) / Math.min(a.capacity_wh, b.capacity_wh) < 1.5;
  const sameOpeners = [
    `The ${an} and the ${bn} are after the same buyer, so this one is decided in the details.`,
    `Same class, similar money. What actually separates the ${an} from the ${bn} sits a few rows down the spec table.`,
    `On paper these two overlap almost completely. The differences that matter take some digging, so we did the digging.`,
  ];
  const diffOpeners = [
    `First things first: these are different sizes (${a.capacity_wh.toLocaleString()}Wh vs ${b.capacity_wh.toLocaleString()}Wh). Settle how much stored energy you need before anything else on this page matters.`,
    `Capacity is the headline gap here: ${a.capacity_wh.toLocaleString()}Wh against ${b.capacity_wh.toLocaleString()}Wh. If the smaller unit covers your loads, its other advantages start to count.`,
  ];
  paras.push(sameClass ? sameOpeners[seed % sameOpeners.length] : diffOpeners[seed % diffOpeners.length]);

  const caseWords = [`What the %N brings:`, `The case for the %N:`, `In the %N's corner:`];
  if (aS.length) paras.push(`${caseWords[seed % caseWords.length].replace('%N', an)} ${listOut(aS)}.`);
  if (bS.length) paras.push(`${caseWords[(seed + 1) % caseWords.length].replace('%N', bn)} ${listOut(bS)}.`);
  if (!aS.length && !bS.length) {
    paras.push(`Truthfully, these are near-twins. Buy whichever is discounted this week, or stick with the app ecosystem you already own.`);
  }

  const closers = [`Bottom line:`, `If we had to pick:`, `Our take:`];
  const pick = [];
  if (aS.length) pick.push(`the ${an} makes sense if you care about ${listOut(aS, 2)}`);
  if (bS.length) pick.push(`the ${bn} wins on ${listOut(bS, 2)}`);
  if (pick.length) paras.push(`${closers[seed % closers.length]} ${pick.join(', while ')}.`);
  return paras;
}
