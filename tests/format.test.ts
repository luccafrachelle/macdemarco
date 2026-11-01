import { describe, expect, test } from 'vitest';
import { countCoveredDays, formatDays, formatFullDate, monthName, resultSentence, spokenDate, MONTHS } from '../src/lib/format';
import type { DB, Match, Result, Song } from '../src/lib/types';

const song = (md: string): Song => ({
  title: `Song ${md}`,
  date: `2019-${md}`,
  md,
  album: 'Album',
  spotify: '',
  exact_link: true,
});
const match = (md: string, distance: number): Match => ({ md, distance, songs: [song(md)] });

describe('monthName', () => {
  test('lowercase spanish names', () => {
    expect(monthName(1)).toBe('enero');
    expect(monthName(8)).toBe('agosto');
    expect(monthName(12)).toBe('diciembre');
    expect(MONTHS).toHaveLength(12);
  });
});

describe('spokenDate', () => {
  test('MM-DD → "D de mes"', () => {
    expect(spokenDate('08-05')).toBe('5 de agosto');
    expect(spokenDate('02-29')).toBe('29 de febrero');
  });
});

describe('formatFullDate', () => {
  test('YYYY-MM-DD → DD.MM.YYYY', () => {
    expect(formatFullDate('2019-08-05')).toBe('05.08.2019');
    expect(formatFullDate('2023-12-31')).toBe('31.12.2023');
  });
  test('returns input unchanged if not ISO', () => {
    expect(formatFullDate('2019')).toBe('2019');
  });
});

describe('formatDays', () => {
  test('pluralizes', () => {
    expect(formatDays(1)).toBe('1 día');
    expect(formatDays(2)).toBe('2 días');
    expect(formatDays(14)).toBe('14 días');
  });
});

describe('resultSentence', () => {
  test('exact', () => {
    const r: Result = { kind: 'exact', md: '08-05', songs: [song('08-05')] };
    expect(resultSentence(r)).toBe('El 5 de agosto tiene canción.');
  });

  test('nearest after, plural', () => {
    const r: Result = { kind: 'nearest', md: '03-14', after: match('03-17', 3) };
    expect(resultSentence(r)).toBe(
      'No hay canción para el 14 de marzo, pero la más cercana es 3 días después.',
    );
  });

  test('nearest before, singular', () => {
    const r: Result = { kind: 'nearest', md: '02-29', before: match('02-28', 1) };
    expect(resultSentence(r)).toBe(
      'No hay canción para el 29 de febrero, pero la más cercana es 1 día antes.',
    );
  });

  test('tie', () => {
    const r: Result = {
      kind: 'nearest',
      md: '03-13',
      before: match('03-10', 3),
      after: match('03-16', 3),
    };
    expect(resultSentence(r)).toBe(
      'No hay canción para el 13 de marzo, pero hay dos a 3 días: una antes y una después.',
    );
  });

  test('tie at 1 day uses singular', () => {
    const r: Result = {
      kind: 'nearest',
      md: '03-13',
      before: match('03-12', 1),
      after: match('03-14', 1),
    };
    expect(resultSentence(r)).toBe(
      'No hay canción para el 13 de marzo, pero hay dos a 1 día: una antes y una después.',
    );
  });

  test('nearest with no songs at all', () => {
    const r: Result = { kind: 'nearest', md: '01-01' };
    expect(resultSentence(r)).toBe('No hay canción para el 1 de enero.');
  });
});

describe('countCoveredDays', () => {
  test('counts days with at least one song', () => {
    const db: DB = { generated_at: 't', songs: [], days: { '01-01': [0], '01-02': [], '01-03': [1, 2] } };
    expect(countCoveredDays(db)).toBe(2);
  });
});
