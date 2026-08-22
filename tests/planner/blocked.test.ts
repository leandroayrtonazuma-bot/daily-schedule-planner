import { describe, expect, it } from 'vitest';
import { blockedIntervalsForDate } from '@/lib/planner/blocked';
import { makeBlockedWindow } from '../helpers/factories';

// 2026-08-21 は金曜日
const FRIDAY = '2026-08-21';
const SATURDAY = '2026-08-22';

describe('blockedIntervalsForDate', () => {
  it('曜日が合えば区間を返す', () => {
    const window = makeBlockedWindow({
      id: 'commute',
      startTime: '08:00',
      endTime: '09:00',
      daysOfWeek: [1, 2, 3, 4, 5],
    });

    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([{ start: 480, end: 540 }]);
  });

  it('曜日が合わなければ返さない', () => {
    const window = makeBlockedWindow({ id: 'commute', daysOfWeek: [1, 2, 3, 4, 5] });

    expect(blockedIntervalsForDate([window], SATURDAY)).toEqual([]);
  });

  it('単発ブロックはその日だけ効く', () => {
    const window = makeBlockedWindow({
      id: 'trip',
      startTime: '13:00',
      endTime: '18:00',
      specificDate: FRIDAY,
      daysOfWeek: [], // 単発なので曜日は無視される
    });

    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([{ start: 780, end: 1080 }]);
    expect(blockedIntervalsForDate([window], SATURDAY)).toEqual([]);
  });

  it('重なるブロックはまとめる', () => {
    const windows = [
      makeBlockedWindow({ id: 'a', startTime: '08:00', endTime: '09:00' }),
      makeBlockedWindow({ id: 'b', startTime: '08:30', endTime: '10:00' }),
    ];

    expect(blockedIntervalsForDate(windows, FRIDAY)).toEqual([{ start: 480, end: 600 }]);
  });

  it('日を跨ぐ指定（23:00–06:00 の睡眠など）は当日の朝と夜の両方をふさぐ', () => {
    const window = makeBlockedWindow({ id: 'sleep', startTime: '23:00', endTime: '06:00' });

    // 朝の 00:00–06:00 は前日ぶんの続き、夜の 23:00–24:00 は当日ぶん
    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([
      { start: 0, end: 360 },
      { start: 1380, end: 1440 },
    ]);
  });

  it('日跨ぎブロックの朝の部分は、前日が対象曜日のときだけ効く', () => {
    // 金曜だけ有効な 23:00–06:00
    const window = makeBlockedWindow({
      id: 'sleep',
      startTime: '23:00',
      endTime: '06:00',
      daysOfWeek: [5],
    });

    // 金曜: 木曜は対象外なので朝はふさがれない
    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([{ start: 1380, end: 1440 }]);
    // 土曜: 前日（金）から続く朝だけがふさがれる
    expect(blockedIntervalsForDate([window], SATURDAY)).toEqual([{ start: 0, end: 360 }]);
  });

  it('単発の日跨ぎブロックも翌日の朝までふさぐ', () => {
    const window = makeBlockedWindow({
      id: 'redeye',
      startTime: '22:00',
      endTime: '05:00',
      specificDate: FRIDAY,
    });

    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([{ start: 1320, end: 1440 }]);
    expect(blockedIntervalsForDate([window], SATURDAY)).toEqual([{ start: 0, end: 300 }]);
  });

  it('終了に 24:00 を指定できる', () => {
    const window = makeBlockedWindow({ id: 'sleep', startTime: '23:00', endTime: '24:00' });

    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([{ start: 1380, end: 1440 }]);
  });

  it('壊れた時刻は無いものとして扱う', () => {
    const window = makeBlockedWindow({ id: 'broken', startTime: 'あさ', endTime: '09:00' });

    expect(blockedIntervalsForDate([window], FRIDAY)).toEqual([]);
  });
});
