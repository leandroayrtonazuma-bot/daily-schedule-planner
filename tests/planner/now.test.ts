import { describe, expect, it } from 'vitest';
import { minutesInTimeZone } from '@/lib/planner/now';

describe('minutesInTimeZone', () => {
  it('指定タイムゾーンでの時刻を分に直す', () => {
    // 2026-08-21T04:30:00Z は JST では 13:30
    const now = new Date('2026-08-21T04:30:00Z');

    expect(minutesInTimeZone('Asia/Tokyo', now)).toBe(810);
  });

  it('タイムゾーンが違えば結果も違う', () => {
    const now = new Date('2026-08-21T04:30:00Z');

    expect(minutesInTimeZone('UTC', now)).toBe(270);
  });

  it('日付が変わる側でも 0〜1439 に収まる', () => {
    // JST では翌日の 00:30
    const now = new Date('2026-08-21T15:30:00Z');

    expect(minutesInTimeZone('Asia/Tokyo', now)).toBe(30);
  });

  it('真夜中は 0', () => {
    expect(minutesInTimeZone('Asia/Tokyo', new Date('2026-08-20T15:00:00Z'))).toBe(0);
  });
});
