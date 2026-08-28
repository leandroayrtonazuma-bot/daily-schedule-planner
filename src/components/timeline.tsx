'use client';

import { Check, Pin, PinOff, SkipForward } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { movePlanItemAction, togglePinAction, toggleRoutineSkipAction } from '@/app/actions';
import { setTaskStatusAction } from '@/app/tasks/actions';
import type { TimelineEntry } from '@/lib/day-plan';
import { formatDuration } from '@/lib/format';
import { formatMinutes, type Minutes } from '@/lib/planner/time';
import { layoutTimeline } from '@/lib/timeline-layout';
import { cn } from '@/lib/utils';

/** 1分あたりの高さ(px)。9:00–22:00 でおよそ 940px になる */
const PX_PER_MINUTE = 1.2;
const SNAP = 15;
const GUTTER = 'calc(3.5rem + 0.5rem)';

/** ドラッグで動かせるのは自分で置いた項目だけ。予定とブロックは動かせない */
const MOVABLE = new Set<TimelineEntry['kind']>(['routine', 'task', 'break']);

const STYLES: Record<TimelineEntry['kind'], string> = {
  event: 'border-slate-400/50 bg-slate-200/70 text-slate-900 dark:bg-slate-700/60 dark:text-slate-100',
  blocked:
    'border-neutral-400/50 text-neutral-600 dark:text-neutral-300 [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,var(--color-muted-foreground)_5px,var(--color-muted-foreground)_6px)] [background-color:var(--color-muted)]',
  routine: 'border-blue-500/50 bg-blue-100 text-blue-950 dark:bg-blue-950/70 dark:text-blue-100',
  task: 'border-amber-500/50 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100',
  break: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
};

/** タスクは優先度で色を変える（PLAN.md 7.1） */
const TASK_STYLES: Record<number, string> = {
  1: 'border-red-500/50 bg-red-100 text-red-950 dark:bg-red-950/60 dark:text-red-100',
  2: 'border-amber-500/50 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100',
  3: 'border-slate-400/50 bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
};

export function Timeline({
  date,
  entries,
  workStart,
  workEnd,
  nowMinutes,
}: {
  date: string;
  entries: TimelineEntry[];
  workStart: number;
  workEnd: number;
  /** 今日を見ているときだけ渡す。現在時刻の線を引く */
  nowMinutes: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [drag, setDrag] = useState<{ key: string; offset: number } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  /**
   * 離した瞬間に置いた位置。サーバーの応答（往復で1秒近くかかる）を待たずに描く。
   * サーバーから新しい entries が来たら捨てて、正となる位置で描き直す。
   */
  const [moved, setMoved] = useState<Record<string, Minutes>>({});
  const [seenEntries, setSeenEntries] = useState(entries);
  if (seenEntries !== entries) {
    setSeenEntries(entries);
    setMoved({});
  }

  // 稼働時間の外にある予定も隠さずに出す
  const viewStart = Math.min(workStart, ...entries.map((entry) => entry.start), workStart);
  const viewEnd = Math.max(workEnd, ...entries.map((entry) => entry.end), workEnd);

  const laid = layoutTimeline(entries);
  const height = (viewEnd - viewStart) * PX_PER_MINUTE;

  function top(minutes: number): number {
    return (minutes - viewStart) * PX_PER_MINUTE;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>, entry: TimelineEntry) {
    if (!MOVABLE.has(entry.kind)) return;

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ key: entry.key, offset: event.clientY - rect.top });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>, entry: TimelineEntry) {
    if (drag?.key !== entry.key) return;

    const surface = surfaceRef.current;
    if (!surface) return;

    // プレビューのために DOM を直接動かす。確定は pointerup で行う
    const y = event.clientY - surface.getBoundingClientRect().top - drag.offset;
    event.currentTarget.style.top = `${Math.max(0, y)}px`;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>, entry: TimelineEntry) {
    if (drag?.key !== entry.key) return;

    const surface = surfaceRef.current;
    setDrag(null);
    if (!surface) return;

    const y = event.clientY - surface.getBoundingClientRect().top - drag.offset;
    const raw = viewStart + y / PX_PER_MINUTE;
    const snapped = Math.round(raw / SNAP) * SNAP;

    if (snapped === entry.start) {
      // 動かなかったときだけ元の位置に戻す
      event.currentTarget.style.top = `${top(entry.start)}px`;
      return;
    }

    // 置いた位置のまま描き続ける。サーバーの結果が返ったら差し替わる
    setMoved((current) => ({ ...current, [entry.key]: Math.max(0, snapped) }));

    const form = new FormData();
    form.set('date', date);
    form.set('at', formatMinutes(entry.start));
    form.set('kind', entry.kind);
    form.set('refId', entry.refId ?? '');
    form.set('to', String(Math.max(0, snapped)));

    startTransition(() => movePlanItemAction(form));
  }

  function togglePin(entry: TimelineEntry) {
    const form = new FormData();
    form.set('date', date);
    form.set('at', formatMinutes(entry.start));
    form.set('kind', entry.kind);
    form.set('refId', entry.refId ?? '');

    startTransition(() => togglePinAction(form));
  }

  /** タスクの完了チェック（PLAN.md 7.1）。実測は /tasks で入れる */
  function toggleDone(entry: TimelineEntry) {
    if (!entry.refId) return;

    const form = new FormData();
    form.set('id', entry.refId);
    form.set('status', entry.status === 'done' ? 'pending' : 'done');

    startTransition(() => setTaskStatusAction(form));
  }

  /** 今日だけこのルーティンを飛ばす */
  function skipRoutine(entry: TimelineEntry) {
    if (!entry.refId) return;

    const form = new FormData();
    form.set('date', date);
    form.set('routineId', entry.refId);
    form.set('skipped', 'true');

    startTransition(() => toggleRoutineSkipAction(form));
  }

  return (
    <div className="relative">
      <div className="relative" style={{ height }}>
        <HourGrid viewStart={viewStart} viewEnd={viewEnd} workStart={workStart} workEnd={workEnd} />

        <div ref={surfaceRef} className="absolute inset-0" style={{ marginLeft: GUTTER }}>
          {nowMinutes != null && nowMinutes >= viewStart && nowMinutes <= viewEnd && (
            <div
              className="pointer-events-none absolute right-0 left-0 z-20 border-t-2 border-red-500"
              style={{ top: top(nowMinutes) }}
            >
              <span className="absolute -top-2.5 -left-1 size-2 rounded-full bg-red-500" />
            </div>
          )}

          {laid.map((entry) => {
            const movable = MOVABLE.has(entry.kind);
            const minutes = entry.end - entry.start;
            const start = moved[entry.key] ?? entry.start;
            const saving = pending && moved[entry.key] != null;

            return (
              <div
                key={entry.key}
                onPointerDown={(event) => handlePointerDown(event, entry)}
                onPointerMove={(event) => handlePointerMove(event, entry)}
                onPointerUp={(event) => handlePointerUp(event, entry)}
                onPointerCancel={(event) => handlePointerUp(event, entry)}
                className={cn(
                  'absolute overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm',
                  colorFor(entry),
                  movable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-default',
                  drag?.key === entry.key && 'z-30 opacity-80 shadow-lg',
                  saving && 'z-20 ring-2 ring-foreground/20',
                  entry.status === 'done' && 'opacity-50',
                )}
                style={{
                  top: top(start),
                  height: Math.max(18, minutes * PX_PER_MINUTE - 2),
                  left: `${(entry.column / entry.columns) * 100}%`,
                  width: `calc(${100 / entry.columns}% - 4px)`,
                }}
                title={`${formatMinutes(start)}–${formatMinutes(start + minutes)} ${entry.title}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      'truncate font-medium',
                      entry.status === 'done' && 'line-through',
                    )}
                  >
                    {entry.title}
                  </span>
                  {movable && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      {entry.kind === 'task' && (
                        <IconButton
                          onClick={() => toggleDone(entry)}
                          label={entry.status === 'done' ? '未完了に戻す' : '完了にする'}
                          active={entry.status === 'done'}
                        >
                          <Check className="size-3" />
                        </IconButton>
                      )}
                      {entry.kind === 'routine' && (
                        <IconButton
                          onClick={() => skipRoutine(entry)}
                          label="今日はスキップする"
                        >
                          <SkipForward className="size-3" />
                        </IconButton>
                      )}
                      <IconButton
                        onClick={() => togglePin(entry)}
                        label={entry.pinned ? 'ピン留めを外す' : 'ピン留めする'}
                        active={entry.pinned}
                      >
                        {entry.pinned ? <Pin className="size-3" /> : <PinOff className="size-3" />}
                      </IconButton>
                    </span>
                  )}
                </div>
                {minutes >= 30 && (
                  <p className="font-mono tabular-nums opacity-70">
                    {formatMinutes(start)}–{formatMinutes(start + minutes)}（
                    {formatDuration(minutes)}）
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** ブロック内の小さな操作ボタン。ドラッグに巻き込まれないよう pointerdown を止める */
function IconButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn('rounded p-0.5 hover:bg-black/10', active ? 'opacity-100' : 'opacity-40')}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function HourGrid({
  viewStart,
  viewEnd,
  workStart,
  workEnd,
}: {
  viewStart: number;
  viewEnd: number;
  workStart: number;
  workEnd: number;
}) {
  const firstHour = Math.floor(viewStart / 60);
  const lastHour = Math.ceil(viewEnd / 60);
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 稼働時間の外を薄く沈める */}
      <div
        className="absolute right-0 left-0 bg-muted/40"
        style={{ top: 0, height: Math.max(0, (workStart - viewStart) * PX_PER_MINUTE) }}
      />
      <div
        className="absolute right-0 left-0 bg-muted/40"
        style={{
          top: (workEnd - viewStart) * PX_PER_MINUTE,
          height: Math.max(0, (viewEnd - workEnd) * PX_PER_MINUTE),
        }}
      />

      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute right-0 left-0 border-t border-border/60"
          style={{ top: (hour * 60 - viewStart) * PX_PER_MINUTE }}
        >
          <span className="absolute -top-2 left-0 w-14 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(hour).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  );
}

function colorFor(entry: TimelineEntry): string {
  if (entry.kind === 'task' && entry.priority) return TASK_STYLES[entry.priority];

  return STYLES[entry.kind];
}
