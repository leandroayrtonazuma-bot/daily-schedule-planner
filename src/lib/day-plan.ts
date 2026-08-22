import type { AppMode } from './app-mode';
import type { AppUser } from './auth';
import { getDayEvents, type DayEvents } from './calendar';
import { getDayRange, type DateString } from './calendar/day';
import type { NormalizedEvent } from './calendar/types';
import type { Priority, Routine, TaskStatus } from './domain';
import { blockedSpansForDate } from './planner/blocked';
import { buildPlan, type Relaxation } from './planner';
import type { Interval } from './planner/intervals';
import type { UnplacedRoutine } from './planner/routines';
import type { UnplacedTask } from './planner/tasks';
import { formatMinutes, parseTime, type Minutes } from './planner/time';
import type { AppSettings } from './settings';
import {
  getPlan,
  listBlockedWindows,
  listRoutines,
  listSkippedRoutineIds,
  listTasks,
  savePlan,
} from './store';

/** タイムラインに並ぶ1項目。時刻は当日 00:00 からの分 */
export type TimelineEntry = {
  /** 描画と操作の識別子。同じ日の中で一意 */
  key: string;
  kind: 'event' | 'blocked' | 'routine' | 'task' | 'break';
  title: string;
  start: Minutes;
  end: Minutes;
  pinned: boolean;
  refId: string | null;
  occurrence?: number;
  /** タスクのみ */
  status?: TaskStatus;
  priority?: Priority;
  actualMinutes?: number | null;
};

export type DayPlan = {
  date: DateString;
  timezone: string;
  mode: AppMode;
  workStart: Minutes;
  workEnd: Minutes;
  entries: TimelineEntry[];
  allDayEvents: NormalizedEvent[];
  unplacedRoutines: UnplacedRoutine[];
  unplacedTasks: UnplacedTask[];
  relaxations: Relaxation[];
  /** 停止・論理削除されていないルーティン。スキップの取り消しに使う */
  routines: Routine[];
  /** 今日だけ飛ばしたルーティン */
  skippedRoutineIds: string[];
  calendarUnavailable: boolean;
};

/**
 * 一日ぶんの表示データを組み立てる。
 *
 * 毎回 buildPlan を通し直す。決定論的なので同じ条件なら結果は変わらず、
 * タスクを足せばすぐ反映される。手で動かした項目（pinned）と完了済みの項目だけは
 * 固定として引き継ぐ。
 */
export async function loadDayPlan(params: {
  user: AppUser;
  mode: AppMode;
  settings: AppSettings;
  date: DateString;
  /** 「今から組み直す」用。これより前は触らない（PLAN.md 6.6） */
  fromMinutes?: Minutes | null;
}): Promise<DayPlan> {
  const { user, mode, settings, date } = params;
  const { dayStart } = getDayRange(date, settings.timezone);

  const [blockedWindows, routines, tasks, skippedRoutineIds, saved] = await Promise.all([
    listBlockedWindows(user.id),
    listRoutines(user.id),
    listTasks(user.id),
    listSkippedRoutineIds(user.id, date),
    getPlan(user.id, date),
  ]);

  let day: DayEvents | null = null;
  try {
    day = await getDayEvents({ mode, date, settings, accessToken: user.accessToken });
  } catch {
    // カレンダーが取れなくても、ルーティンとタスクだけで一日は組める
  }

  const busy: Interval[] = (day?.busy ?? []).map((interval) => ({
    start: toMinutes(interval.start, dayStart),
    end: toMinutes(interval.end, dayStart),
  }));

  const finishedTaskIds = new Set(
    tasks.filter((task) => task.status !== 'pending').map((task) => task.id),
  );

  const locked = (saved?.items ?? []).filter((item) => {
    if (item.pinned) return true;
    if (item.kind === 'task' && item.refId) return finishedTaskIds.has(item.refId);

    // 「今から組み直す」では、基準時刻までに終わっている項目も動かさない
    if (params.fromMinutes != null) {
      try {
        return parseTime(item.end) <= params.fromMinutes;
      } catch {
        return false;
      }
    }

    return false;
  });

  const plan = buildPlan({
    date,
    settings,
    busy,
    blockedWindows,
    routines,
    skippedRoutineIds,
    tasks,
    locked,
    fromMinutes: params.fromMinutes ?? null,
  });

  await savePlan(user.id, date, plan.items);

  const routineTitles = new Map(routines.map((routine) => [routine.id, routine.title]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const entries: TimelineEntry[] = [
    ...(day?.events ?? []).map(
      (event): TimelineEntry => ({
        key: `event:${event.id}`,
        kind: 'event',
        title: event.title,
        start: toMinutes(event.start, dayStart),
        end: toMinutes(event.end, dayStart),
        pinned: true,
        refId: event.id,
      }),
    ),
    ...blockedEntries(blockedWindows, date),
    ...plan.items.map((item): TimelineEntry => {
      const start = safeParse(item.start);
      const end = safeParse(item.end);
      const task = item.kind === 'task' && item.refId ? taskById.get(item.refId) : undefined;

      return {
        key: `${item.kind}:${item.refId ?? 'break'}:${item.start}`,
        kind: item.kind,
        title:
          item.kind === 'break'
            ? '休憩'
            : item.kind === 'routine'
              ? (routineTitles.get(item.refId ?? '') ?? '（削除されたルーティン）')
              : (task?.title ?? '（削除されたタスク）'),
        start,
        end,
        pinned: item.pinned,
        refId: item.refId,
        occurrence: item.occurrence,
        status: task?.status,
        priority: task?.priority,
        actualMinutes: task?.actualMinutes,
      };
    }),
  ].sort((a, b) => a.start - b.start || a.end - b.end || (a.key < b.key ? -1 : 1));

  return {
    date,
    timezone: settings.timezone,
    mode,
    workStart: safeParse(settings.workStart),
    workEnd: workEndOf(settings),
    entries,
    allDayEvents: day?.allDayEvents ?? [],
    unplacedRoutines: plan.unplacedRoutines,
    unplacedTasks: plan.unplacedTasks,
    relaxations: plan.relaxations,
    routines,
    skippedRoutineIds,
    calendarUnavailable: day === null,
  };
}

/** ブロック時間帯は名前を出したいので、マージせず1件ずつ並べる */
function blockedEntries(
  windows: Awaited<ReturnType<typeof listBlockedWindows>>,
  date: DateString,
): TimelineEntry[] {
  // 日跨ぎの扱いを配置アルゴリズムと揃える。ここで別々に計算すると
  // 「画面には出ていないのに空きが無い」といったずれが生まれる
  return blockedSpansForDate(windows, date).map((span) => ({
    key: `blocked:${span.window.id}:${span.interval.start}`,
    kind: 'blocked' as const,
    title: span.window.label,
    start: span.interval.start,
    end: span.interval.end,
    pinned: true,
    refId: span.window.id,
  }));
}

/** 絶対時刻を当日 00:00 からの分に直す */
function toMinutes(date: Date, dayStart: Date): Minutes {
  return Math.round((date.getTime() - dayStart.getTime()) / 60_000);
}

function safeParse(value: string): Minutes {
  try {
    return parseTime(value);
  } catch {
    return 0;
  }
}

function workEndOf(settings: AppSettings): Minutes {
  const start = safeParse(settings.workStart);
  const end = safeParse(settings.workEnd);

  return end > start ? end : 1440;
}

export { formatMinutes };
