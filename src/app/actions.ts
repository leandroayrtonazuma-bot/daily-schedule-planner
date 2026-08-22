'use server';

import { revalidatePath } from 'next/cache';
import type { PlanItem } from '@/lib/domain';
import { readNumber, readString, readStrings } from '@/lib/form';
import { loadDayPlan } from '@/lib/day-plan';
import { minutesInTimeZone } from '@/lib/planner/now';
import { formatMinutes, MINUTES_PER_DAY, parseTime } from '@/lib/planner/time';
import { requireSession } from '@/lib/session';
import { carryOverTasks, getPlan, markCarryoverPrompted, savePlan, setRoutineSkipped } from '@/lib/store';
import { todayInTimeZone } from '@/lib/calendar';

/**
 * 「今から組み直す」（PLAN.md 6.6）。
 * 現在時刻より前の項目は動かさず、それ以降だけを組み直す。
 */
export async function recomputeFromNowAction(form: FormData): Promise<void> {
  const { user, mode, settings } = await requireSession();

  const date = readString(form, 'date') || todayInTimeZone(settings.timezone);
  const nowMinutes = minutesInTimeZone(settings.timezone);

  // 別の日を見ているときは基準時刻を使わず、丸ごと組み直す
  const fromMinutes = date === todayInTimeZone(settings.timezone) ? nowMinutes : null;

  await loadDayPlan({ user, mode, settings, date, fromMinutes });

  revalidatePath('/');
}

/**
 * 繰り越し確認ダイアログの回答（PLAN.md 7.2）。
 *
 * 選ばれたタスクだけ carryover_count を +1 する。外されたタスクは pending のまま残り、
 * 翌日また候補に出る。「あとで決める」だけは確認済みにせず、次回また聞く。
 */
export async function resolveCarryoverAction(form: FormData): Promise<void> {
  const { user, settings } = await requireSession();

  const date = readString(form, 'date') || todayInTimeZone(settings.timezone);

  if (readString(form, 'dismiss') === 'true') {
    revalidatePath('/');
    return;
  }

  await carryOverTasks(user.id, readStrings(form, 'carry'));
  await markCarryoverPrompted(user.id, date);

  revalidatePath('/');
}

/** 手で動かした項目はピン留めされる。もう一度押すと解除 */
export async function togglePinAction(form: FormData): Promise<void> {
  const { user, settings } = await requireSession();

  const date = readString(form, 'date') || todayInTimeZone(settings.timezone);
  const target = readString(form, 'at');
  const kind = readString(form, 'kind');
  const refId = readString(form, 'refId');

  await mutatePlan(user.id, date, (items) =>
    items.map((item) =>
      matches(item, kind, refId, target) ? { ...item, pinned: !item.pinned } : item,
    ),
  );

  revalidatePath('/');
}

/**
 * 項目を別の時刻へ動かす（PLAN.md 7.1）。長さは変えない。
 * 動かしたものは自動でピン留めされ、以後の組み直しでも動かない。
 */
export async function movePlanItemAction(form: FormData): Promise<void> {
  const { user, settings } = await requireSession();

  const date = readString(form, 'date') || todayInTimeZone(settings.timezone);
  const target = readString(form, 'at');
  const kind = readString(form, 'kind');
  const refId = readString(form, 'refId');
  const toMinutes = Math.round(readNumber(form, 'to', -1));

  if (toMinutes < 0 || toMinutes > MINUTES_PER_DAY) return;

  await mutatePlan(user.id, date, (items) =>
    items.map((item) => {
      if (!matches(item, kind, refId, target)) return item;

      const length = parseTime(item.end) - parseTime(item.start);
      const start = Math.min(toMinutes, MINUTES_PER_DAY - length);

      return {
        ...item,
        start: formatMinutes(Math.max(0, start)),
        end: formatMinutes(Math.max(0, start) + length),
        pinned: true,
      };
    }),
  );

  revalidatePath('/');
}

/** 今日だけルーティンを飛ばす／戻す */
export async function toggleRoutineSkipAction(form: FormData): Promise<void> {
  const { user, settings } = await requireSession();

  const date = readString(form, 'date') || todayInTimeZone(settings.timezone);
  const routineId = readString(form, 'routineId');
  const skipped = readString(form, 'skipped') === 'true';
  if (!routineId) return;

  await setRoutineSkipped(user.id, routineId, date, skipped);

  // スキップした枠を空けたまま残さないよう、計画を作り直す
  await mutatePlan(user.id, date, (items) =>
    items.filter((item) => !(item.kind === 'routine' && item.refId === routineId)),
  );

  revalidatePath('/');
}

async function mutatePlan(
  userId: string,
  date: string,
  mutate: (items: PlanItem[]) => PlanItem[],
): Promise<void> {
  const plan = await getPlan(userId, date);
  if (!plan) return;

  await savePlan(userId, date, mutate(plan.items));
}

/** 開始時刻で項目を特定する。plans.items に id が無いため */
function matches(item: PlanItem, kind: string, refId: string, at: string): boolean {
  return item.kind === kind && (item.refId ?? '') === refId && item.start === at;
}
