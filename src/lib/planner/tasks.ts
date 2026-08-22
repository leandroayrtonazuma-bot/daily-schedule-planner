import type { Task } from '@/lib/domain';
import { normalizeIntervals, subtractIntervals, type Interval } from './intervals';
import type { Minutes } from './time';

export type PlacedTask = {
  taskId: string;
  start: Minutes;
  end: Minutes;
};

export type UnplacedTask = {
  taskId: string;
  title: string;
  /** 見積係数を掛けたあとの所要時間 */
  neededMinutes: number;
  /** そのとき残っていた最大の空き。緩和案の提示に使う */
  largestFreeMinutes: number;
};

export type TaskPlacement = {
  placed: PlacedTask[];
  free: Interval[];
  unplaced: UnplacedTask[];
};

/**
 * 配置順（PLAN.md 6.3）。
 *
 * 1. due_date 昇順（null は最後）
 * 2. priority 昇順
 * 3. estimated_minutes 降順（大きいタスクを先に置く）
 * 4. id 昇順（決定性）
 *
 * status が pending でないタスクは配置対象外なので取り除く。
 */
export function sortTasksForPlacement(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((task) => task.status === 'pending')
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) {
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
      }

      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.estimatedMinutes !== b.estimatedMinutes) return b.estimatedMinutes - a.estimatedMinutes;

      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/**
 * タスクを空きに配置する（PLAN.md 6.3）。
 *
 * Best-Fit：収まる空きのうち最も小さいものを選ぶ。
 * こうすると大きな空きが温存され、長時間タスクの居場所が残る。
 */
export function placeTasks(params: {
  tasks: readonly Task[];
  free: readonly Interval[];
  estimateFactor: number;
}): TaskPlacement {
  let free = normalizeIntervals(params.free);

  const placed: PlacedTask[] = [];
  const unplaced: UnplacedTask[] = [];

  for (const task of sortTasksForPlacement(params.tasks)) {
    const needed = neededMinutesFor(task, params.estimateFactor);
    const block = findBestFit(free, needed);

    if (!block) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        neededMinutes: needed,
        largestFreeMinutes: largestFree(free),
      });
      continue;
    }

    const slot = { start: block.start, end: block.start + needed };
    placed.push({ taskId: task.id, start: slot.start, end: slot.end });
    free = subtractIntervals(free, [slot]);
  }

  return { placed, free, unplaced };
}

/** 見積に estimate_factor を掛けた実際に確保する時間（PLAN.md 6.3） */
export function neededMinutesFor(task: Task, estimateFactor: number): number {
  return Math.max(1, Math.round(task.estimatedMinutes * estimateFactor));
}

/** 収まる中で最小の空き。同じ大きさなら早い方（free は開始順に並んでいる） */
function findBestFit(free: readonly Interval[], needed: number): Interval | null {
  let best: Interval | null = null;
  let bestLength = Infinity;

  for (const interval of free) {
    const length = interval.end - interval.start;
    if (length < needed) continue;

    if (length < bestLength) {
      best = interval;
      bestLength = length;
    }
  }

  return best;
}

function largestFree(free: readonly Interval[]): number {
  return free.reduce((max, interval) => Math.max(max, interval.end - interval.start), 0);
}
