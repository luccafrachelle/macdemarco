import type { DB, Match, Result, Song } from './types';

const DAYS = 366;
const REF_START = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 86_400_000;
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function toMd(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(month: number): number {
  return MONTH_DAYS[month - 1];
}

export function clampDay(month: number, day: number): number {
  return Math.min(day, daysInMonth(month));
}

export function parseHash(hash: string): { month: number; day: number } | null {
  const m = /^#(\d{2})-(\d{2})$/.exec(hash);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return null;
  return { month, day };
}

function isValid(month: number, day: number): boolean {
  return (
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(month)
  );
}

function dayIndex(month: number, day: number): number {
  return Math.round((Date.UTC(2024, month - 1, day) - REF_START) / MS_PER_DAY);
}

function mdAt(index: number): string {
  const d = new Date(REF_START + index * MS_PER_DAY);
  return toMd(d.getUTCMonth() + 1, d.getUTCDate());
}

export function findSongs(month: number, day: number, db: DB): Result {
  if (!isValid(month, day)) {
    throw new RangeError(`Invalid date: month=${month} day=${day}`);
  }
  const md = toMd(month, day);
  const songsAt = (key: string): Song[] => (db.days[key] ?? []).map((i) => db.songs[i]);

  const exact = songsAt(md);
  if (exact.length > 0) return { kind: 'exact', md, songs: exact };

  const i = dayIndex(month, day);
  for (let d = 1; d < DAYS; d++) {
    const beforeMd = mdAt((i - d + DAYS) % DAYS);
    const afterMd = mdAt((i + d) % DAYS);
    const beforeSongs = songsAt(beforeMd);
    const afterSongs = songsAt(afterMd);
    if (beforeSongs.length === 0 && afterSongs.length === 0) continue;
    const result: Result = { kind: 'nearest', md };
    if (beforeSongs.length > 0) {
      result.before = { md: beforeMd, distance: d, songs: beforeSongs } satisfies Match;
    }
    if (afterSongs.length > 0) {
      result.after = { md: afterMd, distance: d, songs: afterSongs } satisfies Match;
    }
    return result;
  }
  return { kind: 'nearest', md };
}
