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

export type GridCell = { md: string } | null;

const MS_PER_DAY = 86_400_000;

function dayOffset(year: number): number {
  // Monday-first weekday of Jan 1 (0 = Monday … 6 = Sunday)
  return (new Date(Date.UTC(year, 0, 1)).getUTCDay() + 6) % 7;
}

function daysInYear(year: number): number {
  return Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / MS_PER_DAY);
}

/**
 * GitHub contribution-graph layout: columns are weeks (Monday first),
 * each column holds 7 rows (Mon … Sun). Days outside the year are null.
 */
export function weekGrid(year = 2024): GridCell[][] {
  const offset = dayOffset(year);
  const total = daysInYear(year);
  const cols = Math.ceil((offset + total) / 7);
  const start = Date.UTC(year, 0, 1);
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: 7 }, (_, r): GridCell => {
      const i = c * 7 + r - offset;
      if (i < 0 || i >= total) return null;
      const d = new Date(start + i * MS_PER_DAY);
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return { md: `${mm}-${dd}` };
    }),
  );
}

/** Column of the week that contains the 1st of each month. */
export function monthLabelColumns(year = 2024): { month: number; col: number }[] {
  const offset = dayOffset(year);
  const start = Date.UTC(year, 0, 1);
  return Array.from({ length: 12 }, (_, i) => {
    const index = Math.round((Date.UTC(year, i, 1) - start) / MS_PER_DAY);
    return { month: i + 1, col: Math.floor((index + offset) / 7) };
  });
}
