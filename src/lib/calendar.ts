import { monthName, spokenDate } from './format';

export type Level = 0 | 1 | 2 | 3 | 4;

/** Song count → GitHub-style intensity level (0 empty, 4 = four or more). */
export function levelFor(count: number): Level {
  return Math.max(0, Math.min(4, Math.floor(count))) as Level;
}

/** 0 → "sin canción", 1 → "1 canción", n → "n canciones" */
export function countLabel(count: number): string {
  if (count <= 0) return 'sin canción';
  return `${count} ${count === 1 ? 'canción' : 'canciones'}`;
}

/** "08-05", 2 → "5 de agosto: 2 canciones" */
export function cellLabel(md: string, count: number): string {
  return `${spokenDate(md)}: ${countLabel(count)}`;
}

/** 1 → "ene" */
export function monthAbbr(month: number): string {
  return monthName(month).slice(0, 3);
}

export type StripDay = { md: string } | null;
export type MonthStrip = { month: number; days: StripDay[] };

/** Days per month in the reference leap year (29 feb is a real day). */
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * One strip per month: 12 rows × 31 slots. Slot i holds day i + 1, or null
 * when that day does not exist in the month (so every row keeps the alignment).
 */
export function monthStrips(): MonthStrip[] {
  return MONTH_LENGTHS.map((length, i) => {
    const mm = String(i + 1).padStart(2, '0');
    return {
      month: i + 1,
      days: Array.from({ length: 31 }, (_, d): StripDay =>
        d < length ? { md: `${mm}-${String(d + 1).padStart(2, '0')}` } : null,
      ),
    };
  });
}
