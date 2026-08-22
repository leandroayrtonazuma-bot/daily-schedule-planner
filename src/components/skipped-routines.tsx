import { Undo2 } from 'lucide-react';
import { toggleRoutineSkipAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import type { Routine } from '@/lib/domain';

/**
 * 今日だけ飛ばしたルーティン。戻せる場所が無いと片道になってしまうので、
 * タイムラインの下に必ず出す。
 */
export function SkippedRoutines({
  date,
  routines,
  skippedIds,
}: {
  date: string;
  routines: readonly Routine[];
  skippedIds: readonly string[];
}) {
  const skipped = routines.filter((routine) => skippedIds.includes(routine.id));
  if (skipped.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <span className="text-xs font-medium text-muted-foreground">今日はスキップ</span>
      {skipped.map((routine) => (
        <form key={routine.id} action={toggleRoutineSkipAction}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="routineId" value={routine.id} />
          <input type="hidden" name="skipped" value="false" />
          <Button type="submit" variant="outline" size="sm">
            <Undo2 className="size-3" />
            {routine.title}
          </Button>
        </form>
      ))}
    </div>
  );
}
