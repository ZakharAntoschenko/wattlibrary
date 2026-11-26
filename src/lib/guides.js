// Shared assumptions for the guide pages. Everything here is a model, not a
// measurement: it takes a load in watts, applies a conversion loss and divides
// into the pack. Keeping all load tables in one file ensures every guide,
// model card, comparison, and calculator stays 100% consistent.

import {
  INVERTER_EFFICIENCY,
  SOLAR_EFFECTIVE_FACTOR,
  effectiveOutput,
  COMPRESSOR_LOADS,
  canStart,
  formatRuntime,
  solarChargeHours,
} from './utils.js';

export { canStart, SOLAR_EFFECTIVE_FACTOR, solarChargeHours };

// The AC outlet pays for the inverter (see INVERTER_EFFICIENCY). A 12V/DC
// outlet skips it and only loses a little to DC-DC conversion.
export const DC_EFFICIENCY = 0.95;

export const CPAP_HOURS_PER_NIGHT = 8;

// Draw figures are the ranges CPAP retailers and manufacturers publish for a
// full-size machine at a typical pressure; we take the middle of each range.
export const CPAP_LOADS = [
  { key: 'dc', label: 'No humidifier, 12V DC', watts: 40, efficiency: DC_EFFICIENCY },
  { key: 'ac', label: 'No humidifier, AC outlet', watts: 40, efficiency: INVERTER_EFFICIENCY },
  { key: 'humid', label: 'Humidifier + heated tube, AC', watts: 85, efficiency: INVERTER_EFFICIENCY },
];

export const FRIDGE_LOADS = COMPRESSOR_LOADS;

// Starlink power draw figures (real-world averages):
// - Mini averages ~20-30W (25W midpoint), accepts direct USB-C PD / DC input.
// - Standard Gen 3 averages ~50-65W (55W midpoint) without snow melt.
// - Standard Gen 3 with snow melt enabled climbs to ~100-120W (110W midpoint).
export const STARLINK_LOADS = [
  { key: 'mini_dc', label: 'Starlink Mini (DC / USB-C)', watts: 25, efficiency: DC_EFFICIENCY },
  { key: 'mini_ac', label: 'Starlink Mini (AC brick)', watts: 25, efficiency: INVERTER_EFFICIENCY },
  { key: 'std_ac', label: 'Standard Gen 3 (AC)', watts: 55, efficiency: INVERTER_EFFICIENCY },
  { key: 'snow_ac', label: 'Standard + Snow Melt (AC)', watts: 110, efficiency: INVERTER_EFFICIENCY },
];

// Home office & UPS workloads (typical sustained draws).
export const OFFICE_LOADS = [
  { key: 'laptop', label: 'Laptop + monitor + Wi-Fi (75W)', watts: 75, efficiency: INVERTER_EFFICIENCY },
  { key: 'desktop', label: 'Desktop PC + monitor + router (200W)', watts: 200, efficiency: INVERTER_EFFICIENCY },
  { key: 'gaming', label: 'Gaming / Workstation PC (450W)', watts: 450, efficiency: INVERTER_EFFICIENCY },
];

// Resistive space heaters: note that continuous AC rating (not boost mode)
// governs full-heat operation; boost mode lowers voltage and reduces heat output.
export const HEATER_LOADS = [
  { key: 'low', label: 'Low setting (750W)', watts: 750, efficiency: INVERTER_EFFICIENCY },
  { key: 'high', label: 'High setting (1,500W)', watts: 1500, efficiency: INVERTER_EFFICIENCY },
];

export function hoursOnLoad(station, watts, efficiency = INVERTER_EFFICIENCY, { useContinuousOnly = false } = {}) {
  const limit = useContinuousOnly ? station.ac_output_w : effectiveOutput(station);
  if (watts > limit) return null;
  return (station.capacity_wh * efficiency) / watts;
}

export function nightsOfCpap(station, load) {
  const hours = hoursOnLoad(station, load.watts, load.efficiency);
  return hours === null ? null : hours / CPAP_HOURS_PER_NIGHT;
}

// Rounded DOWN on purpose: 0.96 of a night is not a night, and a table that
// rounds it up to 1.0 contradicts the sizing advice further down the page.
export function formatNights(n) {
  if (n === null) return null;
  if (n >= 10) return Math.floor(n).toString();
  return (Math.floor(n * 10) / 10).toFixed(1);
}

// Hours, phrased the way someone planning an outage thinks about them.
// Same function as the model cards, so the two can never disagree.
export function formatSpan(hours) {
  return formatRuntime(hours);
}
