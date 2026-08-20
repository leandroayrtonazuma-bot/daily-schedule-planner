import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** 'YYYY-MM-DD' 形式の日付文字列 */
export type DateString = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 指定タイムゾーンにおける「その日」の絶対時刻の範囲を返す。
 * dayEnd は翌日の 00:00（排他的）。サマータイムのある地域では
 * 一日が 23 時間や 25 時間になるため、24時間を足す実装にはしない。
 */
export function getDayRange(
  date: DateString,
  timeZone: string,
): { dayStart: Date; dayEnd: Date } {
  assertDateString(date);

  const dayStart = fromZonedTime(`${date}T00:00:00`, timeZone);
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error(`日付を解釈できません: ${date} (${timeZone})`);
  }

  const dayEnd = fromZonedTime(`${addDaysToDate(date, 1)}T00:00:00`, timeZone);

  return { dayStart, dayEnd };
}

/** 指定タイムゾーンから見た「今日」の日付文字列 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): DateString {
  return formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
}

/** 日付文字列に日数を足す。実行環境のタイムゾーンに依存しないよう UTC で計算する */
export function addDaysToDate(date: DateString, days: number): DateString {
  assertDateString(date);

  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);

  return utc.toISOString().slice(0, 10);
}

function assertDateString(date: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${date}`);
  }
}
