// Shared assumptions for the guide pages. Everything here is a model, not a
// measurement: it takes a load in watts, applies a conversion loss and divides
// into the pack. The point of keeping it in one file is that every guide states
// the same efficiency and the same appliance draws.

import { INVERTER_EFFICIENCY, effectiveOutput } from './utils.js';

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
export const FRIDGE_LOADS = [
  { key: 'mini', label: 'Mini fridge', average_w: 25, running_w: 80, surge_w: 400 },
  { key: 'full', label: 'Full-size refrigerator', average_w: 60, running_w: 150, surge_w: 900 },
  { key: 'freezer', label: 'Chest freezer', average_w: 50, running_w: 130, surge_w: 800 },
];

export function hoursOnLoad(station, watts, efficiency = INVERTER_EFFICIENCY) {
  if (watts > effectiveOutput(station)) return null;
  return (station.capacity_wh * efficiency) / watts;
}

export function nightsOfCpap(station, load) {
  const hours = hoursOnLoad(station, load.watts, load.efficiency);
  return hours === null ? null : hours / CPAP_HOURS_PER_NIGHT;
}

// A compressor needs its surge for a second or two at every restart. Running
// watts alone will happily "fit" inside a unit that trips the moment the
// fridge kicks in.
export function canStart(station, load) {
  // Continuous rating, not boost: boost is a short-term figure and a fridge
  // runs for hours. The surge check is separate and uses the surge rating.
  return station.ac_surge_w >= load.surge_w && station.ac_output_w >= load.running_w;
}

// Rounded DOWN on purpose: 0.96 of a night is not a night, and a table that
// rounds it up to 1.0 contradicts the sizing advice further down the page.
export function formatNights(n) {
  if (n === null) return null;
  if (n >= 10) return Math.floor(n).toString();
  return (Math.floor(n * 10) / 10).toFixed(1);
}

// Hours, phrased the way someone planning an outage thinks about them.
export function formatSpan(hours) {
  if (hours === null) return null;
  if (hours >= 48) return `${Math.floor((hours / 24) * 10) / 10} days`;
  if (hours >= 10) return `${Math.floor(hours)} hours`;
  return `${Math.floor(hours * 10) / 10} hours`;
}
