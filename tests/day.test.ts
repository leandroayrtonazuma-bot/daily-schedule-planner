import { describe, expect, test } from 'vitest';
import { getDayRange, todayInTimeZone } from '@/lib/calendar/day';

describe('getDayRange', () => {
  test('Asia/Tokyo の一日は UTC の前日15時から当日15時まで', () => {
    const range = getDayRange('2026-08-21', 'Asia/Tokyo');

    expect(range.dayStart.toISOString()).toBe('2026-08-20T15:00:00.000Z');
    expect(range.dayEnd.toISOString()).toBe('2026-08-21T15:00:00.000Z');
  });

  test('タイムゾーンが変われば境界も変わる', () => {
    const range = getDayRange('2026-08-21', 'America/New_York');

    expect(range.dayStart.toISOString()).toBe('2026-08-21T04:00:00.000Z');
    expect(range.dayEnd.toISOString()).toBe('2026-08-22T04:00:00.000Z');
  });

  test('サマータイム開始日は23時間になる', () => {
    const range = getDayRange('2026-03-08', 'America/New_York');
    const hours = (range.dayEnd.getTime() - range.dayStart.getTime()) / 3_600_000;

    expect(hours).toBe(23);
  });

  test('不正な日付文字列を拒否する', () => {
    expect(() => getDayRange('2026/08/21', 'Asia/Tokyo')).toThrow();
  });
});

describe('todayInTimeZone', () => {
  test('UTC では前日でも東京では翌日になる', () => {
    expect(todayInTimeZone('Asia/Tokyo', new Date('2026-08-20T15:30:00Z'))).toBe('2026-08-21');
  });

  test('東京の日付が変わる直前は前日のまま', () => {
    expect(todayInTimeZone('Asia/Tokyo', new Date('2026-08-20T14:59:59Z'))).toBe('2026-08-20');
  });

  test('月末をまたいでも正しく繰り上がる', () => {
    expect(todayInTimeZone('Asia/Tokyo', new Date('2026-08-31T15:00:00Z'))).toBe('2026-09-01');
  });
});
