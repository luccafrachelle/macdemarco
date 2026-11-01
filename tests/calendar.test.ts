import { describe, expect, test } from 'vitest';
import { cellLabel, countLabel, levelFor, monthAbbr, monthLabelColumns, weekGrid } from '../src/lib/calendar';

describe('levelFor', () => {
  test('0 songs → level 0', () => {
    expect(levelFor(0)).toBe(0);
  });
  test('1..4 map to themselves', () => {
    expect([1, 2, 3, 4].map(levelFor)).toEqual([1, 2, 3, 4]);
  });
  test('caps at 4', () => {
    expect(levelFor(5)).toBe(4);
    expect(levelFor(12)).toBe(4);
  });
  test('negative or non-integer input is clamped safely', () => {
    expect(levelFor(-1)).toBe(0);
    expect(levelFor(1.7)).toBe(1);
  });
});

describe('countLabel', () => {
  test('pluralises', () => {
    expect(countLabel(0)).toBe('sin canción');
    expect(countLabel(1)).toBe('1 canción');
    expect(countLabel(2)).toBe('2 canciones');
    expect(countLabel(7)).toBe('7 canciones');
  });
});

describe('cellLabel', () => {
  test('matches the spec examples', () => {
    expect(cellLabel('08-05', 2)).toBe('5 de agosto: 2 canciones');
    expect(cellLabel('03-14', 0)).toBe('14 de marzo: sin canción');
  });
  test('singular and leap day', () => {
    expect(cellLabel('02-29', 1)).toBe('29 de febrero: 1 canción');
  });
});

describe('monthAbbr', () => {
  test('three-letter lowercase spanish abbreviations', () => {
    expect(monthAbbr(1)).toBe('ene');
    expect(monthAbbr(9)).toBe('sep');
    expect(monthAbbr(12)).toBe('dic');
  });
});

describe('weekGrid', () => {
  const grid = weekGrid(2024);
  const real = grid.flat().filter((c): c is { md: string } => c !== null);

  test('columns of 7 weekdays', () => {
    expect(grid.length).toBe(53);
    for (const col of grid) expect(col).toHaveLength(7);
  });
  test('2024-01-01 (a Monday) is col 0 row 0', () => {
    expect(grid[0][0]).toEqual({ md: '01-01' });
  });
  test('2024-12-31 is the last real cell', () => {
    expect(real[real.length - 1]).toEqual({ md: '12-31' });
    // Tuesday → row 1 of the last column, rest are placeholders
    expect(grid[52][1]).toEqual({ md: '12-31' });
    expect(grid[52].slice(2).every((c) => c === null)).toBe(true);
  });
  test('366 real cells, in order, including 02-29', () => {
    expect(real).toHaveLength(366);
    expect(new Set(real.map((c) => c.md)).size).toBe(366);
    expect(real.some((c) => c.md === '02-29')).toBe(true);
    expect(real[59]).toEqual({ md: '02-29' });
  });
  test('a year not starting on Monday gets leading placeholders', () => {
    // 2025-01-01 is a Wednesday
    const g = weekGrid(2025);
    expect(g[0].slice(0, 2)).toEqual([null, null]);
    expect(g[0][2]).toEqual({ md: '01-01' });
    expect(g.flat().filter(Boolean)).toHaveLength(365);
  });
});

describe('monthLabelColumns', () => {
  const labels = monthLabelColumns(2024);
  test('one label per month, in order', () => {
    expect(labels.map((l) => l.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  test('january at col 0, february at col 4', () => {
    expect(labels[0]).toEqual({ month: 1, col: 0 });
    // 2024-02-01 is a Thursday in the week starting Mon 29 Jan (day index 28)
    expect(labels[1]).toEqual({ month: 2, col: 4 });
  });
  test('december label sits in the week containing 2024-12-01', () => {
    // 2024-12-01 is a Sunday → last day of the week starting Mon 25 Nov (index 329 → col 47)
    expect(labels[11]).toEqual({ month: 12, col: 47 });
  });
});
