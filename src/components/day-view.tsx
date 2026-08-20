import { CalendarOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayEvents } from '@/lib/calendar';
import { formatDuration, formatTime, minutesBetween } from '@/lib/format';

export function DayView({ day }: { day: DayEvents }) {
  return (
    <div className="space-y-6">
      {day.allDayEvents.length > 0 && <AllDayStrip day={day} />}
      <EventList day={day} />
      {day.busy.length > 0 && <BusySummary day={day} />}
    </div>
  );
}

/** 終日予定はタイムライン内に置かず、上部の帯に出す（PLAN.md 7.1） */
function AllDayStrip({ day }: { day: DayEvents }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">終日</span>
      {day.allDayEvents.map((event) => (
        <Badge key={event.id} variant="secondary">
          {event.title}
        </Badge>
      ))}
    </div>
  );
}

function EventList({ day }: { day: DayEvents }) {
  if (day.events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarOff className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">確定した予定はありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          確定した予定
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {day.events.length}件
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {day.events.map((event) => (
          <div
            key={event.id}
            className="flex items-baseline gap-4 rounded-md px-2 py-2 hover:bg-muted/50"
          >
            <span className="w-28 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
              {formatTime(event.start, day.timezone)}–{formatTime(event.end, day.timezone)}
            </span>
            <span className="flex-1 text-sm">{event.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDuration(minutesBetween(event.start, event.end))}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * 重複をまとめた占有時間帯。Phase 3b の配置アルゴリズムはここから空きを求めるので、
 * マージが意図どおりかを目で確かめられるようにしておく。
 */
function BusySummary({ day }: { day: DayEvents }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">埋まっている時間帯</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {day.busy.map((interval) => (
          <div key={interval.start.toISOString()} className="flex items-baseline gap-4 px-2 py-1">
            <span className="w-28 shrink-0 font-mono text-sm tabular-nums">
              {formatTime(interval.start, day.timezone)}–{formatTime(interval.end, day.timezone)}
            </span>
            <span className="text-xs text-muted-foreground">
              {interval.sourceIds.length > 1
                ? `${interval.sourceIds.length}件の予定をまとめた区間`
                : '予定1件'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
