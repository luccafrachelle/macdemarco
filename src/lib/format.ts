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

/** "2019-08-05" → "05.08.2019"; placeholder year 2000 → "05.08" */
export function formatFullDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return m[1] === '2000' ? `${m[3]}.${m[2]}` : `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatDays(n: number): string {
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}

/** "08-05" → "5 de agosto" */
export function spokenDate(md: string): string {
  const [month, day] = md.split('-').map(Number);
  return `${day} de ${monthName(month)}`;
}

/** Two dates as spoken: "el 2 y el 8 de agosto" / "el 30 de julio y el 3 de agosto" */
export function datePair(a: string, b: string): string {
  const [ma, da] = a.split('-').map(Number);
  const [mb] = b.split('-').map(Number);
  if (ma === mb) return `el ${da} y el ${spokenDate(b)}`;
  return `el ${spokenDate(a)} y el ${spokenDate(b)}`;
}

export function resultSentence(result: Result): string {
  const when = spokenDate(result.md);
  if (result.kind === 'exact') {
    const n = result.songs.length;
    return n > 1 ? `El ${when} tiene ${n} canciones.` : `El ${when} tiene canción.`;
  }

  const { before, after } = result;
  if (before && after) {
    return `Para el ${when} no hay. Las más cerca: ${datePair(before.md, after.md)}.`;
  }
  const match = before ?? after;
  if (!match) return `Para el ${when} no hay.`;
  const other = spokenDate(match.md);
  const n = match.songs.length;
  return n > 1 ? `Para el ${when} no hay, pero el ${other} hay ${n}.` : `Para el ${when} no hay, pero el ${other} sí.`;
}

export function countCoveredDays(db: DB): number {
  return Object.values(db.days).filter((ids) => ids.length > 0).length;
}
