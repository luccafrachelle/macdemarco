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
