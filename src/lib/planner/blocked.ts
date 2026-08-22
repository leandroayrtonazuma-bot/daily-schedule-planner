import { addDaysToDate, type DateString } from '@/lib/calendar/day';
import type { BlockedWindow, DayOfWeek } from '@/lib/domain';
import { normalizeIntervals, type Interval } from './intervals';
import { MINUTES_PER_DAY, parseTime } from './time';

/** どのブロック設定から来た区間かを保つ。画面で名前を出すために使う */
export type BlockedSpan = {
  window: BlockedWindow;
  interval: Interval;
};

/**
 * その日に効くブロック時間帯を区間に変換する（PLAN.md 6.1 ステップ4）。
 *
 * specific_date が入っていれば単発ブロックとして、その日から始まる分だけ効く。
 * 入っていなければ days_of_week で判定する。
 *
 * 終了が開始より前のときは日跨ぎ（23:00–07:00 の睡眠など）とみなし、
 * 当日ぶんの [開始, 24:00) に加えて、**前日から続く** [00:00, 終了) もふさぐ。
 * 前日ぶんを落とすと、睡眠中の朝にルーティンが置かれてしまう。
 */
export function blockedSpansForDate(
  windows: readonly BlockedWindow[],
  date: DateString,
): BlockedSpan[] {
  const yesterday = addDaysToDate(date, -1);
  const spans: BlockedSpan[] = [];

  for (const window of windows) {
    const times = parseTimes(window);
    if (!times) continue;

    const { start, end } = times;

    if (end > start) {
      if (appliesOn(window, date)) spans.push({ window, interval: { start, end } });
      continue;
    }

    // 日跨ぎ。夜の部分は当日ぶん、朝の部分は前日ぶん
    if (appliesOn(window, date)) {
      spans.push({ window, interval: { start, end: MINUTES_PER_DAY } });
    }
    if (end > 0 && appliesOn(window, yesterday)) {
      spans.push({ window, interval: { start: 0, end } });
    }
  }

  return spans.sort((a, b) => a.interval.start - b.interval.start);
}

/** 配置アルゴリズムが使う、重なりをまとめた区間列 */
export function blockedIntervalsForDate(
  windows: readonly BlockedWindow[],
  date: DateString,
): Interval[] {
  return normalizeIntervals(blockedSpansForDate(windows, date).map((span) => span.interval));
}

function appliesOn(window: BlockedWindow, date: DateString): boolean {
  if (window.specificDate) return window.specificDate === date;

  return window.daysOfWeek.includes(dayOfWeekOf(date));
}

/** 実行環境のタイムゾーンに依存しないよう、日付文字列を UTC として読む */
function dayOfWeekOf(date: DateString): DayOfWeek {
  return new Date(`${date}T00:00:00Z`).getUTCDay() as DayOfWeek;
}

function parseTimes(window: BlockedWindow): { start: number; end: number } | null {
  try {
    return { start: parseTime(window.startTime), end: parseTime(window.endTime) };
  } catch {
    // 壊れた設定で一日が消えるより、無視して先へ進むほうが安全
    return null;
  }
}
