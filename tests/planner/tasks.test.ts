import { describe, expect, it } from 'vitest';
import { placeTasks, sortTasksForPlacement } from '@/lib/planner/tasks';
import { makeTask } from '../helpers/factories';

describe('sortTasksForPlacement', () => {
  it('締切が近い順', () => {
    const later = makeTask({ id: 'later', dueDate: '2026-09-01' });
    const sooner = makeTask({ id: 'sooner', dueDate: '2026-08-22' });

    expect(sortTasksForPlacement([later, sooner]).map((t) => t.id)).toEqual(['sooner', 'later']);
  });

  it('締切なしは最後', () => {
    const noDue = makeTask({ id: 'a-none', dueDate: null });
    const withDue = makeTask({ id: 'b-due', dueDate: '2026-12-31' });

    expect(sortTasksForPlacement([noDue, withDue]).map((t) => t.id)).toEqual(['b-due', 'a-none']);
  });

  it('締切が同じなら優先度の高い順', () => {
    const low = makeTask({ id: 'a-low', priority: 3 });
    const high = makeTask({ id: 'b-high', priority: 1 });

    expect(sortTasksForPlacement([low, high]).map((t) => t.id)).toEqual(['b-high', 'a-low']);
  });

  it('優先度も同じなら見積の大きい順（大きいタスクを先に置く）', () => {
    const small = makeTask({ id: 'a-small', estimatedMinutes: 30 });
    const large = makeTask({ id: 'b-large', estimatedMinutes: 120 });

    expect(sortTasksForPlacement([small, large]).map((t) => t.id)).toEqual(['b-large', 'a-small']);
  });

  it('すべて同点なら id 昇順（決定性のため）', () => {
    const second = makeTask({ id: 't2' });
    const first = makeTask({ id: 't1' });

    expect(sortTasksForPlacement([second, first]).map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('完了済み・見送りのタスクは対象外', () => {
    const tasks = [
      makeTask({ id: 'done', status: 'done' }),
      makeTask({ id: 'skipped', status: 'skipped' }),
      makeTask({ id: 'pending', status: 'pending' }),
    ];

    expect(sortTasksForPlacement(tasks).map((t) => t.id)).toEqual(['pending']);
  });

  it('入力の配列を書き換えない', () => {
    const input = [makeTask({ id: 't2' }), makeTask({ id: 't1' })];
    sortTasksForPlacement(input);
    expect(input.map((t) => t.id)).toEqual(['t2', 't1']);
  });
});

describe('placeTasks', () => {
  it('空きブロックの先頭から詰める', () => {
    const result = placeTasks({
      tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      free: [{ start: 540, end: 720 }],
      estimateFactor: 1,
    });

    expect(result.placed).toEqual([{ taskId: 't1', start: 540, end: 600 }]);
    expect(result.free).toEqual([{ start: 600, end: 720 }]);
  });

  it('収まる中で最も小さいブロックを選ぶ（Best-Fit）', () => {
    const result = placeTasks({
      tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      free: [
        { start: 0, end: 180 }, // 180分
        { start: 300, end: 360 }, // 60分。ぴったり
      ],
      estimateFactor: 1,
    });

    expect(result.placed).toEqual([{ taskId: 't1', start: 300, end: 360 }]);
  });

  it('Best-Fit のおかげで大きいタスクの居場所が残る', () => {
    const result = placeTasks({
      tasks: [
        makeTask({ id: 'small', estimatedMinutes: 30, priority: 1 }),
        makeTask({ id: 'large', estimatedMinutes: 180, priority: 2 }),
      ],
      free: [
        { start: 0, end: 180 }, // 大きいタスク用に温存されるべき
        { start: 300, end: 330 }, // 30分
      ],
      estimateFactor: 1,
    });

    expect(result.placed).toEqual([
      { taskId: 'small', start: 300, end: 330 },
      { taskId: 'large', start: 0, end: 180 },
    ]);
    expect(result.unplaced).toEqual([]);
  });

  it('同じ大きさのブロックが複数あれば早い方を選ぶ', () => {
    const result = placeTasks({
      tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      free: [
        { start: 600, end: 660 },
        { start: 300, end: 360 },
      ],
      estimateFactor: 1,
    });

    expect(result.placed).toEqual([{ taskId: 't1', start: 300, end: 360 }]);
  });

  it('見積係数を掛けた時間で場所を取る', () => {
    const result = placeTasks({
      tasks: [makeTask({ id: 't1', estimatedMinutes: 60 })],
      free: [{ start: 0, end: 200 }],
      estimateFactor: 1.5,
    });

    expect(result.placed).toEqual([{ taskId: 't1', start: 0, end: 90 }]);
  });

  it('どこにも入らないタスクは報告する', () => {
    const result = placeTasks({
      tasks: [makeTask({ id: 'big', title: '大仕事', estimatedMinutes: 300 })],
      free: [{ start: 0, end: 60 }],
      estimateFactor: 1,
    });

    expect(result.placed).toEqual([]);
    expect(result.unplaced).toEqual([
      { taskId: 'big', title: '大仕事', neededMinutes: 300, largestFreeMinutes: 60 },
    ]);
  });

  it('空きが全く無ければ最大の空きは0', () => {
    const result = placeTasks({
      tasks: [makeTask({ id: 't1', estimatedMinutes: 30 })],
      free: [],
      estimateFactor: 1,
    });

    expect(result.unplaced[0].largestFreeMinutes).toBe(0);
  });

  it('タスクが無くても落ちない', () => {
    const result = placeTasks({ tasks: [], free: [{ start: 0, end: 60 }], estimateFactor: 1 });

    expect(result.placed).toEqual([]);
    expect(result.free).toEqual([{ start: 0, end: 60 }]);
  });

  it('同じ入力なら同じ結果になる（決定性）', () => {
    const tasks = [
      makeTask({ id: 'b', estimatedMinutes: 60 }),
      makeTask({ id: 'a', estimatedMinutes: 60 }),
      makeTask({ id: 'c', estimatedMinutes: 60 }),
    ];
    const free = [
      { start: 0, end: 120 },
      { start: 300, end: 420 },
    ];

    const first = placeTasks({ tasks, free, estimateFactor: 1 });
    const second = placeTasks({ tasks: [...tasks].reverse(), free, estimateFactor: 1 });

    expect(second.placed).toEqual(first.placed);
  });
});
