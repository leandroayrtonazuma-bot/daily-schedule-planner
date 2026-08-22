import { MINUTES_PER_DAY, parseTime, type Minutes } from './time';

/**
 * 指定タイムゾーンにおける現在時刻を、その日の 00:00 からの分で返す。
 *
 * 配置アルゴリズムは現在時刻を自分では読まない（同じ入力なら同じ出力にするため）。
 * 「今から組み直す」や現在時刻の線など、時刻が要る場所だけがここを呼ぶ。
 */
export function minutesInTimeZone(timeZone: string, now: Date = new Date()): Minutes {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  // en-GB は真夜中を '24:00' と出すことがある
  return parseTime(formatted) % MINUTES_PER_DAY;
}
