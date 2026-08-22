'use server';

import { revalidatePath } from 'next/cache';
import { decomposeTasks } from '@/lib/ai/claude';
import type { Priority, TaskStatus } from '@/lib/domain';
import { readNumber, readOptionalString, readString, readStrings } from '@/lib/form';
import { requireSession } from '@/lib/session';
import { createTask, deleteTask, updateTask } from '@/lib/store';
import { type DecomposeState } from './decompose-state';

export async function createTaskAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const title = readString(form, 'title');
  if (!title) return;

  await createTask(user.id, {
    title,
    estimatedMinutes: Math.max(1, Math.round(readNumber(form, 'estimatedMinutes', 30))),
    priority: readPriority(form),
    dueDate: readOptionalString(form, 'dueDate'),
    source: 'manual',
  });

  revalidateTaskViews();
}

export async function updateTaskAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  if (!id) return;

  await updateTask(user.id, id, {
    title: readString(form, 'title'),
    estimatedMinutes: Math.max(1, Math.round(readNumber(form, 'estimatedMinutes', 30))),
    priority: readPriority(form),
    dueDate: readOptionalString(form, 'dueDate'),
  });

  revalidateTaskViews();
}

/** 完了・見送り・未完了の切り替え。完了時は実測を任意で受け取る（PLAN.md 7.1） */
export async function setTaskStatusAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  const status = readString(form, 'status');
  if (!id || !isTaskStatus(status)) return;

  const actual = readNumber(form, 'actualMinutes', 0);

  await updateTask(user.id, id, {
    status,
    ...(status === 'done' && actual > 0 ? { actualMinutes: Math.round(actual) } : {}),
  });

  revalidateTaskViews();
}

export async function deleteTaskAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  if (id) await deleteTask(user.id, id);

  revalidateTaskViews();
}

/**
 * 貼り付けたテキストを Claude に分解させる（PLAN.md 7.3 / Phase 5）。
 *
 * ここでは**保存しない**。候補を返すだけで、保存は確認画面で人が押したときだけ。
 * AI が使えなくても、下の手入力フォームは常に動く。
 */
export async function decomposeAction(
  _previous: DecomposeState,
  form: FormData,
): Promise<DecomposeState> {
  await requireSession();

  const input = readString(form, 'input');
  const result = await decomposeTasks(input);

  if (!result.ok) {
    return { drafts: [], input, error: result.message };
  }

  return { drafts: result.drafts, input, error: null };
}

/** 確認画面で編集された候補を、実際のタスクとして保存する */
export async function saveDraftsAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  // チェックを外された行は index ごと来ないので、残った index だけを保存する
  for (const index of readStrings(form, 'keep')) {
    const title = readString(form, `title-${index}`);
    if (!title) continue;

    await createTask(user.id, {
      title,
      estimatedMinutes: Math.max(1, Math.round(readNumber(form, `estimatedMinutes-${index}`, 30))),
      priority: toPriority(readNumber(form, `priority-${index}`, 2)),
      dueDate: readOptionalString(form, `dueDate-${index}`),
      source: 'ai',
    });
  }

  revalidateTaskViews();
}

function toPriority(value: number): Priority {
  const rounded = Math.round(value);

  return rounded === 1 || rounded === 3 ? rounded : 2;
}

function readPriority(form: FormData): Priority {
  const value = Math.round(readNumber(form, 'priority', 2));

  return value === 1 || value === 3 ? value : 2;
}

function isTaskStatus(value: string): value is TaskStatus {
  return value === 'pending' || value === 'done' || value === 'skipped';
}

function revalidateTaskViews(): void {
  revalidatePath('/tasks');
  revalidatePath('/');
}
