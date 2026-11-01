import { describe, expect, test } from 'vitest';
import { barPath, niceTicks, stack } from '../src/lib/chart';

describe('niceTicks: at most 4 lines including 0', () => {
  test('rounds up to a nice step', () => {
    expect(niceTicks(16)).toEqual({ max: 20, ticks: [0, 10, 20] });
    expect(niceTicks(48)).toEqual({ max: 60, ticks: [0, 20, 40, 60] });
    expect(niceTicks(57)).toEqual({ max: 60, ticks: [0, 20, 40, 60] });
    expect(niceTicks(5)).toEqual({ max: 6, ticks: [0, 2, 4, 6] });
  });
  test('empty data still gives a usable scale', () => {
    expect(niceTicks(0)).toEqual({ max: 1, ticks: [0, 1] });
  });
});

describe('barPath: rounded data end, square baseline', () => {
  test('rounds only the top corners', () => {
    expect(barPath(10, 20, 30, 40, 4)).toBe('M10 60V24A4 4 0 0 1 14 20H36A4 4 0 0 1 40 24V60Z');
  });
  test('square top when not rounded', () => {
    expect(barPath(0, 0, 10, 10, 0)).toBe('M0 10V0H10V10Z');
  });
  test('radius never exceeds height', () => {
    expect(barPath(0, 8, 10, 2, 4)).toBe('M0 10V10A2 2 0 0 1 2 8H8A2 2 0 0 1 10 10V10Z');
  });
  test('zero height → no path', () => {
    expect(barPath(0, 10, 10, 0, 4)).toBe('');
  });
});

describe('stack', () => {
  test('bottom-up segments with a gap, only the top one rounded', () => {
    expect(stack([5, 3], 100, 10, 2)).toEqual([
      { index: 0, value: 5, y: 50, h: 50, top: false },
      { index: 1, value: 3, y: 18, h: 30, top: true },
    ]);
  });
  test('skips zero values', () => {
    expect(stack([0, 3], 100, 10, 2)).toEqual([{ index: 1, value: 3, y: 70, h: 30, top: true }]);
    expect(stack([4, 0], 100, 10, 2)).toEqual([{ index: 0, value: 4, y: 60, h: 40, top: true }]);
  });
});
