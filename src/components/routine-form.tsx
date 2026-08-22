'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveRoutineAction } from '@/app/routines/actions';
import {
  INITIAL_ROUTINE_FORM_STATE,
  type RoutineFormState,
} from '@/app/routines/form-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WeekdayPicker } from '@/components/weekday-picker';
import { WindowPicker } from '@/components/window-picker';
import { ALL_DAYS_OF_WEEK, ALL_MONTHS, type Routine } from '@/lib/domain';

const MONTH_LABELS = ALL_MONTHS.map((month) => `${month}月`);

/**
 * ルーティンの追加・編集フォーム（PLAN.md 7.4）。
 * routine を渡すと編集、渡さなければ新規追加。
 */
export function RoutineForm({ routine }: { routine?: Routine }) {
  const [state, formAction] = useActionState<RoutineFormState, FormData>(
    saveRoutineAction,
    INITIAL_ROUTINE_FORM_STATE,
  );

  return (
    <form action={formAction} className="space-y-5">
      {routine && <input type="hidden" name="id" value={routine.id} />}

      {state.errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`title-${routine?.id ?? 'new'}`}>タイトル</Label>
          <Input
            id={`title-${routine?.id ?? 'new'}`}
            name="title"
            defaultValue={routine?.title ?? ''}
            placeholder="ランニング"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`duration-${routine?.id ?? 'new'}`}>1回の所要時間（分）</Label>
          <Input
            id={`duration-${routine?.id ?? 'new'}`}
            name="durationMinutes"
            type="number"
            min={1}
            defaultValue={routine?.durationMinutes ?? 30}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`times-${routine?.id ?? 'new'}`}>1日の回数</Label>
          <Input
            id={`times-${routine?.id ?? 'new'}`}
            name="timesPerDay"
            type="number"
            min={1}
            max={10}
            defaultValue={routine?.timesPerDay ?? 1}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`gap-${routine?.id ?? 'new'}`}>回と回の最小間隔（分）</Label>
          <Input
            id={`gap-${routine?.id ?? 'new'}`}
            name="minGapMinutes"
            type="number"
            min={0}
            defaultValue={routine?.minGapMinutes ?? 0}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`priority-${routine?.id ?? 'new'}`}>優先度</Label>
          <select
            id={`priority-${routine?.id ?? 'new'}`}
            name="priority"
            defaultValue={String(routine?.priority ?? 2)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="1">高（先に場所を取る）</option>
            <option value="2">中</option>
            <option value="3">低</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>曜日</Label>
        <WeekdayPicker name="daysOfWeek" selected={routine?.daysOfWeek ?? ALL_DAYS_OF_WEEK} />
      </div>

      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          有効な月（季節限定のルーティン用）
        </summary>
        <div className="mt-3 flex flex-wrap gap-1">
          {ALL_MONTHS.map((month) => (
            <label
              key={month}
              className="cursor-pointer select-none rounded-md border px-2.5 py-1 text-sm text-muted-foreground transition-colors has-checked:border-foreground has-checked:bg-foreground has-checked:text-background hover:bg-muted has-checked:hover:bg-foreground"
            >
              <input
                type="checkbox"
                name="activeMonths"
                value={month}
                defaultChecked={(routine?.activeMonths ?? ALL_MONTHS).includes(month)}
                className="sr-only"
              />
              {MONTH_LABELS[month - 1]}
            </label>
          ))}
        </div>
      </details>

      <div className="space-y-2">
        <Label>許可する時間帯</Label>
        <WindowPicker
          name="allowedWindows"
          defaultValue={routine?.allowedWindows ?? [{ start: '05:00', end: '08:00' }]}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={routine?.isActive ?? true}
          className="size-4 accent-foreground"
        />
        有効にする（外すと設定を残したまま配置から除かれる）
      </label>

      <div className="flex items-center justify-end gap-3">
        {state.status === 'saved' && (
          <span className="text-sm text-muted-foreground">保存しました</span>
        )}
        <SubmitButton label={routine ? '変更を保存' : 'ルーティンを追加'} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? '保存中…' : label}
    </Button>
  );
}
