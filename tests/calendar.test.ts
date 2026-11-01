import { describe, expect, test } from 'vitest';
import { cellLabel, countLabel, levelFor, monthAbbr } from '../src/lib/calendar';

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
