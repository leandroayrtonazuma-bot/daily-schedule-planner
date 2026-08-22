import { describe, expect, it } from 'vitest';
import { formatMinutes, parseTime } from '@/lib/planner/time';

describe('parseTime', () => {
  it('日付の先頭からの分数に変換する', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('23:59')).toBe(1439);
  });

  it('24:00 は一日の終わりとして 1440 を返す', () => {
    expect(parseTime('24:00')).toBe(1440);
  });

  it('Postgres の time 型が返す秒付きの形式も受け付ける', () => {
    expect(parseTime('09:30:00')).toBe(570);
  });

  it('形式が違えば投げる', () => {
    expect(() => parseTime('9:30')).toThrow();
    expect(() => parseTime('0930')).toThrow();
    expect(() => parseTime('')).toThrow();
  });

  it('存在しない時刻は投げる', () => {
    expect(() => parseTime('24:01')).toThrow();
    expect(() => parseTime('25:00')).toThrow();
    expect(() => parseTime('12:60')).toThrow();
  });
});

describe('formatMinutes', () => {
  it('HH:mm に戻す', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(570)).toBe('09:30');
    expect(formatMinutes(1439)).toBe('23:59');
  });

  it('1440 は 24:00 と表示する', () => {
    expect(formatMinutes(1440)).toBe('24:00');
  });

  it('parseTime と往復しても変わらない', () => {
    for (const value of ['00:00', '05:15', '12:00', '23:45', '24:00']) {
      expect(formatMinutes(parseTime(value))).toBe(value);
    }
  });
});
