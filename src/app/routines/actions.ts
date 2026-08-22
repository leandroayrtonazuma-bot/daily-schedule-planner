'use server';

import { revalidatePath } from 'next/cache';
import { ALL_MONTHS, type DayOfWeek, type Priority, type TimeWindow } from '@/lib/domain';
import { readBoolean, readNumber, readNumbers, readString } from '@/lib/form';
import { validateRoutine } from '@/lib/planner/routines';
import { requireSession } from '@/lib/session';
import type { RoutineFormState } from './form-state';
import {
  archiveRoutine,
  createRoutine,
  duplicateRoutine,
  getRoutine,
  updateRoutine,
  type RoutineInput,
} from '@/lib/store';

/**
 * ルーティンの新規作成と更新。
 * id が空なら新規、入っていれば更新。保存前に PLAN.md 6.5 の検証を通す。
 */
export async function saveRoutineAction(
  _previous: RoutineFormState,
  form: FormData,
): Promise<RoutineFormState> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  const input = readRoutineInput(form);

  // 検証は保存後の姿に対して行う
  const errors = validateRoutine({
    ...input,
    id: id || 'new',
    userId: user.id,
    archivedAt: null,
    createdAt: new Date().toISOString(),
  });

  if (errors.length > 0) return { status: 'error', errors };

  if (id) {
    const existing = await getRoutine(user.id, id);
    if (!existing) return { status: 'error', errors: ['ルーティンが見つかりません'] };

    await updateRoutine(user.id, id, input);
  } else {
    await createRoutine(user.id, input);
  }

  revalidatePath('/routines');
  revalidatePath('/');

  return { status: 'saved', errors: [] };
}

export async function toggleRoutineActiveAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  const routine = id ? await getRoutine(user.id, id) : null;
  if (!routine) return;

  await updateRoutine(user.id, id, { isActive: !routine.isActive });

  revalidatePath('/routines');
  revalidatePath('/');
}

/** 論理削除。過去の計画が参照しているので行は残す（PLAN.md 7.4） */
export async function archiveRoutineAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  if (id) await archiveRoutine(user.id, id);

  revalidatePath('/routines');
  revalidatePath('/');
}

export async function duplicateRoutineAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  if (id) await duplicateRoutine(user.id, id);

  revalidatePath('/routines');
}

function readRoutineInput(form: FormData): RoutineInput {
  const months = readNumbers(form, 'activeMonths');

  return {
    title: readString(form, 'title'),
    durationMinutes: Math.round(readNumber(form, 'durationMinutes', 30)),
    timesPerDay: Math.round(readNumber(form, 'timesPerDay', 1)),
    minGapMinutes: Math.max(0, Math.round(readNumber(form, 'minGapMinutes', 0))),
    priority: readPriority(form),
    daysOfWeek: readNumbers(form, 'daysOfWeek').filter(isDayOfWeek),
    // 月の指定は任意。1つも選ばれていなければ通年扱いにする
    activeMonths: months.length > 0 ? months : ALL_MONTHS,
    allowedWindows: readWindows(form),
    isActive: readBoolean(form, 'isActive'),
  };
}

function readPriority(form: FormData): Priority {
  const value = Math.round(readNumber(form, 'priority', 2));

  return value === 1 || value === 3 ? value : 2;
}

/** WindowPicker が hidden input に入れた JSON を読む */
function readWindows(form: FormData): TimeWindow[] {
  const raw = readString(form, 'allowedWindows');
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): TimeWindow[] => {
      if (typeof item !== 'object' || item === null) return [];

      const { start, end } = item as Record<string, unknown>;
      if (typeof start !== 'string' || typeof end !== 'string') return [];

      return [{ start, end }];
    });
  } catch {
    return [];
  }
}

function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}
