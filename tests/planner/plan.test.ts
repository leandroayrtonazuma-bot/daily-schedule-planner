import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@/lib/domain';
import { buildPlan, type PlanBuildInput } from '@/lib/planner';
import { makeBlockedWindow, makeRoutine, makeSettings, makeTask } from '../helpers/factories';

// 2026-08-21 は金曜日
const FRIDAY = '2026-08-21';

function input(overrides: Partial<PlanBuildInput> = {}): PlanBuildInput {
  return {
    date: FRIDAY,
    settings: makeSettings({ workStart: '09:00', workEnd: '18:00', breakDurationMinutes: 0 }),
    busy: [],
    blockedWindows: [],
    routines: [],
    skippedRoutineIds: [],
    tasks: [],
    ...overrides,
  };
}

/** 見やすさのために 'HH:mm-HH:mm 種別:参照' に潰す */
function summarize(items: readonly PlanItem[]): string[] {
  return items.map((item) => `${item.start}-${item.end} ${item.kind}:${item.refId ?? '-'}`);
}

describe('buildPlan: 基本', () => {
  it('予定が無ければ稼働時間の先頭からタスクを詰める', () => {
    const result = buildPlan(
      input({ tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })] }),
    );

    expect(summarize(result.items)).toEqual(['09:00-10:00 task:t1']);
  });

  it('稼働時間の外には置かない', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({ workStart: '09:00', workEnd: '10:00' }),
        tasks: [makeTask({ id: 't1', estimatedMinutes: 120 })],
      }),
    );

    expect(result.items).toEqual([]);
    expect(result.unplacedTasks.map((t) => t.taskId)).toEqual(['t1']);
  });

  it('カレンダー予定の時間を避ける', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '09:00',
          workEnd: '18:00',
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
        }),
        busy: [{ start: 540, end: 660 }], // 9:00-11:00
        tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      }),
    );

    expect(summarize(result.items)).toEqual(['11:00-12:00 task:t1']);
  });

  it('予定の前後にバッファを取る', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '09:00',
          workEnd: '18:00',
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 10,
        }),
        busy: [{ start: 600, end: 660 }], // 10:00-11:00
        tasks: [makeTask({ id: 't1', estimatedMinutes: 30 })],
      }),
    );

    // 9:00-9:50 が空き（9:50 からバッファ）。30分タスクはそこに入る
    expect(summarize(result.items)).toEqual(['09:00-09:30 task:t1']);
  });

  it('ブロック時間帯を避ける', () => {
    const result = buildPlan(
      input({
        blockedWindows: [
          makeBlockedWindow({ id: 'lunch', startTime: '09:00', endTime: '12:00' }),
        ],
        tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      }),
    );

    expect(summarize(result.items)).toEqual(['12:00-13:00 task:t1']);
  });

  it('予定で一日が埋まっていれば何も置けない', () => {
    const result = buildPlan(
      input({
        busy: [{ start: 0, end: 1440 }],
        routines: [makeRoutine({ id: 'r1' })],
        tasks: [makeTask({ id: 't1' })],
      }),
    );

    expect(result.items).toEqual([]);
    expect(result.unplacedRoutines).toHaveLength(1);
    expect(result.unplacedTasks).toHaveLength(1);
  });
});

describe('buildPlan: ルーティンとタスクの順序', () => {
  it('ルーティンをタスクより先に置く', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({ workStart: '09:00', workEnd: '11:00' }),
        routines: [
          makeRoutine({
            id: 'run',
            durationMinutes: 60,
            allowedWindows: [{ start: '09:00', end: '11:00' }],
          }),
        ],
        tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      }),
    );

    expect(summarize(result.items)).toEqual(['09:00-10:00 routine:run', '10:00-11:00 task:t1']);
  });

  it('ルーティンの回数と occurrence を保存する', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({ workStart: '07:00', workEnd: '20:00' }),
        routines: [
          makeRoutine({
            id: 'meal',
            durationMinutes: 30,
            timesPerDay: 2,
            minGapMinutes: 240,
            allowedWindows: [{ start: '07:00', end: '20:00' }],
          }),
        ],
      }),
    );

    expect(result.items.map((item) => item.occurrence)).toEqual([1, 2]);
  });

  it('当日スキップしたルーティンは置かない', () => {
    const result = buildPlan(
      input({
        routines: [makeRoutine({ id: 'run', durationMinutes: 30 })],
        skippedRoutineIds: ['run'],
      }),
    );

    expect(result.items).toEqual([]);
    expect(result.unplacedRoutines).toEqual([]);
  });

  it('曜日の合わないルーティンは置かない', () => {
    const result = buildPlan(
      input({ routines: [makeRoutine({ id: 'sunday-only', daysOfWeek: [0] })] }),
    );

    expect(result.items).toEqual([]);
    expect(result.unplacedRoutines).toEqual([]);
  });

  it('許可時間帯が予定と完全に重なるルーティンは置けない', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '05:00',
          workEnd: '20:00',
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
        }),
        busy: [{ start: 300, end: 360 }], // 5:00-6:00
        routines: [
          makeRoutine({
            id: 'run',
            durationMinutes: 30,
            allowedWindows: [{ start: '05:00', end: '06:00' }],
          }),
        ],
      }),
    );

    expect(result.items).toEqual([]);
    expect(result.unplacedRoutines).toEqual([
      { routineId: 'run', title: 'run', placedCount: 0, requiredCount: 1 },
    ]);
  });

  it('最小間隔が厳しくて解が無ければ置けた回数だけ残す', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({ workStart: '09:00', workEnd: '13:00' }),
        routines: [
          makeRoutine({
            id: 'meal',
            durationMinutes: 30,
            timesPerDay: 3,
            minGapMinutes: 180,
            allowedWindows: [{ start: '09:00', end: '13:00' }],
          }),
        ],
      }),
    );

    expect(summarize(result.items)).toEqual([
      '09:00-09:30 routine:meal',
      '12:30-13:00 routine:meal',
    ]);
    expect(result.unplacedRoutines[0]).toMatchObject({ placedCount: 2, requiredCount: 3 });
  });
});

describe('buildPlan: Best-Fit', () => {
  it('大きいタスクの居場所を潰さない', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '09:00',
          workEnd: '13:30',
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          breakDurationMinutes: 0,
        }),
        // 9:00-12:00（180分）と 13:00-13:30（30分）の空きになる
        busy: [{ start: 720, end: 780 }],
        tasks: [
          makeTask({ id: 'small', estimatedMinutes: 30, priority: 1 }),
          makeTask({ id: 'large', estimatedMinutes: 180, priority: 2 }),
        ],
      }),
    );

    expect(summarize(result.items)).toEqual([
      '09:00-12:00 task:large',
      '13:00-13:30 task:small',
    ]);
    expect(result.unplacedTasks).toEqual([]);
  });
});

describe('buildPlan: 休憩', () => {
  it('連続作業が続いたら休憩を挟む', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '09:00',
          workEnd: '18:00',
          breakAfterMinutes: 90,
          breakDurationMinutes: 15,
        }),
        tasks: [makeTask({ id: 't1', estimatedMinutes: 120 })],
      }),
    );

    expect(summarize(result.items)).toEqual(['09:00-11:00 task:t1', '11:00-11:15 break:-']);
  });

  it('休憩を無効にできる', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({ breakDurationMinutes: 0 }),
        tasks: [makeTask({ id: 't1', estimatedMinutes: 120 })],
      }),
    );

    expect(result.items.every((item) => item.kind !== 'break')).toBe(true);
  });
});

describe('buildPlan: 決定性（PLAN.md 3.3）', () => {
  it('同じ入力を2回流すと同じ出力になる', () => {
    const params = input({
      settings: makeSettings({ workStart: '06:00', workEnd: '22:00' }),
      busy: [{ start: 780, end: 840 }],
      blockedWindows: [makeBlockedWindow({ id: 'bath', startTime: '20:00', endTime: '21:00' })],
      routines: [
        makeRoutine({ id: 'run', durationMinutes: 45, allowedWindows: [{ start: '06:00', end: '09:00' }] }),
        makeRoutine({ id: 'meal', durationMinutes: 30, timesPerDay: 3, minGapMinutes: 180 }),
      ],
      tasks: [
        makeTask({ id: 'a', estimatedMinutes: 90 }),
        makeTask({ id: 'b', estimatedMinutes: 45, priority: 1 }),
        makeTask({ id: 'c', estimatedMinutes: 120, dueDate: '2026-08-22' }),
      ],
    });

    expect(buildPlan(params).items).toEqual(buildPlan(params).items);
  });

  it('入力の並び順が違っても同じ出力になる', () => {
    const routines = [
      makeRoutine({ id: 'run', durationMinutes: 45, allowedWindows: [{ start: '06:00', end: '09:00' }] }),
      makeRoutine({ id: 'meal', durationMinutes: 30 }),
    ];
    const tasks = [
      makeTask({ id: 'a', estimatedMinutes: 90 }),
      makeTask({ id: 'b', estimatedMinutes: 45 }),
    ];
    const base = { settings: makeSettings({ workStart: '06:00', workEnd: '22:00' }) };

    const forward = buildPlan(input({ ...base, routines, tasks }));
    const reversed = buildPlan(
      input({ ...base, routines: [...routines].reverse(), tasks: [...tasks].reverse() }),
    );

    expect(reversed.items).toEqual(forward.items);
  });
});

describe('buildPlan: 再計算（PLAN.md 6.6）', () => {
  const locked: PlanItem[] = [
    { kind: 'task', refId: 'done-task', start: '09:00', end: '10:00', pinned: false },
  ];

  it('固定した項目はそのまま残る', () => {
    const result = buildPlan(input({ locked, tasks: [] }));

    expect(summarize(result.items)).toEqual(['09:00-10:00 task:done-task']);
  });

  it('固定した時間帯には新しい項目を置かない', () => {
    const result = buildPlan(
      input({ locked, tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })] }),
    );

    expect(summarize(result.items)).toEqual([
      '09:00-10:00 task:done-task',
      '10:00-11:00 task:t1',
    ]);
  });

  it('固定済みのタスクを二重に置かない', () => {
    const result = buildPlan(
      input({
        locked,
        tasks: [makeTask({ id: 'done-task', estimatedMinutes: 60 })],
      }),
    );

    expect(summarize(result.items)).toEqual(['09:00-10:00 task:done-task']);
  });

  it('基準時刻より前には何も置かない', () => {
    const result = buildPlan(
      input({
        fromMinutes: 840, // 14:00 から組み直す
        tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      }),
    );

    expect(summarize(result.items)).toEqual(['14:00-15:00 task:t1']);
  });

  it('組み直しても過去の項目は動かない', () => {
    const past: PlanItem[] = [
      { kind: 'routine', refId: 'run', start: '09:30', end: '10:00', pinned: false, occurrence: 1 },
    ];

    const result = buildPlan(
      input({
        fromMinutes: 660, // 11:00
        locked: past,
        tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      }),
    );

    expect(summarize(result.items)).toEqual([
      '09:30-10:00 routine:run',
      '11:00-12:00 task:t1',
    ]);
  });
});

describe('buildPlan: 緩和案（PLAN.md 6.4）', () => {
  it('バッファを詰めれば入るときは、そう提案する', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '09:00',
          workEnd: '11:00',
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 10,
          breakDurationMinutes: 0,
        }),
        busy: [{ start: 600, end: 630 }], // 10:00-10:30
        // バッファ込みだと 9:00-9:50 と 10:40-11:00。55分タスクは入らない
        tasks: [makeTask({ id: 't1', title: '資料作成', estimatedMinutes: 55 })],
      }),
    );

    expect(result.unplacedTasks).toHaveLength(1);

    const buffer = result.relaxations.find((r) => r.kind === 'buffer');
    expect(buffer).toBeDefined();
    expect(buffer?.resolves).toEqual(['資料作成']);
  });

  it('許可時間帯を広げれば入るルーティンには、そう提案する', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '05:00',
          workEnd: '20:00',
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
        }),
        busy: [{ start: 300, end: 360 }], // 5:00-6:00
        routines: [
          makeRoutine({
            id: 'run',
            title: 'ランニング',
            durationMinutes: 30,
            allowedWindows: [{ start: '05:00', end: '06:00' }],
          }),
        ],
      }),
    );

    const widen = result.relaxations.find((r) => r.kind === 'widen-routine');
    expect(widen?.resolves).toEqual(['ランニング']);
    expect(widen?.message).toContain('ランニング');
  });

  it('優先度3のタスクを翌日に回せば入るときは、そう提案する', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({
          workStart: '09:00',
          workEnd: '11:00',
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          breakDurationMinutes: 0,
        }),
        tasks: [
          // 締切が近いぶん先に置かれてしまい、大事なタスクの居場所を奪う
          makeTask({
            id: 'low',
            title: '後回し',
            estimatedMinutes: 60,
            priority: 3,
            dueDate: FRIDAY,
          }),
          makeTask({ id: 'high', title: '大事な仕事', estimatedMinutes: 120, priority: 1 }),
        ],
      }),
    );

    const defer = result.relaxations.find((r) => r.kind === 'defer-low-priority');
    expect(defer?.resolves).toEqual(['大事な仕事']);
  });

  it('全部置けたときは緩和案を出さない', () => {
    const result = buildPlan(input({ tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })] }));

    expect(result.relaxations).toEqual([]);
  });

  it('緩和しても入らないものについては提案しない', () => {
    const result = buildPlan(
      input({
        settings: makeSettings({ workStart: '09:00', workEnd: '10:00' }),
        tasks: [makeTask({ id: 'huge', estimatedMinutes: 600 })],
      }),
    );

    expect(result.relaxations).toEqual([]);
  });
});
