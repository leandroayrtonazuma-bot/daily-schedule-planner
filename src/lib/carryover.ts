import type { DateString } from '@/lib/calendar/day';
import type { Task } from '@/lib/domain';
import type { AppSettings } from '@/lib/settings';

/**
 * 繰り越し確認ダイアログ（PLAN.md 7.2）の判定。
 *
 * 「その日最初のアクセス時」だけ出すため、最後に確認した日を保存しておき、
 * それが今日でなければ出す。日付の比較はユーザーのタイムゾーンで行う。
 */

/** 前日以前に作られた、まだ手つかずのタスク。古い順 → id 順 */
export function carryoverCandidates(
  tasks: readonly Task[],
  today: DateString,
  timeZone: string,
): Task[] {
  return tasks
    .filter((task) => task.status === 'pending' && dateInTimeZone(task.createdAt, timeZone) < today)
    .sort((a, b) => {
      const left = dateInTimeZone(a.createdAt, timeZone);
      const right = dateInTimeZone(b.createdAt, timeZone);
      if (left !== right) return left < right ? -1 : 1;
      // 決定性のため、最後は必ず id で比較する（PLAN.md 3.3）
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

export function needsCarryoverPrompt(params: {
  settings: AppSettings;
  promptedOn: DateString | null;
  today: DateString;
  candidates: readonly Task[];
}): boolean {
  const { settings, promptedOn, today, candidates } = params;

  if (!settings.askCarryover) return false;
  if (candidates.length === 0) return false;

  return promptedOn !== today;
}

/** ISO の日時を、指定タイムゾーンでの 'YYYY-MM-DD' に直す */
function dateInTimeZone(iso: string, timeZone: string): DateString {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';

  // en-CA は 'YYYY-MM-DD' で出るので、そのまま文字列比較に使える
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}
