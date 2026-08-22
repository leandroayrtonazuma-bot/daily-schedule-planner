'use client';

import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TimeWindow } from '@/lib/domain';
import { normalizeIntervals, subtractIntervals, type Interval } from '@/lib/planner/intervals';
import { formatMinutes, MINUTES_PER_DAY, parseTime } from '@/lib/planner/time';

/** 15分刻みで吸着させる。1分単位で選べても実用上うれしくない */
const STEP = 15;

/**
 * ルーティンの許可時間帯を選ぶ横棒（PLAN.md 7.4）。
 *
 * 棒の上をドラッグすると、その範囲が許可時間帯になる。
 * 選択済みの帯をもう一度ドラッグでなぞると、その部分を取り消す。
 * 数値入力も併設してあるが、主役は棒のほう。
 *
 * 値は hidden input に JSON で入れて送る。
 */
export function WindowPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: readonly TimeWindow[];
}) {
  const [windows, setWindows] = useState<Interval[]>(() => toIntervals(defaultValue));
  const [drag, setDrag] = useState<{ from: number; to: number; remove: boolean } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  function minutesAt(clientX: number): number {
    const bar = barRef.current;
    if (!bar) return 0;

    const rect = bar.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const raw = ratio * MINUTES_PER_DAY;

    return clamp(Math.round(raw / STEP) * STEP);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const at = minutesAt(event.clientX);
    // すでに選択済みの場所から始めたら「取り消し」の操作にする
    const remove = windows.some((window) => window.start <= at && at < window.end);

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from: at, to: at, remove });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setDrag({ ...drag, to: minutesAt(event.clientX) });
  }

  function handlePointerUp() {
    if (!drag) return;

    const start = Math.min(drag.from, drag.to);
    const end = Math.max(drag.from, drag.to);
    // 点で終わったときは最小1コマぶんを選んだものとして扱う
    const span = { start, end: end > start ? end : Math.min(MINUTES_PER_DAY, start + STEP) };

    setWindows((current) =>
      drag.remove
        ? subtractIntervals(current, [span])
        : normalizeIntervals([...current, span]),
    );
    setDrag(null);
  }

  function addByNumbers(startValue: string, endValue: string) {
    try {
      const span = { start: parseTime(startValue), end: parseTime(endValue) };
      if (span.end <= span.start) return;

      setWindows((current) => normalizeIntervals([...current, span]));
    } catch {
      // 時刻として読めないものは無視する
    }
  }

  const preview = drag
    ? { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) }
    : null;

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(toWindows(windows))} readOnly />

      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-12 w-full touch-none select-none overflow-hidden rounded-md border bg-muted/40"
        role="group"
        aria-label="許可する時間帯"
      >
        {windows.map((window) => (
          <div
            key={`${window.start}-${window.end}`}
            className="absolute inset-y-0 bg-primary/25"
            style={styleFor(window)}
          />
        ))}

        {preview && preview.end > preview.start && (
          <div
            className={
              drag?.remove
                ? 'absolute inset-y-0 bg-destructive/30'
                : 'absolute inset-y-0 bg-primary/50'
            }
            style={styleFor(preview)}
          />
        )}

        {/* 3時間ごとの目盛り */}
        {Array.from({ length: 9 }, (_, index) => index * 3).map((hour) => (
          <div
            key={hour}
            className="pointer-events-none absolute inset-y-0 border-l border-border/70 first:border-l-0"
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            <span className="absolute top-0.5 left-1 text-[10px] text-muted-foreground">
              {hour}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        棒の上をドラッグすると許可時間帯になる。色の付いた部分をなぞると取り消せる（15分刻み）
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {windows.length === 0 ? (
          <span className="text-sm text-muted-foreground">未設定</span>
        ) : (
          windows.map((window) => (
            <span
              key={`${window.start}-${window.end}`}
              className="inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 font-mono text-xs tabular-nums"
            >
              {formatMinutes(window.start)}–{formatMinutes(window.end)}
              <button
                type="button"
                onClick={() => setWindows((current) => subtractIntervals(current, [window]))}
                className="rounded-full p-0.5 hover:bg-muted"
                aria-label={`${formatMinutes(window.start)}から${formatMinutes(window.end)}を削除`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <NumericAdder onAdd={addByNumbers} />
    </div>
  );
}

function NumericAdder({ onAdd }: { onAdd: (start: string, end: string) => void }) {
  const [start, setStart] = useState('05:00');
  const [end, setEnd] = useState('08:00');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="time"
        value={start}
        onChange={(event) => setStart(event.target.value)}
        className="w-32"
        aria-label="追加する時間帯の開始"
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="time"
        value={end}
        onChange={(event) => setEnd(event.target.value)}
        className="w-32"
        aria-label="追加する時間帯の終了"
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => onAdd(start, end)}>
        時刻で追加
      </Button>
    </div>
  );
}

function styleFor(interval: Interval): React.CSSProperties {
  return {
    left: `${(interval.start / MINUTES_PER_DAY) * 100}%`,
    width: `${((interval.end - interval.start) / MINUTES_PER_DAY) * 100}%`,
  };
}

function toIntervals(windows: readonly TimeWindow[]): Interval[] {
  const intervals: Interval[] = [];

  for (const window of windows) {
    try {
      intervals.push({ start: parseTime(window.start), end: parseTime(window.end) });
    } catch {
      // 壊れた値は捨てる
    }
  }

  return normalizeIntervals(intervals);
}

function toWindows(intervals: readonly Interval[]): TimeWindow[] {
  return intervals.map((interval) => ({
    start: formatMinutes(interval.start),
    end: formatMinutes(interval.end),
  }));
}

function clamp(value: number): number {
  return Math.min(MINUTES_PER_DAY, Math.max(0, value));
}
