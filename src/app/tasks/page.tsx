import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { ModeBanner } from '@/components/mode-banner';
import { TaskPaste } from '@/components/task-paste';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isClaudeConfigured } from '@/lib/ai/claude';
import { PRIORITY_LABELS, type Priority, type Task } from '@/lib/domain';
import { formatDuration } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { listTasks } from '@/lib/store';
import { createTaskAction, deleteTaskAction, setTaskStatusAction, updateTaskAction } from './actions';

export const dynamic = 'force-dynamic';

const PRIORITY_STYLES: Record<Priority, string> = {
  1: 'border-red-500/40 text-red-600 dark:text-red-400',
  2: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  3: 'border-slate-400/40 text-slate-500',
};

export default async function TasksPage() {
  const { user, mode, missing } = await requireSession();
  const tasks = await listTasks(user.id);

  const pending = tasks.filter((task) => task.status === 'pending');
  const finished = tasks.filter((task) => task.status !== 'pending');

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">タスク</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          未完了のタスクが、ルーティンを置いたあとの隙間に詰められる
        </p>
      </header>

      {mode === 'mock' && <ModeBanner missing={missing} />}

      <TaskPaste configured={isClaudeConfigured()} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">タスクを追加</CardTitle>
          <CardDescription>見積は多めに。あとから実測と比べて補正できる</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTaskAction} className="grid gap-4 sm:grid-cols-12">
            <div className="space-y-2 sm:col-span-5">
              <Label htmlFor="title">タイトル</Label>
              <Input id="title" name="title" placeholder="LP の修正" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="estimatedMinutes">見積（分）</Label>
              <Input
                id="estimatedMinutes"
                name="estimatedMinutes"
                type="number"
                min={1}
                defaultValue={60}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="priority">優先度</Label>
              <PrioritySelect id="priority" defaultValue={2} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="dueDate">締切（任意）</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
            <div className="flex justify-end sm:col-span-12">
              <Button type="submit">追加</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          未完了 {pending.length > 0 && `（${pending.length}件）`}
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              未完了のタスクはありません
            </CardContent>
          </Card>
        ) : (
          pending.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </section>

      {finished.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">完了・見送り</h2>
          {finished.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </section>
      )}
    </main>
  );
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status !== 'pending';

  return (
    <Card className={done ? 'opacity-60' : undefined}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={done ? 'font-medium line-through' : 'font-medium'}>{task.title}</span>
              <Badge variant="outline" className={PRIORITY_STYLES[task.priority]}>
                {PRIORITY_LABELS[task.priority]}
              </Badge>
              {task.status === 'skipped' && <Badge variant="secondary">見送り</Badge>}
              {task.carryoverCount >= 3 && (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
                  <AlertTriangle className="size-3" />
                  {task.carryoverCount}回繰り越し
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              見積 {formatDuration(task.estimatedMinutes)}
              {task.actualMinutes != null && ` ／ 実測 ${formatDuration(task.actualMinutes)}`}
              {task.dueDate && ` ／ 締切 ${task.dueDate}`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {done ? (
              <StatusButton id={task.id} status="pending" label="未完了に戻す">
                <RotateCcw className="size-4" />
              </StatusButton>
            ) : (
              <>
                <form action={setTaskStatusAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="status" value="done" />
                  <Input
                    name="actualMinutes"
                    type="number"
                    min={0}
                    placeholder="実測"
                    className="h-8 w-20"
                    aria-label={`${task.title}の実測時間（分）`}
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    完了
                  </Button>
                </form>
                <StatusButton id={task.id} status="skipped" label="今日はやらない">
                  見送り
                </StatusButton>
              </>
            )}
            <form action={deleteTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <Button type="submit" variant="ghost" size="icon" aria-label={`${task.title}を削除`}>
                <Trash2 className="size-4" />
              </Button>
            </form>
          </div>
        </div>

        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-2 text-sm">編集する</summary>
          <form action={updateTaskAction} className="grid gap-4 border-t p-4 sm:grid-cols-12">
            <input type="hidden" name="id" value={task.id} />
            <div className="space-y-2 sm:col-span-5">
              <Label htmlFor={`title-${task.id}`}>タイトル</Label>
              <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`estimate-${task.id}`}>見積（分）</Label>
              <Input
                id={`estimate-${task.id}`}
                name="estimatedMinutes"
                type="number"
                min={1}
                defaultValue={task.estimatedMinutes}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`priority-${task.id}`}>優先度</Label>
              <PrioritySelect id={`priority-${task.id}`} defaultValue={task.priority} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`due-${task.id}`}>締切</Label>
              <Input
                id={`due-${task.id}`}
                name="dueDate"
                type="date"
                defaultValue={task.dueDate ?? ''}
              />
            </div>
            <div className="flex justify-end sm:col-span-12">
              <Button type="submit" variant="secondary">
                変更を保存
              </Button>
            </div>
          </form>
        </details>
      </CardContent>
    </Card>
  );
}

function StatusButton({
  id,
  status,
  label,
  children,
}: {
  id: string;
  status: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={setTaskStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" aria-label={label} title={label}>
        {children}
      </Button>
    </form>
  );
}

function PrioritySelect({ id, defaultValue }: { id: string; defaultValue: Priority }) {
  return (
    <select
      id={id}
      name="priority"
      defaultValue={String(defaultValue)}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="1">高</option>
      <option value="2">中</option>
      <option value="3">低</option>
    </select>
  );
}
