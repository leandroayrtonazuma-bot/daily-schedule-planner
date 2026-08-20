import { describe, expect, test } from 'vitest';
import { materializeMockEvents } from '@/lib/calendar/mock';
import type { MockEventSpec } from '@/lib/calendar/mock';

const TZ = 'Asia/Tokyo';
const DATE = '2026-08-21';

const spec = (over: Partial<MockEventSpec> & { id: string }): MockEventSpec => ({
  start: '09:00',
  end: '10:00',
  ...over,
});

describe('materializeMockEvents', () => {
  test('HH:mm を対象日の絶対時刻に変換する', () => {
    const result = materializeMockEvents([spec({ id: 'a', start: '09:00', end: '10:30' })], DATE, TZ);

    expect(result).toHaveLength(1);
    expect(result[0].start.dateTime).toBe('2026-08-21T00:00:00.000Z');
    expect(result[0].end.dateTime).toBe('2026-08-21T01:30:00.000Z');
  });

  test('startOffsetDays が負なら前日から始まる予定になる', () => {
    const result = materializeMockEvents(
      [spec({ id: 'a', startOffsetDays: -1, start: '22:00', end: '02:00' })],
      DATE,
      TZ,
    );

    expect(result[0].start.dateTime).toBe('2026-08-20T13:00:00.000Z');
    expect(result[0].end.dateTime).toBe('2026-08-20T17:00:00.000Z');
  });

  test('endOffsetDays が正なら翌日まで続く予定になる', () => {
    const result = materializeMockEvents(
      [spec({ id: 'a', start: '23:00', endOffsetDays: 1, end: '03:00' })],
      DATE,
      TZ,
    );

    expect(result[0].start.dateTime).toBe('2026-08-21T14:00:00.000Z');
    expect(result[0].end.dateTime).toBe('2026-08-21T18:00:00.000Z');
  });

  test('対象日と重ならない予定は返さない（events.list の絞り込みを模す）', () => {
    const result = materializeMockEvents(
      [spec({ id: 'a', startOffsetDays: 3, start: '09:00', endOffsetDays: 3, end: '10:00' })],
      DATE,
      TZ,
    );

    expect(result).toEqual([]);
  });

  test('終日予定は date フィールドを持ち dateTime を持たない', () => {
    const result = materializeMockEvents([{ id: 'a', summary: '休暇', allDay: true }], DATE, TZ);

    expect(result[0].start).toEqual({ date: '2026-08-21' });
    expect(result[0].end).toEqual({ date: '2026-08-22' });
  });

  test('status・transparency・attendees をそのまま引き継ぐ', () => {
    const result = materializeMockEvents(
      [
        spec({
          id: 'a',
          status: 'cancelled',
          transparency: 'transparent',
          attendees: [{ email: 'me@example.com', self: true, responseStatus: 'declined' }],
        }),
      ],
      DATE,
      TZ,
    );

    expect(result[0].status).toBe('cancelled');
    expect(result[0].transparency).toBe('transparent');
    expect(result[0].attendees).toEqual([
      { email: 'me@example.com', self: true, responseStatus: 'declined' },
    ]);
  });

  test('note は出力に含めない', () => {
    const result = materializeMockEvents([spec({ id: 'a', note: '説明用のメモ' })], DATE, TZ);

    expect(result[0]).not.toHaveProperty('note');
  });

  test('入力順に関わらず id の昇順で返す', () => {
    const result = materializeMockEvents(
      [spec({ id: 'c' }), spec({ id: 'a' }), spec({ id: 'b' })],
      DATE,
      TZ,
    );

    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  test('時刻の書式が不正なら例外を投げる', () => {
    expect(() => materializeMockEvents([spec({ id: 'a', start: '9時' })], DATE, TZ)).toThrow();
  });
});
