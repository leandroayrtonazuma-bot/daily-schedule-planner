import { describe, expect, test } from 'vitest';
import { mergeBusyIntervals, normalizeEvents } from '@/lib/calendar/normalize';
import type { NormalizeOptions, RawCalendarEvent } from '@/lib/calendar/types';

// 対象日: 2026-08-21 (Asia/Tokyo)
const DAY_START = new Date('2026-08-21T00:00:00+09:00');
const DAY_END = new Date('2026-08-22T00:00:00+09:00');

const baseOptions: NormalizeOptions = {
  dayStart: DAY_START,
  dayEnd: DAY_END,
  includeAllDay: false,
};

function timed(
  id: string,
  startIso: string,
  endIso: string,
  extra: Partial<RawCalendarEvent> = {},
): RawCalendarEvent {
  return {
    id,
    status: 'confirmed',
    summary: id,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    ...extra,
  };
}

const jst = (hhmm: string) => new Date(`2026-08-21T${hhmm}:00+09:00`);

describe('normalizeEvents', () => {
  test('時刻ありの通常予定はそのまま残る', () => {
    const raw = [timed('a', '2026-08-21T10:00:00+09:00', '2026-08-21T11:30:00+09:00')];

    const result = normalizeEvents(raw, baseOptions);

    expect(result).toEqual([
      { id: 'a', title: 'a', start: jst('10:00'), end: jst('11:30'), allDay: false },
    ]);
  });

  test('summary が無い予定は代替タイトルになる', () => {
    const raw = [
      timed('a', '2026-08-21T10:00:00+09:00', '2026-08-21T11:00:00+09:00', { summary: undefined }),
    ];

    expect(normalizeEvents(raw, baseOptions)[0].title).toBe('(タイトルなし)');
  });

  test('status が cancelled の予定を除外する', () => {
    const raw = [
      timed('a', '2026-08-21T10:00:00+09:00', '2026-08-21T11:00:00+09:00', { status: 'cancelled' }),
    ];

    expect(normalizeEvents(raw, baseOptions)).toEqual([]);
  });

  test('transparency が transparent の予定を除外する', () => {
    const raw = [
      timed('a', '2026-08-21T10:00:00+09:00', '2026-08-21T11:00:00+09:00', {
        transparency: 'transparent',
      }),
    ];

    expect(normalizeEvents(raw, baseOptions)).toEqual([]);
  });

  test('自分が declined した予定を除外する', () => {
    const raw = [
      timed('a', '2026-08-21T10:00:00+09:00', '2026-08-21T11:00:00+09:00', {
        attendees: [{ email: 'me@example.com', self: true, responseStatus: 'declined' }],
      }),
    ];

    expect(normalizeEvents(raw, baseOptions)).toEqual([]);
  });

  test('他人が declined でも自分が accepted なら残す', () => {
    const raw = [
      timed('a', '2026-08-21T10:00:00+09:00', '2026-08-21T11:00:00+09:00', {
        attendees: [
          { email: 'me@example.com', self: true, responseStatus: 'accepted' },
          { email: 'other@example.com', responseStatus: 'declined' },
        ],
      }),
    ];

    expect(normalizeEvents(raw, baseOptions).map((e) => e.id)).toEqual(['a']);
  });

  test('includeAllDay が false なら終日予定を除外する', () => {
    const raw: RawCalendarEvent[] = [
      {
        id: 'a',
        status: 'confirmed',
        summary: '休暇',
        start: { date: '2026-08-21' },
        end: { date: '2026-08-22' },
      },
    ];

    expect(normalizeEvents(raw, baseOptions)).toEqual([]);
  });

  test('includeAllDay が true なら終日予定を当日いっぱいとして含める', () => {
    const raw: RawCalendarEvent[] = [
      {
        id: 'a',
        status: 'confirmed',
        summary: '休暇',
        start: { date: '2026-08-21' },
        end: { date: '2026-08-22' },
      },
    ];

    expect(normalizeEvents(raw, { ...baseOptions, includeAllDay: true })).toEqual([
      { id: 'a', title: '休暇', start: DAY_START, end: DAY_END, allDay: true },
    ]);
  });

  test('前日から続く予定を当日の開始時刻で切り取る', () => {
    const raw = [timed('a', '2026-08-20T22:00:00+09:00', '2026-08-21T02:00:00+09:00')];

    const result = normalizeEvents(raw, baseOptions);

    expect(result[0].start).toEqual(DAY_START);
    expect(result[0].end).toEqual(jst('02:00'));
  });

  test('翌日へ続く予定を当日の終了時刻で切り取る', () => {
    const raw = [timed('a', '2026-08-21T23:00:00+09:00', '2026-08-22T03:00:00+09:00')];

    const result = normalizeEvents(raw, baseOptions);

    expect(result[0].start).toEqual(jst('23:00'));
    expect(result[0].end).toEqual(DAY_END);
  });

  test('当日の範囲外にある予定を除外する', () => {
    const raw = [timed('a', '2026-08-22T10:00:00+09:00', '2026-08-22T11:00:00+09:00')];

    expect(normalizeEvents(raw, baseOptions)).toEqual([]);
  });

  test('切り取った結果が長さ0になる予定を除外する', () => {
    // 前日 22:00-24:00。当日にはみ出していない
    const raw = [timed('a', '2026-08-20T22:00:00+09:00', '2026-08-21T00:00:00+09:00')];

    expect(normalizeEvents(raw, baseOptions)).toEqual([]);
  });

  test('開始時刻の昇順、同時刻なら id の昇順で並べる', () => {
    const raw = [
      timed('c', '2026-08-21T13:00:00+09:00', '2026-08-21T14:00:00+09:00'),
      timed('b', '2026-08-21T09:00:00+09:00', '2026-08-21T10:00:00+09:00'),
      timed('a', '2026-08-21T09:00:00+09:00', '2026-08-21T09:30:00+09:00'),
    ];

    expect(normalizeEvents(raw, baseOptions).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  test('同じ入力を2回流すと同じ出力になる', () => {
    const raw = [
      timed('b', '2026-08-21T09:00:00+09:00', '2026-08-21T10:00:00+09:00'),
      timed('a', '2026-08-21T09:00:00+09:00', '2026-08-21T10:00:00+09:00'),
      timed('x', '2026-08-21T10:00:00+09:00', '2026-08-21T11:00:00+09:00', {
        status: 'cancelled',
      }),
    ];

    expect(normalizeEvents(raw, baseOptions)).toEqual(normalizeEvents(raw, baseOptions));
  });

  test('入力配列を書き換えない', () => {
    const raw = [
      timed('b', '2026-08-21T13:00:00+09:00', '2026-08-21T14:00:00+09:00'),
      timed('a', '2026-08-21T09:00:00+09:00', '2026-08-21T10:00:00+09:00'),
    ];

    normalizeEvents(raw, baseOptions);

    expect(raw.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('mergeBusyIntervals', () => {
  const ev = (id: string, start: string, end: string) => ({
    id,
    title: id,
    start: jst(start),
    end: jst(end),
    allDay: false,
  });

  test('重複する2件を1つにまとめる', () => {
    const result = mergeBusyIntervals([ev('a', '10:00', '11:00'), ev('b', '10:30', '12:00')]);

    expect(result).toEqual([{ start: jst('10:00'), end: jst('12:00'), sourceIds: ['a', 'b'] }]);
  });

  test('隙間なく接している2件をまとめる', () => {
    const result = mergeBusyIntervals([ev('a', '10:00', '11:00'), ev('b', '11:00', '12:00')]);

    expect(result).toEqual([{ start: jst('10:00'), end: jst('12:00'), sourceIds: ['a', 'b'] }]);
  });

  test('離れている2件はまとめない', () => {
    const result = mergeBusyIntervals([ev('a', '10:00', '11:00'), ev('b', '13:00', '14:00')]);

    expect(result).toEqual([
      { start: jst('10:00'), end: jst('11:00'), sourceIds: ['a'] },
      { start: jst('13:00'), end: jst('14:00'), sourceIds: ['b'] },
    ]);
  });

  test('片方が完全に内包される場合は外側の範囲を保つ', () => {
    const result = mergeBusyIntervals([ev('a', '09:00', '18:00'), ev('b', '12:00', '13:00')]);

    expect(result).toEqual([{ start: jst('09:00'), end: jst('18:00'), sourceIds: ['a', 'b'] }]);
  });

  test('空配列なら空配列を返す', () => {
    expect(mergeBusyIntervals([])).toEqual([]);
  });
});
