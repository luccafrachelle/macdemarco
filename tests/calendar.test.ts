import { describe, expect, test } from 'vitest';
import { cellLabel, countLabel, levelFor, monthAbbr, monthStrips } from '../src/lib/calendar';

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

describe('monthStrips', () => {
  const strips = monthStrips();
  const real = strips.flatMap((r) => r.days).filter((c): c is { md: string } => c !== null);

  test('12 rows, months 1..12 in order', () => {
    expect(strips).toHaveLength(12);
    expect(strips.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  test('each row has 31 slots', () => {
    for (const row of strips) expect(row.days).toHaveLength(31);
  });
  test('february has 29 real days (29 feb is real, 30-31 are null)', () => {
    const feb = strips[1].days;
    expect(feb.filter(Boolean)).toHaveLength(29);
    expect(feb[28]).toEqual({ md: '02-29' });
    expect(feb[29]).toBeNull();
    expect(feb[30]).toBeNull();
  });
  test('366 real days in total, unique and in order', () => {
    expect(real).toHaveLength(366);
    expect(new Set(real.map((c) => c.md)).size).toBe(366);
    expect(real[0]).toEqual({ md: '01-01' });
    expect(real[365]).toEqual({ md: '12-31' });
  });
  test('slot 31 of abril is null, slot 30 is real', () => {
    expect(strips[3].days[30]).toBeNull();
    expect(strips[3].days[29]).toEqual({ md: '04-30' });
  });
  test('months with 30 days end in null', () => {
    for (const m of [4, 6, 9, 11]) expect(strips[m - 1].days[30]).toBeNull();
  });
});
