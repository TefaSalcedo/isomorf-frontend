import { describe, expect, it } from 'vitest';
import { cmToDisplay, cmToFeet, cmToMeters, displayToCm, feetToCm, formatAngle, formatDisplayValue, metersToCm } from './units';

describe('unit conversions', () => {
  it('converts between centimeters and meters', () => {
    expect(cmToMeters(250)).toBe(2.5);
    expect(metersToCm(2.5)).toBe(250);
  });

  it('converts between centimeters and feet', () => {
    expect(cmToFeet(100)).toBeCloseTo(3.28084);
    expect(feetToCm(3.28084)).toBeCloseTo(100);
  });

  it('converts to and from display units', () => {
    expect(cmToDisplay(100, 'm')).toBe(1);
    expect(cmToDisplay(100, 'ft')).toBeCloseTo(3.28084);
    expect(displayToCm(1, 'm')).toBe(100);
    expect(displayToCm(3.28084, 'ft')).toBeCloseTo(100);
  });
});

describe('formatting', () => {
  it('formats display values with unit suffix', () => {
    expect(formatDisplayValue(2.5, 'm')).toBe('2.50 m');
    expect(formatDisplayValue(2.5, 'ft', 1)).toBe('2.5 ft');
  });

  it('formats angles normalized to [0, 360)', () => {
    expect(formatAngle(Math.PI / 2)).toBe('90.0°');
    expect(formatAngle(-Math.PI / 2)).toBe('270.0°');
    expect(formatAngle((5 * Math.PI) / 2)).toBe('90.0°');
  });
});
