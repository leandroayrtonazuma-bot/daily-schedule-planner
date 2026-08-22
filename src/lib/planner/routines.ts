import type { DateString } from '@/lib/calendar/day';
import type { DayOfWeek, Routine, TimeWindow } from '@/lib/domain';
import { formatDuration } from '@/lib/format';
import {
  intersectIntervals,
  normalizeIntervals,
  subtractIntervals,
  totalMinutes,
  type Interval,
} from './intervals';
import { parseTime, type Minutes } from './time';

export type PlacedRoutine = {
  routineId: string;
  /** 1始まり。times_per_day の何回目か */
  occurrence: number;
  start: Minutes;
  end: Minutes;
};

export type UnplacedRoutine = {
  routineId: string;
  title: string;
  placedCount: number;
  requiredCount: number;
};

export type RoutinePlacement = {
  placed: PlacedRoutine[];
  /** 配置後に残った空き */
  free: Interval[];
  unplaced: UnplacedRoutine[];
};

/**
 * その日に配置対象となるルーティンか（PLAN.md 6.2）。
 * routine_skips による当日スキップは呼び出し側で除く。
 */
export function isRoutineActiveOn(routine: Routine, date: DateString): boolean {
  if (!routine.isActive) return false;
  if (routine.archivedAt) return false;

  // 日付文字列を UTC として読むことで、実行環境のタイムゾーンに依存させない
  const utc = new Date(`${date}T00:00:00Z`);
  const dayOfWeek = utc.getUTCDay();
  const month = utc.getUTCMonth() + 1;

  if (!routine.daysOfWeek.includes(dayOfWeek as DayOfWeek)) return false;
  if (!routine.activeMonths.includes(month)) return false;

  return true;
}

/**
 * 配置順（PLAN.md 6.2）。制約の強いものから置く。
 *
 * 1. 許可時間帯の合計幅 ÷ (所要時間 × 回数) が小さい順
 * 2. priority 昇順
 * 3. id 昇順（決定性）
 */
export function sortRoutinesForPlacement(routines: readonly Routine[]): Routine[] {
  return [...routines].sort((a, b) => {
    // 割り算にすると誤差で順序が揺れるので、たすき掛けで比較する
    const left = allowedWidth(a) * requiredMinutes(b);
    const right = allowedWidth(b) * requiredMinutes(a);
    if (left !== right) return left - right;

    if (a.priority !== b.priority) return a.priority - b.priority;

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * ルーティンを空きに配置する（PLAN.md 6.2）。
 * 候補が複数ある場合は最も早い時刻を選ぶ。
 *
 * routines は当日の対象に絞り込み済みであること。
 */
export function placeRoutines(params: {
  routines: readonly Routine[];
  free: readonly Interval[];
  /**
   * すでに確定していて動かせない回（ピン留め・完了済み・再計算時の過去分）。
   * 残りの回数と最小間隔の起点をここから決める。返り値の placed には含めない。
   */
  preplaced?: readonly PlacedRoutine[];
}): RoutinePlacement {
  let free = normalizeIntervals(params.free);

  const placed: PlacedRoutine[] = [];
  const unplaced: UnplacedRoutine[] = [];

  for (const routine of sortRoutinesForPlacement(params.routines)) {
    const windows = toIntervals(routine.allowedWindows);
    const fixed = (params.preplaced ?? []).filter((item) => item.routineId === routine.id);

    let placedCount = fixed.length;
    // 同一ルーティンの前の回との最小間隔（PLAN.md 6.2）
    let earliestStart = fixed.reduce(
      (latest, item) => Math.max(latest, item.end + routine.minGapMinutes),
      0,
    );

    for (let occurrence = placedCount + 1; occurrence <= routine.timesPerDay; occurrence += 1) {
      const slot = findEarliestSlot({
        candidates: intersectIntervals(free, windows),
        duration: routine.durationMinutes,
        notBefore: earliestStart,
      });

      if (!slot) break;

      placed.push({ routineId: routine.id, occurrence, start: slot.start, end: slot.end });
      free = subtractIntervals(free, [slot]);
      earliestStart = slot.end + routine.minGapMinutes;
      placedCount += 1;
    }

    if (placedCount < routine.timesPerDay) {
      unplaced.push({
        routineId: routine.id,
        title: routine.title,
        placedCount,
        requiredCount: routine.timesPerDay,
      });
    }
  }

  return { placed, free, unplaced };
}

/**
 * 保存前の妥当性検証（PLAN.md 6.5）。
 * 問題が無ければ空配列。エラー文はそのまま画面に出す。
 */
export function validateRoutine(routine: Routine): string[] {
  const errors: string[] = [];

  if (!routine.title.trim()) errors.push('タイトルを入力してください');
  if (routine.durationMinutes <= 0) errors.push('所要時間は1分以上にしてください');
  if (routine.timesPerDay < 1 || routine.timesPerDay > 10) {
    errors.push('1日の回数は1〜10回にしてください');
  }
  if (routine.minGapMinutes < 0) errors.push('最小間隔は0分以上にしてください');
  if (routine.daysOfWeek.length === 0) errors.push('曜日を1つ以上選んでください');
  if (routine.activeMonths.length === 0) errors.push('有効な月を1つ以上選んでください');

  if (routine.allowedWindows.length === 0) {
    errors.push('許可時間帯を1つ以上設定してください');
    return errors;
  }

  for (const window of routine.allowedWindows) {
    let start: Minutes;
    let end: Minutes;
    try {
      start = parseTime(window.start);
      end = parseTime(window.end);
    } catch {
      errors.push(`許可時間帯の時刻を解釈できません: ${window.start}–${window.end}`);
      continue;
    }

    if (end <= start) {
      errors.push(`許可時間帯の終了は開始より後にしてください: ${window.start}–${window.end}`);
    }
  }

  if (errors.length > 0) return errors;

  const required = requiredMinutes(routine);
  const available = allowedWidth(routine);

  if (required > available) {
    errors.push(
      `許可時間帯（合計 ${formatDuration(available)}）より必要な時間（${formatDuration(required)}）のほうが長くなっています`,
    );
  }

  return errors;
}

/** そのルーティンを完遂するのに最低限必要な時間（間隔を含む） */
export function requiredMinutes(routine: Routine): number {
  return (
    routine.durationMinutes * routine.timesPerDay +
    routine.minGapMinutes * Math.max(0, routine.timesPerDay - 1)
  );
}

/** 許可時間帯の合計幅。重なりは1回だけ数える */
export function allowedWidth(routine: Routine): number {
  return totalMinutes(toIntervals(routine.allowedWindows));
}

export function toIntervals(windows: readonly TimeWindow[]): Interval[] {
  const intervals: Interval[] = [];

  for (const window of windows) {
    try {
      intervals.push({ start: parseTime(window.start), end: parseTime(window.end) });
    } catch {
      // 壊れた設定は無いものとして扱う。保存時に validateRoutine で弾いている
    }
  }

  return normalizeIntervals(intervals);
}

/** duration が収まる最も早い位置。notBefore より前には置かない */
function findEarliestSlot(params: {
  candidates: readonly Interval[];
  duration: number;
  notBefore: Minutes;
}): Interval | null {
  for (const candidate of params.candidates) {
    const start = Math.max(candidate.start, params.notBefore);
    const end = start + params.duration;

    if (end <= candidate.end) return { start, end };
  }

  return null;
}

