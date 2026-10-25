// Shared assumptions for the guide pages. Everything here is a model, not a
// measurement: it takes a load in watts, applies a conversion loss and divides
// into the pack. The point of keeping it in one file is that every guide states
// the same efficiency and the same appliance draws.

import { INVERTER_EFFICIENCY, effectiveOutput, COMPRESSOR_LOADS, canStart, formatRuntime } from './utils.js';

// Fridge figures and the surge test live in utils.js, next to the appliance
// table the model cards use, so cards and guides read one set of numbers.
export { canStart };

// The AC outlet pays for the inverter (see INVERTER_EFFICIENCY). A 12V DC
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

// Averaged over a full day, not while the compressor is running. A fridge's
// EnergyGuide label divided by 8,760 hours lands in this range.
export const FRIDGE_LOADS = COMPRESSOR_LOADS;

export function hoursOnLoad(station, watts, efficiency = INVERTER_EFFICIENCY) {
  if (watts > effectiveOutput(station)) return null;
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
