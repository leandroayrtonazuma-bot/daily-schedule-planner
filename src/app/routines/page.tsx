import { Copy, Pause, Play, Trash2 } from 'lucide-react';
import { ModeBanner } from '@/components/mode-banner';
import { RoutineForm } from '@/components/routine-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PRIORITY_LABELS, WEEKDAY_LABELS, type Routine } from '@/lib/domain';
import { formatDuration } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { listRoutines } from '@/lib/store';
import { archiveRoutineAction, duplicateRoutineAction, toggleRoutineActiveAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function RoutinesPage() {
  const { user, mode, missing } = await requireSession();
  const routines = await listRoutines(user.id);

  // 停止中は下にまとめる（PLAN.md 7.4）
  const active = routines.filter((routine) => routine.isActive);
  const paused = routines.filter((routine) => !routine.isActive);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">ルーティン</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          時間帯と回数が決まっている習慣。タスクより先に場所を取る
        </p>
      </header>

      {mode === 'mock' && <ModeBanner missing={missing} />}

      {routines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            まだルーティンがありません。下のフォームから追加してください
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
          {paused.length > 0 && (
            <>
              <p className="pt-4 text-sm font-medium text-muted-foreground">停止中</p>
              {paused.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} />
              ))}
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ルーティンを追加</CardTitle>
          <CardDescription>
            許可時間帯は「この時間帯のどこかに置いてよい」という意味。狭いほど先に場所を取る
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoutineForm />
        </CardContent>
      </Card>
    </main>
  );
}

function RoutineCard({ routine }: { routine: Routine }) {
  return (
    <Card className={routine.isActive ? undefined : 'opacity-60'}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{routine.title}</span>
              <Badge variant="outline">優先度 {PRIORITY_LABELS[routine.priority]}</Badge>
              {!routine.isActive && <Badge variant="secondary">停止中</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDuration(routine.durationMinutes)} × {routine.timesPerDay}回
              {routine.minGapMinutes > 0 && `（${formatDuration(routine.minGapMinutes)}以上あける）`}
              ／ {describeDays(routine.daysOfWeek)}
            </p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {routine.allowedWindows.map((w) => `${w.start}–${w.end}`).join('、') || '許可時間帯なし'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <IconAction
              action={toggleRoutineActiveAction}
              id={routine.id}
              label={routine.isActive ? '一時停止' : '再開'}
            >
              {routine.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
            </IconAction>
            <IconAction action={duplicateRoutineAction} id={routine.id} label="複製">
              <Copy className="size-4" />
            </IconAction>
            <IconAction action={archiveRoutineAction} id={routine.id} label="削除">
              <Trash2 className="size-4" />
            </IconAction>
          </div>
        </div>

        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-2 text-sm">編集する</summary>
          <div className="border-t p-4">
            <RoutineForm routine={routine} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function IconAction({
  action,
  id,
  label,
  children,
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="icon" aria-label={label} title={label}>
        {children}
      </Button>
    </form>
  );
}

function describeDays(days: readonly number[]): string {
  if (days.length === 7) return '毎日';
  if (days.length === 0) return '曜日未設定';

  return days.map((day) => WEEKDAY_LABELS[day]).join('');
}
