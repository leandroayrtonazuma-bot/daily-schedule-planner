import { normalizeIntervals, subtractIntervals, type Interval } from './intervals';

export type BreakInsertion = {
  breaks: Interval[];
  /** 休憩ぶんを差し引いた空き */
  free: Interval[];
};

/**
 * 連続作業が break_after_minutes を超えた箇所に休憩を差し込む（PLAN.md 6.1 ステップ7）。
 *
 * 休憩はルーティンとタスクを置いたあとの空きに入れる。したがって
 * 「作業の直後が埋まっている」場合は入れられない。そのときは無理に動かさず、
 * 休憩なしのまま返す（緩和案の提示は relax.ts の担当）。
 *
 * 作業と作業の間に休憩と同じだけの空きがあれば、そこで一区切りついたとみなして
 * 連続作業のカウントをやり直す。
 */
export function insertBreaks(params: {
  work: readonly Interval[];
  free: readonly Interval[];
  breakAfterMinutes: number;
  breakDurationMinutes: number;
}): BreakInsertion {
  const { breakAfterMinutes, breakDurationMinutes } = params;

  let free = normalizeIntervals(params.free);

  if (breakDurationMinutes <= 0 || breakAfterMinutes <= 0) {
    return { breaks: [], free };
  }

  const work = normalizeIntervals(params.work);
  const breaks: Interval[] = [];

  let streak = 0;
  let previousEnd: number | null = null;

  for (const interval of work) {
    if (previousEnd !== null && interval.start - previousEnd >= breakDurationMinutes) {
      streak = 0;
    }

    streak += interval.end - interval.start;
    previousEnd = interval.end;

    if (streak < breakAfterMinutes) continue;

    const slot = { start: previousEnd, end: previousEnd + breakDurationMinutes };
    if (!fitsInFree(free, slot)) continue;

    breaks.push(slot);
    free = subtractIntervals(free, [slot]);
    streak = 0;
    previousEnd = slot.end;
  }

  return { breaks, free };
}

/** slot が空きブロック1つの中に完全に収まるか */
function fitsInFree(free: readonly Interval[], slot: Interval): boolean {
  return free.some((interval) => interval.start <= slot.start && slot.end <= interval.end);
}
