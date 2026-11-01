import { describe, expect, test } from 'vitest';
import { clampDay, daysInMonth, findSongs, parseHash, toMd } from '../src/lib/nearest';
import type { DB, Song } from '../src/lib/types';

function allKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 366; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    keys.push(`${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  return keys;
}

function makeDb(mds: string[]): DB {
  const songs: Song[] = mds.map((md) => ({
    title: `Song ${md}`,
    date: `2019-${md}`,
    md,
    album: 'Album',
    spotify: '',
    exact_link: true,
  }));
  const days: Record<string, number[]> = {};
  for (const k of allKeys()) days[k] = [];
  songs.forEach((s, i) => days[s.md].push(i));
  return { generated_at: 'test', songs, days };
}

const db = makeDb(['01-01', '03-10', '03-16', '12-30']);
const dbWithout0101 = makeDb(['03-10', '03-16', '12-30']);
const dbWith0229 = makeDb(['02-29', '03-10']);

describe('findSongs', () => {
  test('exact', () => expect(findSongs(1, 1, db)).toMatchObject({ kind: 'exact', md: '01-01' }));
  test('nearest before only', () => {
    const r = findSongs(3, 12, db);
    expect(r).toMatchObject({ kind: 'nearest', before: { md: '03-10', distance: 2 } });
    expect((r as any).after).toBeUndefined();
  });
  test('nearest after only', () => {
    const r = findSongs(3, 15, db);
    expect(r).toMatchObject({ kind: 'nearest', after: { md: '03-16', distance: 1 } });
    expect((r as any).before).toBeUndefined();
  });
  test('tie returns both', () =>
    expect(findSongs(3, 13, db)).toMatchObject({
      before: { md: '03-10', distance: 3 },
      after: { md: '03-16', distance: 3 },
    }));
  test('wraps year end→start', () =>
    expect(findSongs(12, 31, db)).toMatchObject({ before: { md: '12-30', distance: 1 } }));
  test('wraps start→end', () => {
    const r: any = findSongs(1, 2, dbWithout0101);
    expect(r.before).toMatchObject({ md: '12-30', distance: 3 });
  });
  test('feb 29 nearest', () => expect(findSongs(2, 29, db).kind).toBe('nearest'));
  test('feb 29 exact', () => expect(findSongs(2, 29, dbWith0229).kind).toBe('exact'));
  test('exact returns song objects', () => {
    const r: any = findSongs(3, 10, db);
    expect(r.songs[0].title).toBe('Song 03-10');
  });
  test('invalid throws', () => {
    expect(() => findSongs(4, 31, db)).toThrow(RangeError);
    expect(() => findSongs(13, 1, db)).toThrow(RangeError);
    expect(() => findSongs(1, 0, db)).toThrow(RangeError);
    expect(() => findSongs(1.5, 1, db)).toThrow(RangeError);
  });
});

describe('helpers', () => {
  test('toMd', () => {
    expect(toMd(8, 5)).toBe('08-05');
    expect(toMd(12, 31)).toBe('12-31');
  });
  test('daysInMonth', () => {
    expect(daysInMonth(2)).toBe(29);
    expect(daysInMonth(4)).toBe(30);
    expect(daysInMonth(1)).toBe(31);
  });
  test('clampDay', () => {
    expect(clampDay(2, 31)).toBe(29);
    expect(clampDay(4, 31)).toBe(30);
    expect(clampDay(1, 15)).toBe(15);
  });
  test('parseHash', () => {
    expect(parseHash('#08-05')).toEqual({ month: 8, day: 5 });
    for (const h of ['#13-45', '#02-30', '#hola', '', '#8-5']) expect(parseHash(h)).toBeNull();
  });
});
