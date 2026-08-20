import { describe, expect, test } from 'vitest';
import { formatDateHeading, formatDuration, formatTime } from '@/lib/format';

const TZ = 'Asia/Tokyo';

describe('formatTime', () => {
  test('指定タイムゾーンの HH:mm にする', () => {
    expect(formatTime(new Date('2026-08-21T00:00:00Z'), TZ)).toBe('09:00');
  });

  test('日付が変わる境界でも正しい', () => {
    expect(formatTime(new Date('2026-08-21T15:00:00Z'), TZ)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  test('60分未満は分だけ', () => {
    expect(formatDuration(45)).toBe('45分');
  });

  test('ちょうど1時間は時間だけ', () => {
    expect(formatDuration(60)).toBe('1時間');
  });

  test('端数があれば時間と分を並べる', () => {
    expect(formatDuration(90)).toBe('1時間30分');
  });

  test('0分は 0分 と表示する', () => {
    expect(formatDuration(0)).toBe('0分');
  });

  test('24時間以上でも時間で表す', () => {
    expect(formatDuration(1500)).toBe('25時間');
  });
});

describe('formatDateHeading', () => {
  test('年月日と曜日を日本語で表示する', () => {
    expect(formatDateHeading('2026-08-21')).toBe('2026年8月21日(金)');
  });

  test('月と日にゼロ埋めをしない', () => {
    expect(formatDateHeading('2026-01-05')).toBe('2026年1月5日(月)');
  });

  test('実行環境のタイムゾーンに依存しない', () => {
    expect(formatDateHeading('2026-08-22')).toBe('2026年8月22日(土)');
  });
});
