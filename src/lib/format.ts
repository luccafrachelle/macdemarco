import type { DB, Result } from './types';

export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export function monthName(month: number): string {
  return MONTHS[month - 1];
}

/** "2019-08-05" → "05.08.2019" */
export function formatFullDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function formatDays(n: number): string {
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}

/** "08-05" → "5 de agosto" */
export function spokenDate(md: string): string {
  const [month, day] = md.split('-').map(Number);
  return `${day} de ${monthName(month)}`;
}

export function resultSentence(result: Result): string {
  const when = spokenDate(result.md);
  if (result.kind === 'exact') return `El ${when} tiene canción.`;

  const { before, after } = result;
  if (before && after) {
    return `No hay canción para el ${when}, pero hay dos a ${formatDays(before.distance)}: una antes y una después.`;
  }
  const match = before ?? after;
  if (!match) return `No hay canción para el ${when}.`;
  const side = before ? 'antes' : 'después';
  return `No hay canción para el ${when}, pero la más cercana es ${formatDays(match.distance)} ${side}.`;
}

export function countCoveredDays(db: DB): number {
  return Object.values(db.days).filter((ids) => ids.length > 0).length;
}
