import { describe, expect, test } from 'vitest';
import {
  averageGap,
  boxStats,
  busiestCalendarDay,
  busiestDate,
  busiestMonth,
  coveredCalendarDays,
  creativeTitles,
  leapDaySongs,
  longestGap,
  longestStreak,
  longestTitle,
  monthBoxes,
  monthTakeaway,
  quantile,
  recordingYears,
  repeatedDays,
  titleKinds,
  weekdayCounts,
  weekdayTakeaway,
  yearBars,
  yearTakeaway,
  isDateOnly,
  daysBetween,
  weekdayIndex,
  spokenFullDate,
  dateRange,
  percentSplit,
  fmtNum,
  titleTakeaway,
} from '../src/lib/stats';
import type { Song } from '../src/lib/types';

const s = (title: string, date: string, album = 'One Wayne G'): Song => ({
  title,
  date,
  md: date.slice(5),
  album,
  spotify: '',
  exact_link: true,
});

// Small fixture: two recording years (2019, 2021), 2020 empty.
const SONGS: Song[] = [
  s('20190101', '2019-01-01'), // tue
  s('20190102 2', '2019-01-02'), // wed
  s('20190103', '2019-01-03'), // thu
  s('20190103 Long Title Here', '2019-01-03'), // thu
  s('20190310', '2019-03-10'), // sun
  s('20210101 A', '2021-01-01', 'Seaplane Dog'), // fri
  s('20210310', '2021-03-10', 'Seaplane Dog'), // wed
  s('20210310 2', '2021-03-10', 'Seaplane Dog'), // wed
];

describe('quantile (linear interpolation, R type 7)', () => {
  test('interpolates between ranks', () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(quantile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25);
  });
  test('exact ranks and edges', () => {
    expect(quantile([0, 10, 20], 0.5)).toBe(10);
    expect(quantile([0, 10, 20], 0)).toBe(0);
    expect(quantile([0, 10, 20], 1)).toBe(20);
  });
  test('single value', () => {
    expect(quantile([7], 0.25)).toBe(7);
  });
  test('empty → 0', () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe('boxStats', () => {
  test('sorts its input and returns five numbers', () => {
    expect(boxStats([4, 1, 3, 2])).toEqual({ min: 1, q1: 1.75, median: 2.5, q3: 3.25, max: 4 });
  });
});

describe('recordingYears', () => {
  test('only years with songs, ascending', () => {
    expect(recordingYears(SONGS)).toEqual([2019, 2021]);
  });
});

describe('monthBoxes', () => {
  const boxes = monthBoxes(SONGS);
  test('12 months with totals', () => {
    expect(boxes).toHaveLength(12);
    expect(boxes.map((b) => b.total)).toEqual([5, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
  test('one value per recording year', () => {
    expect(boxes[0].perYear).toEqual([
      { year: 2019, count: 4 },
      { year: 2021, count: 1 },
    ]);
    expect(boxes[0].box).toEqual({ min: 1, q1: 1.75, median: 2.5, q3: 3.25, max: 4 });
    expect(boxes[1].box).toEqual({ min: 0, q1: 0, median: 0, q3: 0, max: 0 });
  });
});

describe('weekday', () => {
  test('index is monday-first', () => {
    expect(weekdayIndex('2019-01-01')).toBe(1); // tuesday
    expect(weekdayIndex('2019-03-10')).toBe(6); // sunday
    expect(weekdayIndex('2026-11-02')).toBe(0); // monday
  });
  test('counts mon → sun', () => {
    expect(weekdayCounts(SONGS)).toEqual([0, 1, 3, 2, 1, 0, 1]);
  });
});

describe('yearBars', () => {
  test('every year in range, empty ones at 0, split by group', () => {
    expect(yearBars(SONGS)).toEqual([
      { year: 2019, owg: 5, nuevos: 0, total: 5 },
      { year: 2020, owg: 0, nuevos: 0, total: 0 },
      { year: 2021, owg: 0, nuevos: 3, total: 3 },
    ]);
  });
});

describe('takeaways', () => {
  test('month', () => {
    expect(monthTakeaway(monthBoxes(SONGS))).toBe('Enero es el mes más cargado: 5 canciones. Febrero casi no tiene: 0.');
  });
  test('weekday', () => {
    expect(weekdayTakeaway(weekdayCounts(SONGS))).toBe('Los miércoles son su día: 3 canciones.');
  });
  test('year, with an empty year', () => {
    expect(yearTakeaway(yearBars(SONGS))).toBe('2019 fue el pico (5). En 2020 no hay ni una.');
  });
  test('year, no empty year', () => {
    expect(yearTakeaway([{ year: 2018, owg: 2, nuevos: 0, total: 2 }])).toBe('2018 fue el pico (2).');
  });
});

describe('titles', () => {
  test('isDateOnly trims', () => {
    expect(isDateOnly(' 20190101 ')).toBe(true);
    expect(isDateOnly('20190101 2')).toBe(false);
  });
  test('titleKinds splits and keeps one item per song', () => {
    const k = titleKinds(SONGS);
    expect(k.dateOnly).toBe(4);
    expect(k.withSuffix).toBe(4);
    expect(k.items).toHaveLength(8);
    expect(k.items[1]).toEqual({ title: '20190102 2', date: '2019-01-02', dateOnly: false });
  });
  test('creativeTitles: longest suffixes, ties by date', () => {
    expect(creativeTitles(SONGS, 3).map((c) => c.title)).toEqual([
      '20190103 Long Title Here',
      '20190102 2',
      '20210101 A',
    ]);
    expect(creativeTitles(SONGS, 1)[0].suffix).toBe('Long Title Here');
  });
  test('longestTitle', () => {
    expect(longestTitle(SONGS).title).toBe('20190103 Long Title Here');
  });
});

describe('dates', () => {
  test('daysBetween crosses leap years', () => {
    expect(daysBetween('2019-03-10', '2021-01-01')).toBe(663);
    expect(daysBetween('2020-02-28', '2020-03-01')).toBe(2);
  });
  test('longestStreak', () => {
    expect(longestStreak(SONGS)).toEqual({ days: 3, from: '2019-01-01', to: '2019-01-03' });
  });
  test('longestStreak with a single date', () => {
    expect(longestStreak([s('x', '2020-05-05')])).toEqual({ days: 1, from: '2020-05-05', to: '2020-05-05' });
  });
  test('busiestDate: max on a full date, earliest on ties', () => {
    expect(busiestDate(SONGS)).toEqual({ date: '2019-01-03', count: 2 });
  });
  test('busiestCalendarDay ignores the year', () => {
    expect(busiestCalendarDay(SONGS)).toEqual({ md: '03-10', count: 3 });
  });
  test('repeatedDays', () => {
    expect(repeatedDays(SONGS)).toEqual({ fullDates: 2, calendarDaysAcrossYears: 2 });
  });
  test('longestGap', () => {
    expect(longestGap(SONGS)).toEqual({ days: 663, from: '2019-03-10', to: '2021-01-01' });
  });
  test('averageGap over unique dates', () => {
    expect(averageGap(SONGS)).toBeCloseTo(159.8);
    expect(averageGap([s('x', '2020-05-05')])).toBe(0);
  });
  test('busiestMonth (year + month)', () => {
    expect(busiestMonth(SONGS)).toEqual({ year: 2019, month: 1, count: 4 });
  });
  test('coveredCalendarDays and leapDaySongs', () => {
    expect(coveredCalendarDays(SONGS)).toBe(4);
    expect(leapDaySongs(SONGS)).toBe(0);
    expect(leapDaySongs([...SONGS, s('20200229 2', '2020-02-29')])).toBe(1);
  });
});

describe('formatting helpers', () => {
  test('spokenFullDate', () => {
    expect(spokenFullDate('2026-03-23')).toBe('23 de marzo de 2026');
    expect(spokenFullDate('2020-02-01')).toBe('1 de febrero de 2020');
  });
  test('dateRange collapses what it can', () => {
    expect(dateRange('2026-03-23', '2026-03-29')).toBe('del 23 al 29 de marzo de 2026');
    expect(dateRange('2026-01-30', '2026-02-02')).toBe('del 30 de enero al 2 de febrero de 2026');
    expect(dateRange('2023-01-14', '2025-10-07')).toBe('del 14 de enero de 2023 al 7 de octubre de 2025');
  });
  test('percentSplit always adds to 100', () => {
    expect(percentSplit(181, 65)).toEqual([74, 26]);
    expect(percentSplit(1, 1)).toEqual([50, 50]);
    expect(percentSplit(0, 0)).toEqual([0, 0]);
  });
  test('fmtNum uses a decimal comma', () => {
    expect(fmtNum(4.5)).toBe('4,5');
    expect(fmtNum(14.2475)).toBe('14,2');
    expect(fmtNum(16)).toBe('16');
  });
  test('titleTakeaway', () => {
    expect(titleTakeaway(181, 65)).toBe('El 74% se llama solo con la fecha. El resto le suma algo.');
  });
});
