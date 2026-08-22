import { describe, expect, it } from 'vitest';
import {
  blockedWindowInputToRow,
  blockedWindowPatchToRow,
  routineInputToRow,
  routinePatchToRow,
  rowToBlockedWindow,
  rowToPlan,
  rowToRoutine,
  rowToRoutineSkip,
  rowToSettings,
  rowToTask,
  settingsPatchToRow,
  taskInputToRow,
  taskPatchToRow,
} from '@/lib/store/rows';

describe('rowToSettings', () => {
  it('スネークケースの行をキャメルケースの設定に変える', () => {
    const row = {
      work_start: '09:00:00',
      work_end: '22:00:00',
      buffer_before_minutes: 10,
      buffer_after_minutes: 10,
      break_after_minutes: 90,
      break_duration_minutes: 15,
      calendar_id: 'primary',
      include_all_day: false,
      ask_carryover: true,
      estimate_factor: 1.2,
      timezone: 'Asia/Tokyo',
      carryover_prompted_on: null,
    };

    expect(rowToSettings(row)).toEqual({
      workStart: '09:00',
      workEnd: '22:00',
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      breakAfterMinutes: 90,
      breakDurationMinutes: 15,
      calendarId: 'primary',
      includeAllDay: false,
      askCarryover: true,
      estimateFactor: 1.2,
      timezone: 'Asia/Tokyo',
    });
  });

  it('time 列が既に HH:mm でも読める', () => {
    const row = {
      work_start: '09:00',
      work_end: '22:00',
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      break_after_minutes: 90,
      break_duration_minutes: 0,
      calendar_id: 'primary',
      include_all_day: false,
      ask_carryover: true,
      estimate_factor: 1,
      timezone: 'Asia/Tokyo',
      carryover_prompted_on: null,
    };

    expect(rowToSettings(row).workStart).toBe('09:00');
  });
});

describe('settingsPatchToRow', () => {
  it('指定したキーだけをスネークケースに変える', () => {
    expect(settingsPatchToRow({ workStart: '10:00', estimateFactor: 1.5 })).toEqual({
      work_start: '10:00',
      estimate_factor: 1.5,
    });
  });

  it('空のパッチは空オブジェクト', () => {
    expect(settingsPatchToRow({})).toEqual({});
  });

  it('全フィールドを網羅している', () => {
    const full = {
      workStart: '09:00',
      workEnd: '22:00',
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      breakAfterMinutes: 90,
      breakDurationMinutes: 15,
      calendarId: 'primary',
      includeAllDay: false,
      askCarryover: true,
      estimateFactor: 1,
      timezone: 'Asia/Tokyo',
    };

    expect(Object.keys(settingsPatchToRow(full))).toEqual([
      'work_start',
      'work_end',
      'buffer_before_minutes',
      'buffer_after_minutes',
      'break_after_minutes',
      'break_duration_minutes',
      'calendar_id',
      'include_all_day',
      'ask_carryover',
      'estimate_factor',
      'timezone',
    ]);
  });
});

describe('rowToBlockedWindow / blockedWindowInputToRow', () => {
  const row = {
    id: 'w1',
    user_id: 'u1',
    label: '睡眠',
    start_time: '23:00:00',
    end_time: '07:00:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    specific_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('行をキャメルケースへ', () => {
    expect(rowToBlockedWindow(row)).toEqual({
      id: 'w1',
      userId: 'u1',
      label: '睡眠',
      startTime: '23:00',
      endTime: '07:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      specificDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('specific_date が入っている行も読める', () => {
    expect(rowToBlockedWindow({ ...row, specific_date: '2026-08-22' }).specificDate).toBe(
      '2026-08-22',
    );
  });

  it('入力を挿入用の行に変える', () => {
    expect(
      blockedWindowInputToRow('u1', {
        label: '睡眠',
        startTime: '23:00',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        specificDate: null,
      }),
    ).toEqual({
      user_id: 'u1',
      label: '睡眠',
      start_time: '23:00',
      end_time: '07:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      specific_date: null,
    });
  });
});

describe('rowToRoutine / routineInputToRow', () => {
  const row = {
    id: 'r1',
    user_id: 'u1',
    title: 'ランニング',
    duration_minutes: 30,
    times_per_day: 1,
    min_gap_minutes: 0,
    priority: 2,
    days_of_week: [1, 2, 3, 4, 5],
    active_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    allowed_windows: [{ start: '05:00', end: '08:00' }],
    is_active: true,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('行をキャメルケースへ', () => {
    expect(rowToRoutine(row)).toEqual({
      id: 'r1',
      userId: 'u1',
      title: 'ランニング',
      durationMinutes: 30,
      timesPerDay: 1,
      minGapMinutes: 0,
      priority: 2,
      daysOfWeek: [1, 2, 3, 4, 5],
      activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      allowedWindows: [{ start: '05:00', end: '08:00' }],
      isActive: true,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('archived_at が入っている行も読める', () => {
    const archived = { ...row, archived_at: '2026-02-01T00:00:00.000Z' };
    expect(rowToRoutine(archived).archivedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('入力を挿入用の行に変える', () => {
    expect(
      routineInputToRow('u1', {
        title: 'ランニング',
        durationMinutes: 30,
        timesPerDay: 1,
        minGapMinutes: 0,
        priority: 2,
        daysOfWeek: [1, 2, 3, 4, 5],
        activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        allowedWindows: [{ start: '05:00', end: '08:00' }],
        isActive: true,
      }),
    ).toEqual({
      user_id: 'u1',
      title: 'ランニング',
      duration_minutes: 30,
      times_per_day: 1,
      min_gap_minutes: 0,
      priority: 2,
      days_of_week: [1, 2, 3, 4, 5],
      active_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      allowed_windows: [{ start: '05:00', end: '08:00' }],
      is_active: true,
    });
  });
});

describe('rowToTask / taskInputToRow', () => {
  const row = {
    id: 't1',
    user_id: 'u1',
    title: '提案書',
    estimated_minutes: 60,
    actual_minutes: null,
    priority: 2,
    due_date: null,
    status: 'pending',
    carryover_count: 0,
    source: 'manual',
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
  };

  it('行をキャメルケースへ', () => {
    expect(rowToTask(row)).toEqual({
      id: 't1',
      userId: 'u1',
      title: '提案書',
      estimatedMinutes: 60,
      actualMinutes: null,
      priority: 2,
      dueDate: null,
      status: 'pending',
      carryoverCount: 0,
      source: 'manual',
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
    });
  });

  it('実測・締切・完了時刻が入っている行も読める', () => {
    const done = {
      ...row,
      actual_minutes: 90,
      due_date: '2026-08-24',
      status: 'done',
      completed_at: '2026-08-20T00:00:00.000Z',
    };

    const task = rowToTask(done);
    expect(task.actualMinutes).toBe(90);
    expect(task.dueDate).toBe('2026-08-24');
    expect(task.status).toBe('done');
    expect(task.completedAt).toBe('2026-08-20T00:00:00.000Z');
  });

  it('入力を挿入用の行に変える', () => {
    expect(
      taskInputToRow('u1', {
        title: '提案書',
        estimatedMinutes: 60,
        priority: 2,
        dueDate: null,
        source: 'manual',
      }),
    ).toEqual({
      user_id: 'u1',
      title: '提案書',
      estimated_minutes: 60,
      priority: 2,
      due_date: null,
      source: 'manual',
    });
  });
});

describe('rowToPlan', () => {
  it('行をキャメルケースへ', () => {
    const row = {
      id: 'p1',
      user_id: 'u1',
      plan_date: '2026-08-22',
      generated_at: '2026-08-22T00:00:00.000Z',
      items: [{ kind: 'task' as const, refId: 't1', start: '09:00', end: '10:00', pinned: false }],
    };

    expect(rowToPlan(row)).toEqual({
      id: 'p1',
      userId: 'u1',
      planDate: '2026-08-22',
      generatedAt: '2026-08-22T00:00:00.000Z',
      items: [{ kind: 'task' as const, refId: 't1', start: '09:00', end: '10:00', pinned: false }],
    });
  });
});

describe('rowToRoutineSkip', () => {
  it('行をキャメルケースへ', () => {
    const row = { id: 's1', user_id: 'u1', routine_id: 'r1', skip_date: '2026-08-22' };

    expect(rowToRoutineSkip(row)).toEqual({
      id: 's1',
      userId: 'u1',
      routineId: 'r1',
      skipDate: '2026-08-22',
    });
  });
});

describe('blockedWindowPatchToRow', () => {
  it('指定したキーだけをスネークケースに変える', () => {
    expect(blockedWindowPatchToRow({ label: '入浴' })).toEqual({ label: '入浴' });
  });

  it('空のパッチは空オブジェクト', () => {
    expect(blockedWindowPatchToRow({})).toEqual({});
  });
});

describe('routinePatchToRow', () => {
  it('指定したキーだけをスネークケースに変える', () => {
    expect(routinePatchToRow({ isActive: false, priority: 1 })).toEqual({
      is_active: false,
      priority: 1,
    });
  });

  it('空のパッチは空オブジェクト', () => {
    expect(routinePatchToRow({})).toEqual({});
  });
});

describe('taskPatchToRow', () => {
  it('指定したキーだけをスネークケースに変える', () => {
    expect(taskPatchToRow({ status: 'done', actualMinutes: 45 })).toEqual({
      status: 'done',
      actual_minutes: 45,
    });
  });

  it('空のパッチは空オブジェクト', () => {
    expect(taskPatchToRow({})).toEqual({});
  });
});
