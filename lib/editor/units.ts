export type DisplayUnit = 'm' | 'ft';

export const CM_PER_M = 100;
export const M_PER_FT = 3.28084;

export function cmToMeters(value: number): number {
  return value / CM_PER_M;
}

export function metersToCm(value: number): number {
  return value * CM_PER_M;
}

export function cmToFeet(value: number): number {
  return cmToMeters(value) * M_PER_FT;
}

export function feetToCm(value: number): number {
  return (value / M_PER_FT) * CM_PER_M;
}

export function cmToDisplay(value: number, unit: DisplayUnit = 'm'): number {
  if (unit === 'ft') return cmToFeet(value);
  return cmToMeters(value);
}

export function displayToCm(value: number, unit: DisplayUnit = 'm'): number {
  if (unit === 'ft') return feetToCm(value);
  return metersToCm(value);
}

export function formatDisplayValue(
  value: number,
  unit: DisplayUnit = 'm',
  decimals = 2,
): string {
  return `${value.toFixed(decimals)} ${unit}`;
}

export function formatAngle(radians: number, decimals = 1): string {
  const degrees = (radians * 180) / Math.PI;
  // Normalize to [0, 360)
  const normalized = ((degrees % 360) + 360) % 360;
  return `${normalized.toFixed(decimals)}°`;
}
