import type { DateString } from '@/lib/calendar/day';
import type { BlockedWindow, Plan, PlanItem, Routine, Task, TaskStatus } from '@/lib/domain';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/settings';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  blockedWindowInputToRow,
  blockedWindowPatchToRow,
  routineInputToRow,
  routinePatchToRow,
  rowToBlockedWindow,
  rowToPlan,
  rowToRoutine,
  rowToTask,
  rowToSettings,
  settingsPatchToRow,
  taskInputToRow,
  taskPatchToRow,
} from './rows';
import type { BlockedWindowInput, RoutineInput, TaskInput, TaskPatch } from './types';

/**
 * Supabase 版の実装（live モード）。
 *
 * 公開する関数の形は file-store.ts と揃えてある。呼び分けは index.ts が行う。
 * RLS（0001_init.sql）が「自分の行だけ」を強制するが、それとは別に
 * ここでも .eq('user_id', userId) を必ず付ける。RLS の設定漏れがあっても
 * 他人のデータへ書き込まないための二重の壁。
 */

async function client() {
  return createSupabaseServerClient();
}

function orThrow<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  if (result.data === null) throw new Error('Supabase: データが見つかりません');

  return result.data;
}

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

export async function getSettings(userId: string): Promise<AppSettings> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('app_settings')
    .select(
      'work_start, work_end, buffer_before_minutes, buffer_after_minutes, break_after_minutes, break_duration_minutes, calendar_id, include_all_day, ask_carryover, estimate_factor, timezone',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Supabase: ${error.message}`);
  // 新規ユーザーには 0001_init.sql のトリガーが既定行を作るが、
  // トリガー未適用でも動くよう、無ければ既定値にフォールバックする
  if (!data) return DEFAULT_SETTINGS;

  return rowToSettings(data);
}

export async function saveSettings(
  userId: string,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const supabase = await client();

  const { error } = await supabase
    .from('app_settings')
    .upsert({ user_id: userId, ...settingsPatchToRow(patch) }, { onConflict: 'user_id' });

  if (error) throw new Error(`Supabase: ${error.message}`);

  return getSettings(userId);
}

/**
 * 繰り越し確認（PLAN.md 7.2）。app_settings に同居させている（0002 migration）。
 */
export async function getCarryoverPromptedOn(userId: string): Promise<DateString | null> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('app_settings')
    .select('carryover_prompted_on')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Supabase: ${error.message}`);

  return (data?.carryover_prompted_on as string | null | undefined) ?? null;
}

export async function markCarryoverPrompted(userId: string, date: DateString): Promise<void> {
  const supabase = await client();

  const { error } = await supabase
    .from('app_settings')
    .upsert({ user_id: userId, carryover_prompted_on: date }, { onConflict: 'user_id' });

  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ---------------------------------------------------------------------------
// ブロック時間帯
// ---------------------------------------------------------------------------

export async function listBlockedWindows(userId: string): Promise<BlockedWindow[]> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('blocked_windows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Supabase: ${error.message}`);

  return (data ?? []).map(rowToBlockedWindow);
}

export async function createBlockedWindow(
  userId: string,
  input: BlockedWindowInput,
): Promise<BlockedWindow> {
  const supabase = await client();

  const result = await supabase
    .from('blocked_windows')
    .insert(blockedWindowInputToRow(userId, input))
    .select()
    .single();

  return rowToBlockedWindow(orThrow(result));
}

export async function updateBlockedWindow(
  userId: string,
  id: string,
  patch: Partial<BlockedWindowInput>,
): Promise<void> {
  const supabase = await client();

  const { error } = await supabase
    .from('blocked_windows')
    .update(blockedWindowPatchToRow(patch))
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function deleteBlockedWindow(userId: string, id: string): Promise<void> {
  const supabase = await client();

  const { error } = await supabase
    .from('blocked_windows')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ---------------------------------------------------------------------------
// ルーティン
// ---------------------------------------------------------------------------

export async function listRoutines(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Routine[]> {
  const supabase = await client();

  let query = supabase.from('routines').select('*').eq('user_id', userId);
  if (!options.includeArchived) query = query.is('archived_at', null);

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);

  return (data ?? []).map(rowToRoutine);
}

export async function getRoutine(userId: string, id: string): Promise<Routine | null> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Supabase: ${error.message}`);

  return data ? rowToRoutine(data) : null;
}

export async function createRoutine(userId: string, input: RoutineInput): Promise<Routine> {
  const supabase = await client();

  const result = await supabase
    .from('routines')
    .insert(routineInputToRow(userId, input))
    .select()
    .single();

  return rowToRoutine(orThrow(result));
}

export async function updateRoutine(
  userId: string,
  id: string,
  patch: Partial<RoutineInput>,
): Promise<void> {
  const supabase = await client();

  const { error } = await supabase
    .from('routines')
    .update(routinePatchToRow(patch))
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** 論理削除。過去の plans が参照している可能性があるので行は残す（PLAN.md 7.4） */
export async function archiveRoutine(userId: string, id: string): Promise<void> {
  const supabase = await client();

  const { error } = await supabase
    .from('routines')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function duplicateRoutine(userId: string, id: string): Promise<Routine | null> {
  const source = await getRoutine(userId, id);
  if (!source) return null;

  return createRoutine(userId, {
    title: `${source.title}のコピー`,
    durationMinutes: source.durationMinutes,
    timesPerDay: source.timesPerDay,
    minGapMinutes: source.minGapMinutes,
    priority: source.priority,
    daysOfWeek: source.daysOfWeek,
    activeMonths: source.activeMonths,
    allowedWindows: source.allowedWindows,
    isActive: source.isActive,
  });
}

// ---------------------------------------------------------------------------
// タスク
// ---------------------------------------------------------------------------

export async function listTasks(
  userId: string,
  options: { status?: TaskStatus } = {},
): Promise<Task[]> {
  const supabase = await client();

  let query = supabase.from('tasks').select('*').eq('user_id', userId);
  if (options.status) query = query.eq('status', options.status);

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);

  return (data ?? []).map(rowToTask);
}

export async function createTask(userId: string, input: TaskInput): Promise<Task> {
  const supabase = await client();

  const result = await supabase
    .from('tasks')
    .insert(taskInputToRow(userId, input))
    .select()
    .single();

  return rowToTask(orThrow(result));
}

export async function updateTask(userId: string, id: string, patch: TaskPatch): Promise<void> {
  const supabase = await client();

  const row = taskPatchToRow(patch);

  // 完了時刻は status に追従させる。取り消したら消す（file-store と同じ挙動）
  if (patch.status === 'done') {
    const { data } = await supabase
      .from('tasks')
      .select('completed_at')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!data?.completed_at) row.completed_at = new Date().toISOString();
  }
  if (patch.status && patch.status !== 'done') row.completed_at = null;

  const { error } = await supabase.from('tasks').update(row).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const supabase = await client();

  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** 選ばれたタスクの繰り越し回数を +1 する。選ばれなかったものには触らない */
export async function carryOverTasks(userId: string, taskIds: readonly string[]): Promise<void> {
  if (taskIds.length === 0) return;

  const supabase = await client();

  // Postgres には「列を+1する UPDATE」を1回で書く素直な方法が無いため、
  // 対象行を読んでから1件ずつ更新する。件数はダイアログに出す数だけなので少ない
  const { data, error } = await supabase
    .from('tasks')
    .select('id, carryover_count')
    .eq('user_id', userId)
    .in('id', [...taskIds]);

  if (error) throw new Error(`Supabase: ${error.message}`);

  await Promise.all(
    (data ?? []).map((row) =>
      supabase
        .from('tasks')
        .update({ carryover_count: row.carryover_count + 1 })
        .eq('id', row.id)
        .eq('user_id', userId),
    ),
  );
}

// ---------------------------------------------------------------------------
// 計画
// ---------------------------------------------------------------------------

export async function getPlan(userId: string, date: DateString): Promise<Plan | null> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', date)
    .maybeSingle();

  if (error) throw new Error(`Supabase: ${error.message}`);

  return data ? rowToPlan(data) : null;
}

export async function savePlan(
  userId: string,
  date: DateString,
  items: readonly PlanItem[],
): Promise<Plan> {
  const supabase = await client();

  const result = await supabase
    .from('plans')
    .upsert(
      {
        user_id: userId,
        plan_date: date,
        generated_at: new Date().toISOString(),
        items: [...items],
      },
      { onConflict: 'user_id, plan_date' },
    )
    .select()
    .single();

  return rowToPlan(orThrow(result));
}

export async function deletePlan(userId: string, date: DateString): Promise<void> {
  const supabase = await client();

  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('user_id', userId)
    .eq('plan_date', date);

  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ---------------------------------------------------------------------------
// ルーティンの当日スキップ
// ---------------------------------------------------------------------------

export async function listSkippedRoutineIds(
  userId: string,
  date: DateString,
): Promise<string[]> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('routine_skips')
    .select('routine_id')
    .eq('user_id', userId)
    .eq('skip_date', date);

  if (error) throw new Error(`Supabase: ${error.message}`);

  return (data ?? []).map((row) => row.routine_id as string);
}

export async function setRoutineSkipped(
  userId: string,
  routineId: string,
  date: DateString,
  skipped: boolean,
): Promise<void> {
  const supabase = await client();

  if (skipped) {
    const { error } = await supabase
      .from('routine_skips')
      .upsert(
        { user_id: userId, routine_id: routineId, skip_date: date },
        { onConflict: 'routine_id, skip_date' },
      );
    if (error) throw new Error(`Supabase: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from('routine_skips')
    .delete()
    .eq('user_id', userId)
    .eq('routine_id', routineId)
    .eq('skip_date', date);

  if (error) throw new Error(`Supabase: ${error.message}`);
}
