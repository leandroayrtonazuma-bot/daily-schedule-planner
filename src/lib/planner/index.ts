import type { DateString } from '@/lib/calendar/day';
import type { BlockedWindow, PlanItem, Routine, Task } from '@/lib/domain';
import type { AppSettings } from '@/lib/settings';
import { blockedIntervalsForDate } from './blocked';
import { insertBreaks } from './breaks';
import { normalizeIntervals, padInterval, subtractIntervals, type Interval } from './intervals';
import {
  isRoutineActiveOn,
  placeRoutines,
  type PlacedRoutine,
  type UnplacedRoutine,
} from './routines';
import { placeTasks, type UnplacedTask } from './tasks';
import { formatMinutes, MINUTES_PER_DAY, parseTime, type Minutes } from './time';

export type PlanBuildInput = {
  date: DateString;
  settings: AppSettings;
  /** カレンダーの占有時間。バッファ適用前の生の区間 */
  busy: readonly Interval[];
  blockedWindows: readonly BlockedWindow[];
  routines: readonly Routine[];
  /** その日だけ飛ばすルーティン（routine_skips） */
  skippedRoutineIds: readonly string[];
  tasks: readonly Task[];
  /**
   * 動かさない項目。ピン留め・完了済み・再計算時の過去分をここに入れる。
   * この時間帯は空きから除かれ、そのまま結果に残る。
   */
  locked?: readonly PlanItem[];
  /** 再計算の基準時刻（分）。指定するとこれ以降だけを組み直す（PLAN.md 6.6） */
  fromMinutes?: Minutes | null;
};

/** 置けなかった項目に対する具体的な緩和案（PLAN.md 6.4） */
export type Relaxation = {
  kind: 'break' | 'buffer' | 'defer-low-priority' | 'widen-routine';
  /** 画面にそのまま出す一文 */
  message: string;
  /** この案で置けるようになる項目のタイトル */
  resolves: string[];
};

export type PlanBuildResult = {
  items: PlanItem[];
  unplacedRoutines: UnplacedRoutine[];
  unplacedTasks: UnplacedTask[];
  relaxations: Relaxation[];
};

/**
 * 一日ぶんの配置を組む（PLAN.md 6.1）。
 *
 * 決定論的。同じ入力なら必ず同じ出力になる（PLAN.md 3.3）。
 * 乱数も現在時刻も使わない。再計算の基準時刻は fromMinutes で明示的に渡す。
 */
export function buildPlan(input: PlanBuildInput): PlanBuildResult {
  const placement = placeEverything(input);

  return {
    ...placement,
    relaxations: suggestRelaxations(input, placement),
  };
}

type Placement = Omit<PlanBuildResult, 'relaxations'>;

function placeEverything(input: PlanBuildInput): Placement {
  const { settings } = input;
  const locked = input.locked ?? [];

  // 1. 稼働時間を初期の空きとする
  let free: Interval[] = [workingRange(settings)];

  // 2〜3. カレンダー予定を前後のバッファごと差し引く
  free = subtractIntervals(
    free,
    input.busy.map((interval) =>
      padInterval(interval, settings.bufferBeforeMinutes, settings.bufferAfterMinutes),
    ),
  );

  // 4. ブロック時間帯を差し引く
  free = subtractIntervals(free, blockedIntervalsForDate(input.blockedWindows, input.date));

  // 8. 固定済みの項目を先に確保する
  const lockedIntervals = locked.flatMap(toIntervalSafely);
  free = subtractIntervals(free, lockedIntervals);

  // 6.6. 再計算では基準時刻より前を触らない
  if (input.fromMinutes != null) {
    free = subtractIntervals(free, [{ start: 0, end: input.fromMinutes }]);
  }

  // 5. ルーティン（タスクより必ず先）
  const skipped = new Set(input.skippedRoutineIds);
  const targetRoutines = input.routines.filter(
    (routine) => !skipped.has(routine.id) && isRoutineActiveOn(routine, input.date),
  );

  const routinePlacement = placeRoutines({
    routines: targetRoutines,
    free,
    preplaced: lockedRoutineOccurrences(locked),
  });
  free = routinePlacement.free;

  // 6. タスク。固定済みのタスクは二重に置かない
  const lockedTaskIds = new Set(
    locked.filter((item) => item.kind === 'task' && item.refId).map((item) => item.refId),
  );
  const taskPlacement = placeTasks({
    tasks: input.tasks.filter((task) => !lockedTaskIds.has(task.id)),
    free,
    estimateFactor: settings.estimateFactor,
  });
  free = taskPlacement.free;

  // 7. 休憩。固定済みの作業も連続作業として数える
  const work = normalizeIntervals([
    ...locked.filter((item) => item.kind !== 'break').flatMap(toIntervalSafely),
    ...routinePlacement.placed,
    ...taskPlacement.placed,
  ]);

  const breaks = insertBreaks({
    work,
    free,
    breakAfterMinutes: settings.breakAfterMinutes,
    breakDurationMinutes: settings.breakDurationMinutes,
  });

  const items: PlanItem[] = [
    ...locked,
    ...routinePlacement.placed.map(
      (item): PlanItem => ({
        kind: 'routine',
        refId: item.routineId,
        start: formatMinutes(item.start),
        end: formatMinutes(item.end),
        pinned: false,
        occurrence: item.occurrence,
      }),
    ),
    ...taskPlacement.placed.map(
      (item): PlanItem => ({
        kind: 'task',
        refId: item.taskId,
        start: formatMinutes(item.start),
        end: formatMinutes(item.end),
        pinned: false,
      }),
    ),
    ...breaks.breaks.map(
      (interval): PlanItem => ({
        kind: 'break',
        refId: null,
        start: formatMinutes(interval.start),
        end: formatMinutes(interval.end),
        pinned: false,
      }),
    ),
  ];

  return {
    items: items.sort(byStartThenKindThenRef),
    unplacedRoutines: routinePlacement.unplaced,
    unplacedTasks: taskPlacement.unplaced,
  };
}

/**
 * 緩和案を作る（PLAN.md 6.4）。
 *
 * 「入りませんでした」で終わらせず、実際に緩和した条件で組み直してみて、
 * 本当に入るようになった項目だけを挙げる。自動適用はしない。
 */
function suggestRelaxations(input: PlanBuildInput, base: Placement): Relaxation[] {
  if (base.unplacedRoutines.length === 0 && base.unplacedTasks.length === 0) return [];

  const relaxations: Relaxation[] = [];
  const { settings } = input;

  // 1. 休憩を短くする
  if (settings.breakDurationMinutes > 10) {
    const resolved = resolvedBy(base, {
      ...input,
      settings: { ...settings, breakDurationMinutes: 10 },
    });
    if (resolved.length > 0) {
      relaxations.push({
        kind: 'break',
        message: `休憩を10分にすると${quoteList(resolved)}が入ります`,
        resolves: resolved,
      });
    }
  }

  // 2. 予定前後のバッファを短くする
  if (settings.bufferBeforeMinutes > 5 || settings.bufferAfterMinutes > 5) {
    const resolved = resolvedBy(base, {
      ...input,
      settings: {
        ...settings,
        bufferBeforeMinutes: Math.min(5, settings.bufferBeforeMinutes),
        bufferAfterMinutes: Math.min(5, settings.bufferAfterMinutes),
      },
    });
    if (resolved.length > 0) {
      relaxations.push({
        kind: 'buffer',
        message: `予定前後のバッファを5分にすると${quoteList(resolved)}が入ります`,
        resolves: resolved,
      });
    }
  }

  // 3. 優先度3のタスクを翌日に回す
  if (input.tasks.some((task) => task.priority === 3 && task.status === 'pending')) {
    const resolved = resolvedBy(base, {
      ...input,
      tasks: input.tasks.filter((task) => task.priority !== 3),
    });
    if (resolved.length > 0) {
      relaxations.push({
        kind: 'defer-low-priority',
        message: `優先度「低」のタスクを翌日に回すと${quoteList(resolved)}が入ります`,
        resolves: resolved,
      });
    }
  }

  // 4. ルーティンの許可時間帯を広げる（置けなかったルーティンごとに個別に試す）
  for (const unplaced of base.unplacedRoutines) {
    const routine = input.routines.find((item) => item.id === unplaced.routineId);
    if (!routine) continue;

    const widened = placeEverything({
      ...input,
      routines: input.routines.map((item) =>
        item.id === routine.id
          ? { ...item, allowedWindows: [{ start: '00:00', end: '24:00' }] }
          : item,
      ),
    });

    const placedNow = widened.items.find(
      (item) => item.kind === 'routine' && item.refId === routine.id,
    );
    if (!placedNow) continue;

    const current = routine.allowedWindows
      .map((window) => `${window.start}–${window.end}`)
      .join('、');

    relaxations.push({
      kind: 'widen-routine',
      message: `「${routine.title}」の許可時間帯（${current}）を広げると ${placedNow.start} に置けます`,
      resolves: [routine.title],
    });
  }

  return relaxations;
}

/** 緩和した条件で組み直したとき、新たに置けるようになった項目のタイトル */
function resolvedBy(base: Placement, relaxed: PlanBuildInput): string[] {
  const after = placeEverything(relaxed);

  const stillUnplacedRoutines = new Set(after.unplacedRoutines.map((item) => item.routineId));
  const stillUnplacedTasks = new Set(after.unplacedTasks.map((item) => item.taskId));

  const resolved = [
    ...base.unplacedRoutines
      .filter((item) => !stillUnplacedRoutines.has(item.routineId))
      .map((item) => item.title),
    ...base.unplacedTasks
      .filter((item) => !stillUnplacedTasks.has(item.taskId))
      .map((item) => item.title),
  ];

  return resolved;
}

function workingRange(settings: AppSettings): Interval {
  const start = safeParse(settings.workStart, 0);
  let end = safeParse(settings.workEnd, MINUTES_PER_DAY);

  // 稼働終了が開始以前なら日跨ぎとみなし、当日の終わりまでとする
  if (end <= start) end = MINUTES_PER_DAY;

  return { start, end };
}

function safeParse(value: string, fallback: Minutes): Minutes {
  try {
    return parseTime(value);
  } catch {
    return fallback;
  }
}

function toIntervalSafely(item: PlanItem): Interval[] {
  try {
    return [{ start: parseTime(item.start), end: parseTime(item.end) }];
  } catch {
    return [];
  }
}

/** 固定済みのルーティンの回を placeRoutines に渡せる形にする */
function lockedRoutineOccurrences(locked: readonly PlanItem[]): PlacedRoutine[] {
  return locked.flatMap((item) => {
    if (item.kind !== 'routine' || !item.refId) return [];

    const interval = toIntervalSafely(item);
    if (interval.length === 0) return [];

    return [
      {
        routineId: item.refId,
        occurrence: item.occurrence ?? 1,
        start: interval[0].start,
        end: interval[0].end,
      },
    ];
  });
}

/** 表示順。最終比較キーに id 相当を含める（PLAN.md 3.3） */
function byStartThenKindThenRef(a: PlanItem, b: PlanItem): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.end !== b.end) return a.end < b.end ? -1 : 1;
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;

  const left = a.refId ?? '';
  const right = b.refId ?? '';
  if (left !== right) return left < right ? -1 : 1;

  return (a.occurrence ?? 0) - (b.occurrence ?? 0);
}

function quoteList(titles: readonly string[]): string {
  return titles.map((title) => `「${title}」`).join('、');
}

export { blockedIntervalsForDate } from './blocked';
export { insertBreaks } from './breaks';
export * from './intervals';
export * from './routines';
export * from './tasks';
export * from './time';
