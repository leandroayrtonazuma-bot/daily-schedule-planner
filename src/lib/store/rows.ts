import type { BlockedWindow, Plan, Routine, RoutineSkip, Task } from '@/lib/domain';
import type { AppSettings } from '@/lib/settings';
import type { BlockedWindowInput, RoutineInput, TaskInput, TaskPatch } from './types';

/**
 * Supabase の行（スネークケース）とアプリ内の型（キャメルケース）の変換。
 *
 * すべて純粋関数にしてある。Supabase クライアントを呼ぶコード（supabase-store.ts）は
 * ここを通すだけにして、テストできるロジックをそこに残さない。
 *
 * time 型の列は Postgres が 'HH:MM:SS' で返すことがあるため、先頭5文字に切り詰める。
 */

type SettingsRow = {
  work_start: string;
  work_end: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  break_after_minutes: number;
  break_duration_minutes: number;
  calendar_id: string;
  include_all_day: boolean;
  ask_carryover: boolean;
  estimate_factor: number;
  timezone: string;
};

export function rowToSettings(row: SettingsRow): AppSettings {
  return {
    workStart: toHHmm(row.work_start),
    workEnd: toHHmm(row.work_end),
    bufferBeforeMinutes: row.buffer_before_minutes,
    bufferAfterMinutes: row.buffer_after_minutes,
    breakAfterMinutes: row.break_after_minutes,
    breakDurationMinutes: row.break_duration_minutes,
    calendarId: row.calendar_id,
    includeAllDay: row.include_all_day,
    askCarryover: row.ask_carryover,
    estimateFactor: row.estimate_factor,
    timezone: row.timezone,
  };
}

const SETTINGS_KEY_MAP: Record<keyof AppSettings, string> = {
  workStart: 'work_start',
  workEnd: 'work_end',
  bufferBeforeMinutes: 'buffer_before_minutes',
  bufferAfterMinutes: 'buffer_after_minutes',
  breakAfterMinutes: 'break_after_minutes',
  breakDurationMinutes: 'break_duration_minutes',
  calendarId: 'calendar_id',
  includeAllDay: 'include_all_day',
  askCarryover: 'ask_carryover',
  estimateFactor: 'estimate_factor',
  timezone: 'timezone',
};

export function settingsPatchToRow(patch: Partial<AppSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const [key, column] of Object.entries(SETTINGS_KEY_MAP)) {
    const value = patch[key as keyof AppSettings];
    if (value !== undefined) row[column] = value;
  }

  return row;
}

type BlockedWindowRow = {
  id: string;
  user_id: string;
  label: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  specific_date: string | null;
  created_at: string;
};

export function rowToBlockedWindow(row: BlockedWindowRow): BlockedWindow {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    startTime: toHHmm(row.start_time),
    endTime: toHHmm(row.end_time),
    daysOfWeek: row.days_of_week as BlockedWindow['daysOfWeek'],
    specificDate: row.specific_date,
    createdAt: row.created_at,
  };
}

export function blockedWindowInputToRow(
  userId: string,
  input: BlockedWindowInput,
): Record<string, unknown> {
  return {
    user_id: userId,
    label: input.label,
    start_time: input.startTime,
    end_time: input.endTime,
    days_of_week: input.daysOfWeek,
    specific_date: input.specificDate,
  };
}

/** 指定したキーだけをスネークケースの列名に変える。undefined のキーは省く */
function pickDefined<Camel extends string>(
  patch: Partial<Record<Camel, unknown>>,
  keyMap: Record<Camel, string>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const key of Object.keys(keyMap) as Camel[]) {
    const value = patch[key];
    if (value !== undefined) row[keyMap[key]] = value;
  }

  return row;
}

const BLOCKED_WINDOW_KEY_MAP: Record<keyof BlockedWindowInput, string> = {
  label: 'label',
  startTime: 'start_time',
  endTime: 'end_time',
  daysOfWeek: 'days_of_week',
  specificDate: 'specific_date',
};

export function blockedWindowPatchToRow(
  patch: Partial<BlockedWindowInput>,
): Record<string, unknown> {
  return pickDefined(patch, BLOCKED_WINDOW_KEY_MAP);
}

type RoutineRow = {
  id: string;
  user_id: string;
  title: string;
  duration_minutes: number;
  times_per_day: number;
  min_gap_minutes: number;
  priority: number;
  days_of_week: number[];
  active_months: number[];
  allowed_windows: Routine['allowedWindows'];
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
};

export function rowToRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    durationMinutes: row.duration_minutes,
    timesPerDay: row.times_per_day,
    minGapMinutes: row.min_gap_minutes,
    priority: row.priority as Routine['priority'],
    daysOfWeek: row.days_of_week as Routine['daysOfWeek'],
    activeMonths: row.active_months,
    allowedWindows: row.allowed_windows,
    isActive: row.is_active,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function routineInputToRow(userId: string, input: RoutineInput): Record<string, unknown> {
  return {
    user_id: userId,
    title: input.title,
    duration_minutes: input.durationMinutes,
    times_per_day: input.timesPerDay,
    min_gap_minutes: input.minGapMinutes,
    priority: input.priority,
    days_of_week: input.daysOfWeek,
    active_months: input.activeMonths,
    allowed_windows: input.allowedWindows,
    is_active: input.isActive,
  };
}

const ROUTINE_KEY_MAP: Record<keyof RoutineInput, string> = {
  title: 'title',
  durationMinutes: 'duration_minutes',
  timesPerDay: 'times_per_day',
  minGapMinutes: 'min_gap_minutes',
  priority: 'priority',
  daysOfWeek: 'days_of_week',
  activeMonths: 'active_months',
  allowedWindows: 'allowed_windows',
  isActive: 'is_active',
};

export function routinePatchToRow(patch: Partial<RoutineInput>): Record<string, unknown> {
  return pickDefined(patch, ROUTINE_KEY_MAP);
}

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  estimated_minutes: number;
  actual_minutes: number | null;
  priority: number;
  due_date: string | null;
  status: string;
  carryover_count: number;
  source: string;
  created_at: string;
  completed_at: string | null;
};

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    priority: row.priority as Task['priority'],
    dueDate: row.due_date,
    status: row.status as Task['status'],
    carryoverCount: row.carryover_count,
    source: row.source as Task['source'],
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function taskInputToRow(userId: string, input: TaskInput): Record<string, unknown> {
  return {
    user_id: userId,
    title: input.title,
    estimated_minutes: input.estimatedMinutes,
    priority: input.priority,
    due_date: input.dueDate,
    source: input.source,
  };
}

const TASK_PATCH_KEY_MAP: Record<keyof TaskPatch, string> = {
  title: 'title',
  estimatedMinutes: 'estimated_minutes',
  priority: 'priority',
  dueDate: 'due_date',
  status: 'status',
  actualMinutes: 'actual_minutes',
  carryoverCount: 'carryover_count',
};

export function taskPatchToRow(patch: TaskPatch): Record<string, unknown> {
  return pickDefined(patch, TASK_PATCH_KEY_MAP);
}

type PlanRow = {
  id: string;
  user_id: string;
  plan_date: string;
  generated_at: string;
  items: Plan['items'];
};

export function rowToPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    userId: row.user_id,
    planDate: row.plan_date,
    generatedAt: row.generated_at,
    items: row.items,
  };
}

type RoutineSkipRow = {
  id: string;
  user_id: string;
  routine_id: string;
  skip_date: string;
};

export function rowToRoutineSkip(row: RoutineSkipRow): RoutineSkip {
  return {
    id: row.id,
    userId: row.user_id,
    routineId: row.routine_id,
    skipDate: row.skip_date,
  };
}

/** Postgres の time 型は 'HH:MM:SS' で返ることがある。先頭5文字だけを使う */
function toHHmm(value: string): string {
  return value.slice(0, 5);
}
