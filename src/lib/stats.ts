/*
 * Pure aggregates for the stats page. Everything runs at build time.
 * Dates are ISO "YYYY-MM-DD" strings; day math is done on UTC day numbers.
 */
import { MONTHS } from './format';
import type { Song } from './types';

export type Box = { min: number; q1: number; median: number; q3: number; max: number };

const DAY_MS = 86_400_000;
const OWG = 'One Wayne G';

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** UTC day number of an ISO date. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Index of the first maximum (ties → earliest). */
function argMax(values: number[]): number {
  let best = 0;
  values.forEach((v, i) => {
    if (v > values[best]) best = i;
  });
  return best;
}

function argMin(values: number[]): number {
  let best = 0;
  values.forEach((v, i) => {
    if (v < values[best]) best = i;
  });
  return best;
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + 1);
  return out;
}

/** Max entry of a count map; ties → smallest key (keys are ISO-ish, so earliest). */
function maxEntry(counts: Map<string, number>): [string, number] {
  let best: [string, number] = ['', 0];
  for (const [k, v] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (v > best[1]) best = [k, v];
  }
  return best;
}

function uniqueDates(songs: Song[]): string[] {
  return [...new Set(songs.map((s) => s.date))].sort();
}

/* ---------- quantiles ---------- */

/**
 * Quantile of an ascending-sorted array with linear interpolation between
 * closest ranks (R type 7 / numpy default): h = (n − 1)·p.
 */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** Five-number summary; whiskers are plain min and max (no outlier rule). */
export function boxStats(values: number[]): Box {
  const v = [...values].sort((a, b) => a - b);
  return {
    min: v[0] ?? 0,
    q1: quantile(v, 0.25),
    median: quantile(v, 0.5),
    q3: quantile(v, 0.75),
    max: v[v.length - 1] ?? 0,
  };
}

/* ---------- chart 1: month boxplot ---------- */

export function recordingYears(songs: Song[]): number[] {
  return [...new Set(songs.map((s) => Number(s.date.slice(0, 4))))].sort((a, b) => a - b);
}

export type MonthBox = {
  month: number; // 1–12
  total: number;
  perYear: { year: number; count: number }[];
  box: Box;
};

export function monthBoxes(songs: Song[]): MonthBox[] {
  const years = recordingYears(songs);
  const counts = countBy(songs, (s) => s.date.slice(0, 7));
  return MONTHS.map((_, i) => {
    const month = i + 1;
    const mm = String(month).padStart(2, '0');
    const perYear = years.map((year) => ({ year, count: counts.get(`${year}-${mm}`) ?? 0 }));
    return {
      month,
      total: perYear.reduce((sum, p) => sum + p.count, 0),
      perYear,
      box: boxStats(perYear.map((p) => p.count)),
    };
  });
}

export function monthTakeaway(boxes: MonthBox[]): string {
  const totals = boxes.map((b) => b.total);
  const hi = argMax(totals);
  const lo = argMin(totals);
  return `${cap(MONTHS[hi])} es el mes más cargado: ${totals[hi]} canciones. ${cap(MONTHS[lo])} casi no tiene: ${totals[lo]}.`;
}

/* ---------- chart 2: weekday ---------- */

export const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;
export const WEEKDAYS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'] as const;

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (new Date(dayNumber(iso) * DAY_MS).getUTCDay() + 6) % 7;
}

export function weekdayCounts(songs: Song[]): number[] {
  const out = Array<number>(7).fill(0);
  for (const s of songs) out[weekdayIndex(s.date)]++;
  return out;
}

export function weekdayTakeaway(counts: number[]): string {
  const i = argMax(counts);
  return `Los ${WEEKDAYS_PLURAL[i]} son su día: ${counts[i]} canciones.`;
}

/* ---------- chart 3: year by year ---------- */

export type YearBar = { year: number; owg: number; nuevos: number; total: number };

/** Every year from the first to the last recording, empty years at 0. */
export function yearBars(songs: Song[]): YearBar[] {
  const years = recordingYears(songs);
  if (years.length === 0) return [];
  const out: YearBar[] = [];
  for (let year = years[0]; year <= years[years.length - 1]; year++) {
    const ofYear = songs.filter((s) => s.date.startsWith(`${year}-`));
    const owg = ofYear.filter((s) => s.album === OWG).length;
    out.push({ year, owg, nuevos: ofYear.length - owg, total: ofYear.length });
  }
  return out;
}

export function yearTakeaway(bars: YearBar[]): string {
  const peak = bars[argMax(bars.map((b) => b.total))];
  const empty = bars.filter((b) => b.total === 0).map((b) => b.year);
  const head = `${peak.year} fue el pico (${peak.total}).`;
  if (empty.length === 0) return head;
  if (empty.length === 1) return `${head} En ${empty[0]} no hay ni una.`;
  return `${head} En ${empty.slice(0, -1).join(', ')} y ${empty[empty.length - 1]} no hay ni una.`;
}

/* ---------- chart 4: titles ---------- */

export function isDateOnly(title: string): boolean {
  return /^\d{8}$/.test(title.trim());
}

/** What comes after the leading 8-digit date. */
export function titleSuffix(title: string): string {
  return title.trim().replace(/^\d{8}\s*/, '');
}

export type TitleItem = { title: string; date: string; dateOnly: boolean };

export function titleKinds(songs: Song[]): { dateOnly: number; withSuffix: number; items: TitleItem[] } {
  const items = songs.map((s) => ({ title: s.title, date: s.date, dateOnly: isDateOnly(s.title) }));
  const dateOnly = items.filter((i) => i.dateOnly).length;
  return { dateOnly, withSuffix: items.length - dateOnly, items };
}

/** Longest suffixes first; ties by date, then title. */
export function creativeTitles(songs: Song[], n = 3): { title: string; date: string; suffix: string }[] {
  return songs
    .filter((s) => !isDateOnly(s.title))
    .map((s) => ({ title: s.title, date: s.date, suffix: titleSuffix(s.title) }))
    .sort((a, b) => b.suffix.length - a.suffix.length || a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, n);
}

export function longestTitle(songs: Song[]): Song {
  return songs.reduce((best, s) => (s.title.trim().length > best.title.trim().length ? s : best), songs[0]);
}

/* ---------- fun facts ---------- */

/** Most consecutive calendar days with at least one recording. */
export function longestStreak(songs: Song[]): { days: number; from: string; to: string } {
  const days = uniqueDates(songs).map(dayNumber);
  let best = { len: 1, end: days[0] };
  let len = 1;
  for (let i = 1; i < days.length; i++) {
    len = days[i] - days[i - 1] === 1 ? len + 1 : 1;
    if (len > best.len) best = { len, end: days[i] };
  }
  return { days: best.len, from: fromDayNumber(best.end - best.len + 1), to: fromDayNumber(best.end) };
}

export function busiestDate(songs: Song[]): { date: string; count: number } {
  const [date, count] = maxEntry(countBy(songs, (s) => s.date));
  return { date, count };
}

export function busiestCalendarDay(songs: Song[]): { md: string; count: number } {
  const [md, count] = maxEntry(countBy(songs, (s) => s.date.slice(5)));
  return { md, count };
}

/**
 * fullDates: full dates (with year) holding more than one song.
 * calendarDaysAcrossYears: MM-DD days with songs from at least two different years.
 */
export function repeatedDays(songs: Song[]): { fullDates: number; calendarDaysAcrossYears: number } {
  const fullDates = [...countBy(songs, (s) => s.date).values()].filter((n) => n > 1).length;
  const years = new Map<string, Set<string>>();
  for (const s of songs) {
    const md = s.date.slice(5);
    if (!years.has(md)) years.set(md, new Set());
    years.get(md)!.add(s.date.slice(0, 4));
  }
  const calendarDaysAcrossYears = [...years.values()].filter((y) => y.size > 1).length;
  return { fullDates, calendarDaysAcrossYears };
}

/** Longest gap between consecutive (unique, sorted) recording dates. */
export function longestGap(songs: Song[]): { days: number; from: string; to: string } {
  const dates = uniqueDates(songs);
  let best = { days: 0, from: dates[0], to: dates[0] };
  for (let i = 1; i < dates.length; i++) {
    const days = daysBetween(dates[i - 1], dates[i]);
    if (days > best.days) best = { days, from: dates[i - 1], to: dates[i] };
  }
  return best;
}

/** Mean gap in days between consecutive unique recording dates. */
export function averageGap(songs: Song[]): number {
  const dates = uniqueDates(songs);
  if (dates.length < 2) return 0;
  return daysBetween(dates[0], dates[dates.length - 1]) / (dates.length - 1);
}

export function busiestMonth(songs: Song[]): { year: number; month: number; count: number } {
  const [ym, count] = maxEntry(countBy(songs, (s) => s.date.slice(0, 7)));
  return { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)), count };
}

export function coveredCalendarDays(songs: Song[]): number {
  return new Set(songs.map((s) => s.date.slice(5))).size;
}

export function leapDaySongs(songs: Song[]): number {
  return songs.filter((s) => s.date.endsWith('-02-29')).length;
}
