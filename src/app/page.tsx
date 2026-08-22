import { AlertTriangle, CalendarOff, Lightbulb, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { CarryoverDialog } from '@/components/carryover-dialog';
import { ModeBanner } from '@/components/mode-banner';
import { SignOutButton } from '@/components/sign-out-button';
import { SkippedRoutines } from '@/components/skipped-routines';
import { Timeline } from '@/components/timeline';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { todayInTimeZone } from '@/lib/calendar';
import { addDaysToDate } from '@/lib/calendar/day';
import { loadDayPlan, type DayPlan } from '@/lib/day-plan';
import { formatDateHeading, formatDuration } from '@/lib/format';
import { carryoverCandidates, needsCarryoverPrompt } from '@/lib/carryover';
import { minutesInTimeZone } from '@/lib/planner/now';
import { requireSession } from '@/lib/session';
import type { AppSettings } from '@/lib/settings';
import { getCarryoverPromptedOn, listTasks } from '@/lib/store';
import { recomputeFromNowAction } from './actions';

// カレンダーは毎リクエストで取得する（PLAN.md 3.1: 予定内容を保存しない）
export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { user, mode, missing, settings } = await requireSession();

  const today = todayInTimeZone(settings.timezone);
  const { date: requestedDate } = await searchParams;
  const date = requestedDate ?? today;

  const plan = await loadDayPlan({ user, mode, settings, date });
  const isToday = date === today;

  // 繰り越し確認は「今日」を開いたときだけ。過去や未来を見に来た人には出さない
  const carryover = isToday ? await pendingCarryover(user.id, today, settings) : [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{formatDateHeading(date)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            稼働時間 {settings.workStart}–{settings.workEnd} ／ {settings.timezone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === 'mock' ? 'outline' : 'secondary'}>
            {mode === 'mock' ? 'モック' : user.email}
          </Badge>
          {mode === 'live' && <SignOutButton />}
        </div>
      </header>

      {mode === 'mock' && <ModeBanner missing={missing} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <DateLink date={addDaysToDate(date, -1)} label="前日" />
          {!isToday && <DateLink date={today} label="今日" />}
          <DateLink date={addDaysToDate(date, 1)} label="翌日" />
        </div>

        <form action={recomputeFromNowAction}>
          <input type="hidden" name="date" value={date} />
          <Button type="submit" variant="secondary" size="sm">
            <RefreshCw className="size-4" />
            {isToday ? '今から組み直す' : '組み直す'}
          </Button>
        </form>
      </div>

      {carryover.length > 0 && <CarryoverDialog date={date} tasks={carryover} />}

      {plan.calendarUnavailable && <CalendarWarning />}

      {plan.allDayEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">終日</span>
          {plan.allDayEvents.map((event) => (
            <Badge key={event.id} variant="secondary">
              {event.title}
            </Badge>
          ))}
        </div>
      )}

      {plan.entries.length === 0 ? (
        <EmptyDay />
      ) : (
        <Card>
          <CardContent className="pt-2">
            <Timeline
              date={date}
              entries={plan.entries}
              workStart={plan.workStart}
              workEnd={plan.workEnd}
              nowMinutes={isToday ? minutesInTimeZone(settings.timezone) : null}
            />
          </CardContent>
        </Card>
      )}

      <SkippedRoutines
        date={date}
        routines={plan.routines}
        skippedIds={plan.skippedRoutineIds}
      />

      <Legend />

      <Unplaced plan={plan} />
    </main>
  );
}

/** 今日まだ確認していない繰り越し候補。出す必要が無ければ空配列 */
async function pendingCarryover(userId: string, today: string, settings: AppSettings) {
  const [tasks, promptedOn] = await Promise.all([
    listTasks(userId, { status: 'pending' }),
    getCarryoverPromptedOn(userId),
  ]);

  const candidates = carryoverCandidates(tasks, today, settings.timezone);

  return needsCarryoverPrompt({ settings, promptedOn, today, candidates }) ? candidates : [];
}

function DateLink({ date, label }: { date: string; label: string }) {
  return (
    <Link href={`/?date=${date}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
      {label}
    </Link>
  );
}

function EmptyDay() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <CalendarOff className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">この日に置くものがありません</p>
        <div className="flex gap-2">
          <Link href="/tasks" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            タスクを追加
          </Link>
          <Link href="/routines" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            ルーティンを追加
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarWarning() {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">Google カレンダーを読めませんでした</p>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        予定を除外できていないため、この配置は当てになりません。
        一度ログアウトして、もう一度ログインしてください。
        テスト状態の OAuth アプリでは、リフレッシュトークンが7日で失効します（PLAN.md 10.1）。
      </p>
    </div>
  );
}

/** 置けなかったものと、その緩和案（PLAN.md 6.4 / 7.1） */
function Unplaced({ plan }: { plan: DayPlan }) {
  const hasUnplaced = plan.unplacedRoutines.length > 0 || plan.unplacedTasks.length > 0;
  if (!hasUnplaced) return null;

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600" aria-hidden />
          今日は入りませんでした
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm">
          {plan.unplacedRoutines.map((routine) => (
            <li key={routine.routineId} className="flex items-baseline gap-2">
              <Badge variant="outline" className="shrink-0">
                ルーティン
              </Badge>
              <span>
                {routine.title}
                <span className="ml-2 text-muted-foreground">
                  {routine.placedCount} / {routine.requiredCount} 回
                </span>
              </span>
            </li>
          ))}
          {plan.unplacedTasks.map((task) => (
            <li key={task.taskId} className="flex items-baseline gap-2">
              <Badge variant="outline" className="shrink-0">
                タスク
              </Badge>
              <span>
                {task.title}
                <span className="ml-2 text-muted-foreground">
                  {formatDuration(task.neededMinutes)}必要／最大の空きは
                  {formatDuration(task.largestFreeMinutes)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {plan.relaxations.length > 0 && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="size-4" aria-hidden />
              こうすれば入ります
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {plan.relaxations.map((relaxation) => (
                <li key={`${relaxation.kind}-${relaxation.message}`}>・{relaxation.message}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              自動では適用しません。設定やルーティンを変えるかどうかは自分で決めてください
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Legend() {
  const items = [
    { label: '予定', className: 'bg-slate-300 dark:bg-slate-600' },
    { label: 'ブロック', className: 'bg-neutral-300 dark:bg-neutral-600' },
    { label: 'ルーティン', className: 'bg-blue-300 dark:bg-blue-700' },
    { label: 'タスク', className: 'bg-amber-300 dark:bg-amber-700' },
    { label: '休憩', className: 'bg-emerald-200 dark:bg-emerald-800' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-sm ${item.className}`} aria-hidden />
          {item.label}
        </span>
      ))}
      <span className="ml-auto">ドラッグで移動できます（15分刻み・移動するとピン留めされます）</span>
    </div>
  );
}
