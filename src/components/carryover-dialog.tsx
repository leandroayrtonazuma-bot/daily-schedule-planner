'use client';

import { AlertTriangle, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { resolveCarryoverAction } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { Task } from '@/lib/domain';
import { PRIORITY_LABELS } from '@/lib/domain';
import { formatDuration } from '@/lib/format';

/**
 * 繰り越し確認ダイアログ（PLAN.md 7.2）。
 *
 * その日最初のアクセス時に一度だけ出す。チェックしたものだけを繰り越し、
 * 外したものは pending のまま残る（消えない）。
 *
 * 何度も繰り越しているタスクには警告を出す。3回先送りしたタスクは、
 * たいてい「やらないと決めていないだけ」なので。
 */
export function CarryoverDialog({ date, tasks }: { date: string; tasks: readonly Task[] }) {
  // 既定は全選択。並んでいるものを一つずつ選び直させるのは面倒なので
  const [selected, setSelected] = useState<string[]>(() => tasks.map((task) => task.id));

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" aria-hidden />
          昨日までのタスクが {tasks.length} 件残っています
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          今日やるものを選んでください。外したものも消えません。翌日また聞きます。
        </p>
      </CardHeader>

      <CardContent>
        <form action={resolveCarryoverAction} className="space-y-4">
          <input type="hidden" name="date" value={date} />

          <ul className="space-y-2">
            {tasks.map((task) => {
              const nagging = task.carryoverCount >= 3;

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <Checkbox
                    id={`carry-${task.id}`}
                    name="carry"
                    value={task.id}
                    checked={selected.includes(task.id)}
                    onCheckedChange={() => toggle(task.id)}
                    className="mt-0.5"
                  />
                  <label htmlFor={`carry-${task.id}`} className="flex-1 cursor-pointer space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{task.title}</span>
                      <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
                      <span className="text-muted-foreground">
                        {formatDuration(task.estimatedMinutes)}
                      </span>
                      {task.dueDate && (
                        <span className="text-muted-foreground">締切 {task.dueDate}</span>
                      )}
                    </span>

                    {nagging && (
                      <span className="flex items-start gap-1.5 text-amber-700 dark:text-amber-500">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          {task.carryoverCount}回先送りしています。本当にやりますか？
                        </span>
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButtons count={selected.length} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButtons({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <>
      <Button type="submit" disabled={pending}>
        {count > 0 ? `${count} 件を今日やる` : '今日はやらない'}
      </Button>
      <Button type="submit" name="dismiss" value="true" variant="ghost" disabled={pending}>
        あとで決める
      </Button>
      <span className="text-xs text-muted-foreground">
        「あとで決める」を選ぶと、次に開いたときにまた聞きます
      </span>
    </>
  );
}
