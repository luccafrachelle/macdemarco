import { describe, expect, test } from 'vitest';
import { countCoveredDays, datePair, formatDays, formatFullDate, monthName, resultSentence, spokenDate, spotifyTrackId, MONTHS } from '../src/lib/format';
import type { DB, Match, Result, Song } from '../src/lib/types';

const song = (md: string): Song => ({
  title: `Song ${md}`,
  date: `2019-${md}`,
  md,
  album: 'Album',
  spotify: '',
  exact_link: true,
});
const match = (md: string, distance: number, n = 1): Match => ({
  md,
  distance,
  songs: Array.from({ length: n }, () => song(md)),
});

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

describe('datePair', () => {
  test('same month collapses', () => {
    expect(datePair('08-02', '08-08')).toBe('el 2 y el 8 de agosto');
  });
  test('cross month keeps both months', () => {
    expect(datePair('07-30', '08-03')).toBe('el 30 de julio y el 3 de agosto');
  });
  test('cross year', () => {
    expect(datePair('12-30', '01-02')).toBe('el 30 de diciembre y el 2 de enero');
  });
});

describe('resultSentence', () => {
  test('exact, one song', () => {
    const r: Result = { kind: 'exact', md: '08-05', songs: [song('08-05')] };
    expect(resultSentence(r)).toBe('El 5 de agosto tiene canción.');
  });

  test('exact, several songs', () => {
    const r: Result = { kind: 'exact', md: '08-05', songs: [song('08-05'), song('08-05'), song('08-05')] };
    expect(resultSentence(r)).toBe('El 5 de agosto tiene 3 canciones.');
  });

  test('nearest after, one song', () => {
    const r: Result = { kind: 'nearest', md: '03-14', after: match('03-17', 3) };
    expect(resultSentence(r)).toBe('Para el 14 de marzo no hay, pero el 17 de marzo sí.');
  });

  test('nearest before, one song, other month', () => {
    const r: Result = { kind: 'nearest', md: '03-01', before: match('02-29', 1) };
    expect(resultSentence(r)).toBe('Para el 1 de marzo no hay, pero el 29 de febrero sí.');
  });

  test('nearest one side with several songs', () => {
    const r: Result = { kind: 'nearest', md: '03-14', after: match('03-17', 3, 2) };
    expect(resultSentence(r)).toBe('Para el 14 de marzo no hay, pero el 17 de marzo hay 2.');
  });

  test('tie, same month', () => {
    const r: Result = {
      kind: 'nearest',
      md: '08-05',
      before: match('08-02', 3, 2),
      after: match('08-08', 3),
    };
    expect(resultSentence(r)).toBe('Para el 5 de agosto no hay. Las más cerca: el 2 y el 8 de agosto.');
  });

  test('tie across months', () => {
    const r: Result = {
      kind: 'nearest',
      md: '08-01',
      before: match('07-30', 2),
      after: match('08-03', 2),
    };
    expect(resultSentence(r)).toBe(
      'Para el 1 de agosto no hay. Las más cerca: el 30 de julio y el 3 de agosto.',
    );
  });

  test('nearest with no songs at all', () => {
    const r: Result = { kind: 'nearest', md: '01-01' };
    expect(resultSentence(r)).toBe('Para el 1 de enero no hay.');
  });
});

describe('countCoveredDays', () => {
  test('counts days with at least one song', () => {
    const db: DB = { generated_at: 't', songs: [], days: { '01-01': [0], '01-02': [], '01-03': [1, 2] } };
    expect(countCoveredDays(db)).toBe(2);
  });
});

describe('formatFullDate placeholder year', () => {
  test('sentinel year 2000 shows DD.MM only', () => {
    expect(formatFullDate('2000-08-05')).toBe('05.08');
  });
  test('real year unchanged', () => {
    expect(formatFullDate('2019-08-05')).toBe('05.08.2019');
  });
});

describe('spotifyTrackId', () => {
  test('extracts the 22-char id from a track url', () => {
    expect(spotifyTrackId('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')).toBe('4uLU6hMCjMI75M1A2tKUQC');
  });
  test('ignores query strings and intl prefixes', () => {
    expect(spotifyTrackId('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc')).toBe('4uLU6hMCjMI75M1A2tKUQC');
    expect(spotifyTrackId('https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC')).toBe(
      '4uLU6hMCjMI75M1A2tKUQC',
    );
  });
  test('returns null for anything that is not a track link', () => {
    expect(spotifyTrackId('')).toBeNull();
    expect(spotifyTrackId('https://open.spotify.com/search/mac%20demarco')).toBeNull();
    expect(spotifyTrackId('https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(spotifyTrackId('https://open.spotify.com/track/short')).toBeNull();
    expect(spotifyTrackId('https://evil.example/track/4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(spotifyTrackId('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"><x')).toBeNull();
  });
});
