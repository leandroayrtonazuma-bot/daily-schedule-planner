import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ALL_DAYS_OF_WEEK, ALL_MONTHS } from '@/lib/domain';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import {
  archiveRoutine,
  carryOverTasks,
  createBlockedWindow,
  createRoutine,
  createTask,
  deleteBlockedWindow,
  deleteTask,
  duplicateRoutine,
  getCarryoverPromptedOn,
  getPlan,
  getSettings,
  markCarryoverPrompted,
  listBlockedWindows,
  listRoutines,
  listSkippedRoutineIds,
  listTasks,
  savePlan,
  saveSettings,
  setRoutineSkipped,
  updateRoutine,
  updateTask,
} from '@/lib/store';

const USER = 'user-1';
const OTHER = 'user-2';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'schedule-store-'));
  process.env.SCHEDULE_DATA_FILE = join(directory, 'store.json');
});

afterAll(async () => {
  // このテストが自分で作った一時ディレクトリだけを消す
  if (directory) await rm(directory, { recursive: true, force: true });
});

const routineInput = {
  title: 'ランニング',
  durationMinutes: 30,
  timesPerDay: 1,
  minGapMinutes: 0,
  priority: 2 as const,
  daysOfWeek: ALL_DAYS_OF_WEEK,
  activeMonths: ALL_MONTHS,
  allowedWindows: [{ start: '05:00', end: '08:00' }],
  isActive: true,
};

const taskInput = {
  title: 'LP修正',
  estimatedMinutes: 60,
  priority: 2 as const,
  dueDate: null,
  source: 'manual' as const,
};

describe('設定', () => {
  it('保存前は既定値を返す', async () => {
    expect(await getSettings(USER)).toEqual(DEFAULT_SETTINGS);
  });

  it('保存した値を読み戻せる', async () => {
    await saveSettings(USER, { workStart: '06:00', workEnd: '23:00' });

    const settings = await getSettings(USER);
    expect(settings.workStart).toBe('06:00');
    expect(settings.workEnd).toBe('23:00');
  });

  it('指定しなかった項目は既定値のまま', async () => {
    await saveSettings(USER, { workStart: '06:00' });

    expect((await getSettings(USER)).breakAfterMinutes).toBe(DEFAULT_SETTINGS.breakAfterMinutes);
  });

  it('ユーザーごとに分かれている', async () => {
    await saveSettings(USER, { workStart: '06:00' });

    expect((await getSettings(OTHER)).workStart).toBe(DEFAULT_SETTINGS.workStart);
  });
});

describe('ブロック時間帯', () => {
  it('追加して一覧に出る', async () => {
    await createBlockedWindow(USER, {
      label: '通勤',
      startTime: '08:00',
      endTime: '09:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      specificDate: null,
    });

    const windows = await listBlockedWindows(USER);
    expect(windows).toHaveLength(1);
    expect(windows[0].label).toBe('通勤');
    expect(windows[0].userId).toBe(USER);
  });

  it('削除できる', async () => {
    const created = await createBlockedWindow(USER, {
      label: '通勤',
      startTime: '08:00',
      endTime: '09:00',
      daysOfWeek: [1],
      specificDate: null,
    });

    await deleteBlockedWindow(USER, created.id);

    expect(await listBlockedWindows(USER)).toEqual([]);
  });

  it('他人のブロックは消せない', async () => {
    const created = await createBlockedWindow(USER, {
      label: '通勤',
      startTime: '08:00',
      endTime: '09:00',
      daysOfWeek: [1],
      specificDate: null,
    });

    await deleteBlockedWindow(OTHER, created.id);

    expect(await listBlockedWindows(USER)).toHaveLength(1);
  });
});

describe('ルーティン', () => {
  it('追加して一覧に出る', async () => {
    await createRoutine(USER, routineInput);

    const routines = await listRoutines(USER);
    expect(routines.map((r) => r.title)).toEqual(['ランニング']);
  });

  it('編集できる', async () => {
    const created = await createRoutine(USER, routineInput);

    await updateRoutine(USER, created.id, { title: '筋トレ', durationMinutes: 45 });

    const routines = await listRoutines(USER);
    expect(routines[0].title).toBe('筋トレ');
    expect(routines[0].durationMinutes).toBe(45);
  });

  it('一時停止しても一覧には残る', async () => {
    const created = await createRoutine(USER, routineInput);

    await updateRoutine(USER, created.id, { isActive: false });

    const routines = await listRoutines(USER);
    expect(routines).toHaveLength(1);
    expect(routines[0].isActive).toBe(false);
  });

  it('削除は論理削除で、既定の一覧から消える', async () => {
    const created = await createRoutine(USER, routineInput);

    await archiveRoutine(USER, created.id);

    expect(await listRoutines(USER)).toEqual([]);
    expect(await listRoutines(USER, { includeArchived: true })).toHaveLength(1);
  });

  it('複製すると別 id の写しができる', async () => {
    const created = await createRoutine(USER, routineInput);

    const copy = await duplicateRoutine(USER, created.id);

    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(created.id);
    expect(copy?.title).toBe('ランニングのコピー');
    expect(copy?.allowedWindows).toEqual(routineInput.allowedWindows);
    expect(await listRoutines(USER)).toHaveLength(2);
  });

  it('作成順に並ぶ', async () => {
    await createRoutine(USER, { ...routineInput, title: '1つめ' });
    await createRoutine(USER, { ...routineInput, title: '2つめ' });

    expect((await listRoutines(USER)).map((r) => r.title)).toEqual(['1つめ', '2つめ']);
  });

  it('他人のルーティンは見えない', async () => {
    await createRoutine(USER, routineInput);

    expect(await listRoutines(OTHER)).toEqual([]);
  });
});

describe('タスク', () => {
  it('追加して一覧に出る', async () => {
    await createTask(USER, taskInput);

    const tasks = await listTasks(USER);
    expect(tasks[0]).toMatchObject({ title: 'LP修正', status: 'pending', carryoverCount: 0 });
  });

  it('完了にできる', async () => {
    const created = await createTask(USER, taskInput);

    await updateTask(USER, created.id, { status: 'done', actualMinutes: 75 });

    const tasks = await listTasks(USER);
    expect(tasks[0].status).toBe('done');
    expect(tasks[0].actualMinutes).toBe(75);
    expect(tasks[0].completedAt).not.toBeNull();
  });

  it('完了を取り消すと完了時刻も消える', async () => {
    const created = await createTask(USER, taskInput);
    await updateTask(USER, created.id, { status: 'done' });

    await updateTask(USER, created.id, { status: 'pending' });

    expect((await listTasks(USER))[0].completedAt).toBeNull();
  });

  it('削除できる', async () => {
    const created = await createTask(USER, taskInput);

    await deleteTask(USER, created.id);

    expect(await listTasks(USER)).toEqual([]);
  });

  it('未完了だけを絞り込める', async () => {
    const done = await createTask(USER, { ...taskInput, title: '済' });
    await createTask(USER, { ...taskInput, title: '未' });
    await updateTask(USER, done.id, { status: 'done' });

    const pending = await listTasks(USER, { status: 'pending' });
    expect(pending.map((t) => t.title)).toEqual(['未']);
  });
});

describe('計画', () => {
  it('保存前は null', async () => {
    expect(await getPlan(USER, '2026-08-21')).toBeNull();
  });

  it('保存して読み戻せる', async () => {
    const items = [
      { kind: 'task' as const, refId: 't1', start: '09:00', end: '10:00', pinned: false },
    ];

    await savePlan(USER, '2026-08-21', items);

    expect((await getPlan(USER, '2026-08-21'))?.items).toEqual(items);
  });

  it('同じ日に2回保存すると上書きされる', async () => {
    await savePlan(USER, '2026-08-21', []);
    await savePlan(USER, '2026-08-21', [
      { kind: 'break' as const, refId: null, start: '12:00', end: '12:15', pinned: false },
    ]);

    expect((await getPlan(USER, '2026-08-21'))?.items).toHaveLength(1);
  });

  it('日付ごとに分かれている', async () => {
    await savePlan(USER, '2026-08-21', []);

    expect(await getPlan(USER, '2026-08-22')).toBeNull();
  });
});

describe('ルーティンの当日スキップ', () => {
  it('スキップして戻せる', async () => {
    await setRoutineSkipped(USER, 'run', '2026-08-21', true);
    expect(await listSkippedRoutineIds(USER, '2026-08-21')).toEqual(['run']);

    await setRoutineSkipped(USER, 'run', '2026-08-21', false);
    expect(await listSkippedRoutineIds(USER, '2026-08-21')).toEqual([]);
  });

  it('二重にスキップしても増えない', async () => {
    await setRoutineSkipped(USER, 'run', '2026-08-21', true);
    await setRoutineSkipped(USER, 'run', '2026-08-21', true);

    expect(await listSkippedRoutineIds(USER, '2026-08-21')).toEqual(['run']);
  });

  it('別の日には影響しない', async () => {
    await setRoutineSkipped(USER, 'run', '2026-08-21', true);

    expect(await listSkippedRoutineIds(USER, '2026-08-22')).toEqual([]);
  });
});

describe('同時書き込み', () => {
  it('並行して追加しても消えない', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createTask(USER, { ...taskInput, title: `タスク${index}` }),
      ),
    );

    expect(await listTasks(USER)).toHaveLength(10);
  });
});

describe('繰り越し確認', () => {
  it('最初は未確認', async () => {
    expect(await getCarryoverPromptedOn(USER)).toBeNull();
  });

  it('確認済みにした日を覚える', async () => {
    await markCarryoverPrompted(USER, '2026-08-22');

    expect(await getCarryoverPromptedOn(USER)).toBe('2026-08-22');
  });

  it('ユーザーごとに独立している', async () => {
    await markCarryoverPrompted(USER, '2026-08-22');

    expect(await getCarryoverPromptedOn(OTHER)).toBeNull();
  });

  it('繰り越したタスクの carryoverCount が増える', async () => {
    const task = await createTask(USER, { title: 'a', estimatedMinutes: 30, priority: 2, dueDate: null, source: 'manual' });

    await carryOverTasks(USER, [task.id]);
    await carryOverTasks(USER, [task.id]);

    const [stored] = await listTasks(USER);
    expect(stored.carryoverCount).toBe(2);
  });

  it('選ばれなかったタスクは pending のまま、回数も増えない', async () => {
    const kept = await createTask(USER, { title: 'a', estimatedMinutes: 30, priority: 2, dueDate: null, source: 'manual' });
    const skipped = await createTask(USER, { title: 'b', estimatedMinutes: 30, priority: 2, dueDate: null, source: 'manual' });

    await carryOverTasks(USER, [kept.id]);

    const stored = await listTasks(USER);
    const other = stored.find((t) => t.id === skipped.id);
    expect(other?.status).toBe('pending');
    expect(other?.carryoverCount).toBe(0);
  });

  it('他人のタスクは動かせない', async () => {
    const task = await createTask(OTHER, { title: 'a', estimatedMinutes: 30, priority: 2, dueDate: null, source: 'manual' });

    await carryOverTasks(USER, [task.id]);

    const [stored] = await listTasks(OTHER);
    expect(stored.carryoverCount).toBe(0);
  });
});
