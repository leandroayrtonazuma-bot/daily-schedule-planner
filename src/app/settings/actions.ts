'use server';

import { revalidatePath } from 'next/cache';
import type { DayOfWeek } from '@/lib/domain';
import { readBoolean, readNumber, readNumbers, readOptionalString, readString } from '@/lib/form';
import { requireSession } from '@/lib/session';
import { createBlockedWindow, deleteBlockedWindow, saveSettings } from '@/lib/store';

export async function saveSettingsAction(form: FormData): Promise<void> {
  // 画面が認証済みでも、Server Action の中で必ず確かめる
  const { user, settings } = await requireSession();

  await saveSettings(user.id, {
    workStart: readString(form, 'workStart') || settings.workStart,
    workEnd: readString(form, 'workEnd') || settings.workEnd,
    bufferBeforeMinutes: clampMinutes(readNumber(form, 'bufferBeforeMinutes', 0)),
    bufferAfterMinutes: clampMinutes(readNumber(form, 'bufferAfterMinutes', 0)),
    breakAfterMinutes: Math.max(1, readNumber(form, 'breakAfterMinutes', 90)),
    breakDurationMinutes: clampMinutes(readNumber(form, 'breakDurationMinutes', 0)),
    includeAllDay: readBoolean(form, 'includeAllDay'),
    askCarryover: readBoolean(form, 'askCarryover'),
    estimateFactor: clampFactor(readNumber(form, 'estimateFactor', 1)),
    calendarId: readString(form, 'calendarId') || 'primary',
  });

  revalidatePath('/settings');
  revalidatePath('/');
}

/**
 * 実測から割り出した係数を採用する（PLAN.md 8章 Phase 4）。
 * 提案を表示するだけでは反映しない。ここを通ったときだけ設定が変わる。
 */
export async function applyEstimateFactorAction(form: FormData): Promise<void> {
  const { user, settings } = await requireSession();

  await saveSettings(user.id, {
    estimateFactor: clampFactor(readNumber(form, 'estimateFactor', settings.estimateFactor)),
  });

  revalidatePath('/settings');
  revalidatePath('/');
}

export async function addBlockedWindowAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const label = readString(form, 'label');
  const startTime = readString(form, 'startTime');
  const endTime = readString(form, 'endTime');
  if (!label || !startTime || !endTime) return;

  const specificDate = readOptionalString(form, 'specificDate');
  const daysOfWeek = readNumbers(form, 'daysOfWeek').filter(isDayOfWeek);

  // 単発でも曜日指定でもないブロックは、どの日にも効かないので受け付けない
  if (!specificDate && daysOfWeek.length === 0) return;

  await createBlockedWindow(user.id, {
    label,
    startTime,
    endTime,
    daysOfWeek,
    specificDate,
  });

  revalidatePath('/settings');
  revalidatePath('/');
}

export async function deleteBlockedWindowAction(form: FormData): Promise<void> {
  const { user } = await requireSession();

  const id = readString(form, 'id');
  if (id) await deleteBlockedWindow(user.id, id);

  revalidatePath('/settings');
  revalidatePath('/');
}

function clampMinutes(value: number): number {
  return Math.min(240, Math.max(0, Math.round(value)));
}

function clampFactor(value: number): number {
  return Math.min(3, Math.max(0.1, value));
}

function isDayOfWeek(value: number): value is DayOfWeek {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}
