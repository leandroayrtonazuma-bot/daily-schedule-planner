import type { Minutes } from './time';

/** 半開区間 [start, end)。単位は「その日の 00:00 からの分」 */
export type Interval = {
  start: Minutes;
  end: Minutes;
};

/**
 * 長さの無い区間を捨て、開始時刻でソートし、重なりと隣接をまとめる。
 * これ以降の演算はすべて「正規化済みの区間列」を前提にする。
 */
export function normalizeIntervals(list: readonly Interval[]): Interval[] {
  const sorted = list
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({ start: interval.start, end: interval.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Interval[] = [];

  for (const interval of sorted) {
    const last = merged[merged.length - 1];

    // 隣接（last.end === interval.start）も1つにまとめる。
    // 分けたままだと「9:00-10:00 の空き」が2つに見え、60分の項目が入らなくなる。
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
      continue;
    }

    merged.push(interval);
  }

  return merged;
}

/** base から cuts を差し引いた残りを返す */
export function subtractIntervals(
  base: readonly Interval[],
  cuts: readonly Interval[],
): Interval[] {
  const remaining = normalizeIntervals(base);
  const removals = normalizeIntervals(cuts);

  const result: Interval[] = [];

  for (const interval of remaining) {
    let start = interval.start;

    for (const cut of removals) {
      if (cut.end <= start) continue;
      if (cut.start >= interval.end) break;

      if (cut.start > start) {
        result.push({ start, end: cut.start });
      }

      start = Math.max(start, cut.end);
      if (start >= interval.end) break;
    }

    if (start < interval.end) {
      result.push({ start, end: interval.end });
    }
  }

  return result;
}

/** 両方に含まれる部分だけを返す */
export function intersectIntervals(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const left = normalizeIntervals(a);
  const right = normalizeIntervals(b);

  const result: Interval[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);

    if (end > start) {
      result.push({ start, end });
    }

    // 先に終わる方を進める
    if (left[i].end <= right[j].end) i += 1;
    else j += 1;
  }

  return result;
}

/** 予定の前後にバッファ（移動時間）を付けた区間を返す（PLAN.md 6.1 ステップ3） */
export function padInterval(interval: Interval, before: number, after: number): Interval {
  return {
    start: Math.max(0, interval.start - before),
    end: interval.end + after,
  };
}

/** 区間の長さの合計 */
export function totalMinutes(list: readonly Interval[]): number {
  return list.reduce((sum, interval) => sum + Math.max(0, interval.end - interval.start), 0);
}
