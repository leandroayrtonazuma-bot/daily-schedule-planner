import type { DateString } from '@/lib/calendar/day';
import type {
  BlockedWindow,
  Plan,
  PlanItem,
  Routine,
  Task,
  TaskStatus,
} from '@/lib/domain';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/settings';
import { readOnly, userData, withDatabase } from './file-db';

/**
 * ユーザーデータの読み書き。画面と Server Actions はここだけを呼ぶ。
 * 保存先を Supabase に移すときも、このファイルの外側は変えなくて済む。
 */

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

export async function getSettings(userId: string): Promise<AppSettings> {
  const stored = await readOnly((db) => db.users[userId]?.settings ?? {});

  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(
  userId: string,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  return withDatabase((db) => {
    const data = userData(db, userId);
    data.settings = { ...data.settings, ...patch };

    return { ...DEFAULT_SETTINGS, ...data.settings };
  });
}

// ---------------------------------------------------------------------------
// ブロック時間帯
// ---------------------------------------------------------------------------

export type BlockedWindowInput = Omit<BlockedWindow, 'id' | 'userId' | 'createdAt'>;

export async function listBlockedWindows(userId: string): Promise<BlockedWindow[]> {
  return readOnly((db) => [...(db.users[userId]?.blockedWindows ?? [])]);
}

export async function createBlockedWindow(
  userId: string,
  input: BlockedWindowInput,
): Promise<BlockedWindow> {
  return withDatabase((db) => {
    const created: BlockedWindow = {
      ...input,
      id: newId(),
      userId,
      createdAt: new Date().toISOString(),
    };

    userData(db, userId).blockedWindows.push(created);

    return created;
  });
}

export async function updateBlockedWindow(
  userId: string,
  id: string,
  patch: Partial<BlockedWindowInput>,
): Promise<void> {
  await withDatabase((db) => {
    const target = findOwned(userData(db, userId).blockedWindows, userId, id);
    if (target) Object.assign(target, patch);
  });
}

export async function deleteBlockedWindow(userId: string, id: string): Promise<void> {
  await withDatabase((db) => {
    const data = userData(db, userId);
    data.blockedWindows = data.blockedWindows.filter(
      (window) => !(window.id === id && window.userId === userId),
    );
  });
}

// ---------------------------------------------------------------------------
// ルーティン
// ---------------------------------------------------------------------------

export type RoutineInput = Omit<Routine, 'id' | 'userId' | 'createdAt' | 'archivedAt'>;

export async function listRoutines(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Routine[]> {
  return readOnly((db) => {
    const all = db.users[userId]?.routines ?? [];

    return options.includeArchived ? [...all] : all.filter((routine) => !routine.archivedAt);
  });
}

export async function getRoutine(userId: string, id: string): Promise<Routine | null> {
  return readOnly((db) => findOwned(db.users[userId]?.routines ?? [], userId, id) ?? null);
}

export async function createRoutine(userId: string, input: RoutineInput): Promise<Routine> {
  return withDatabase((db) => {
    const created: Routine = {
      ...input,
      id: newId(),
      userId,
      archivedAt: null,
      createdAt: new Date().toISOString(),
    };

    userData(db, userId).routines.push(created);

    return created;
  });
}

export async function updateRoutine(
  userId: string,
  id: string,
  patch: Partial<RoutineInput>,
): Promise<void> {
  await withDatabase((db) => {
    const target = findOwned(userData(db, userId).routines, userId, id);
    if (target) Object.assign(target, patch);
  });
}

/** 論理削除。過去の plans が参照している可能性があるので行は残す（PLAN.md 7.4） */
export async function archiveRoutine(userId: string, id: string): Promise<void> {
  await withDatabase((db) => {
    const target = findOwned(userData(db, userId).routines, userId, id);
    if (target) target.archivedAt = new Date().toISOString();
  });
}

export async function duplicateRoutine(userId: string, id: string): Promise<Routine | null> {
  return withDatabase((db) => {
    const data = userData(db, userId);
    const source = findOwned(data.routines, userId, id);
    if (!source) return null;

    const copy: Routine = {
      ...structuredClone(source),
      id: newId(),
      title: `${source.title}のコピー`,
      archivedAt: null,
      createdAt: new Date().toISOString(),
    };

    data.routines.push(copy);

    return copy;
  });
}

// ---------------------------------------------------------------------------
// タスク
// ---------------------------------------------------------------------------

export type TaskInput = Pick<
  Task,
  'title' | 'estimatedMinutes' | 'priority' | 'dueDate' | 'source'
>;

export type TaskPatch = Partial<
  Pick<
    Task,
    'title' | 'estimatedMinutes' | 'priority' | 'dueDate' | 'status' | 'actualMinutes' | 'carryoverCount'
  >
>;

export async function listTasks(
  userId: string,
  options: { status?: TaskStatus } = {},
): Promise<Task[]> {
  return readOnly((db) => {
    const all = db.users[userId]?.tasks ?? [];

    return options.status ? all.filter((task) => task.status === options.status) : [...all];
  });
}

export async function createTask(userId: string, input: TaskInput): Promise<Task> {
  return withDatabase((db) => {
    const created: Task = {
      ...input,
      id: newId(),
      userId,
      actualMinutes: null,
      status: 'pending',
      carryoverCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    userData(db, userId).tasks.push(created);

    return created;
  });
}

export async function updateTask(userId: string, id: string, patch: TaskPatch): Promise<void> {
  await withDatabase((db) => {
    const target = findOwned(userData(db, userId).tasks, userId, id);
    if (!target) return;

    Object.assign(target, patch);

    // 完了時刻は status に追従させる。取り消したら消す
    if (patch.status === 'done') target.completedAt ??= new Date().toISOString();
    if (patch.status && patch.status !== 'done') target.completedAt = null;
  });
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  await withDatabase((db) => {
    const data = userData(db, userId);
    data.tasks = data.tasks.filter((task) => !(task.id === id && task.userId === userId));
  });
}

/**
 * 繰り越し確認（PLAN.md 7.2）。
 * ダイアログを出した日を覚えておき、同じ日に二度出さないようにする。
 */
export async function getCarryoverPromptedOn(userId: string): Promise<DateString | null> {
  return readOnly((db) => db.users[userId]?.carryoverPromptedOn ?? null);
}

export async function markCarryoverPrompted(userId: string, date: DateString): Promise<void> {
  await withDatabase((db) => {
    userData(db, userId).carryoverPromptedOn = date;
  });
}

/** 選ばれたタスクの繰り越し回数を +1 する。選ばれなかったものには触らない */
export async function carryOverTasks(userId: string, taskIds: readonly string[]): Promise<void> {
  if (taskIds.length === 0) return;

  await withDatabase((db) => {
    for (const task of userData(db, userId).tasks) {
      if (task.userId !== userId) continue;
      if (!taskIds.includes(task.id)) continue;

      task.carryoverCount += 1;
    }
  });
}

// ---------------------------------------------------------------------------
// 計画
// ---------------------------------------------------------------------------

export async function getPlan(userId: string, date: DateString): Promise<Plan | null> {
  return readOnly(
    (db) => (db.users[userId]?.plans ?? []).find((plan) => plan.planDate === date) ?? null,
  );
}

export async function savePlan(
  userId: string,
  date: DateString,
  items: readonly PlanItem[],
): Promise<Plan> {
  return withDatabase((db) => {
    const data = userData(db, userId);
    const saved: Plan = {
      id: data.plans.find((plan) => plan.planDate === date)?.id ?? newId(),
      userId,
      planDate: date,
      generatedAt: new Date().toISOString(),
      items: [...items],
    };

    data.plans = [...data.plans.filter((plan) => plan.planDate !== date), saved];

    return saved;
  });
}

export async function deletePlan(userId: string, date: DateString): Promise<void> {
  await withDatabase((db) => {
    const data = userData(db, userId);
    data.plans = data.plans.filter((plan) => plan.planDate !== date);
  });
}

// ---------------------------------------------------------------------------
// ルーティンの当日スキップ
// ---------------------------------------------------------------------------

export async function listSkippedRoutineIds(
  userId: string,
  date: DateString,
): Promise<string[]> {
  return readOnly((db) =>
    (db.users[userId]?.routineSkips ?? [])
      .filter((skip) => skip.skipDate === date)
      .map((skip) => skip.routineId),
  );
}

export async function setRoutineSkipped(
  userId: string,
  routineId: string,
  date: DateString,
  skipped: boolean,
): Promise<void> {
  await withDatabase((db) => {
    const data = userData(db, userId);
    const rest = data.routineSkips.filter(
      (skip) => !(skip.routineId === routineId && skip.skipDate === date),
    );

    data.routineSkips = skipped
      ? [...rest, { id: newId(), userId, routineId, skipDate: date }]
      : rest;
  });
}

// ---------------------------------------------------------------------------

function findOwned<T extends { id: string; userId: string }>(
  rows: readonly T[],
  userId: string,
  id: string,
): T | undefined {
  return rows.find((row) => row.id === id && row.userId === userId);
}

function newId(): string {
  return crypto.randomUUID();
}
