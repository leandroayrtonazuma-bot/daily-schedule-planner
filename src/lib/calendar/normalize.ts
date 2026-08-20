import type {
  BusyInterval,
  NormalizeOptions,
  NormalizedEvent,
  RawCalendarEvent,
} from './types';

const NO_TITLE = '(タイトルなし)';

/**
 * Google Calendar の生イベントを、当日分だけの NormalizedEvent[] に落とす。
 *
 * PLAN.md 5章の除外ルールをここに集約している。配置アルゴリズムはこの関数の
 * 出力だけを見ればよく、Google 固有の形を知らなくて済む。
 *
 * 前提: 入力は events.list を timeMin/timeMax = 当日で呼んだ結果であること。
 *       つまり渡ってくる予定はすべて当日と重なっている。終日予定を
 *       「当日いっぱい」として扱えるのはこの前提による。
 */
export function normalizeEvents(
  raw: readonly RawCalendarEvent[],
  options: NormalizeOptions,
): NormalizedEvent[] {
  const result: NormalizedEvent[] = [];

  for (const event of raw) {
    if (isExcluded(event)) continue;

    const allDay = isAllDay(event);
    if (allDay && !options.includeAllDay) continue;

    const span = allDay
      ? { start: options.dayStart, end: options.dayEnd }
      : timedSpan(event);
    if (!span) continue;

    // 日跨ぎ予定を当日の範囲に切り取る
    const start = laterOf(span.start, options.dayStart);
    const end = earlierOf(span.end, options.dayEnd);
    if (end.getTime() <= start.getTime()) continue;

    result.push({
      id: event.id,
      title: event.summary?.trim() || NO_TITLE,
      start: new Date(start),
      end: new Date(end),
      allDay,
    });
  }

  return result.sort(byStartThenId);
}

/**
 * 重複・隣接する予定をまとめ、「埋まっている時間帯」の一覧にする。
 * 空き時間の計算はこの結果を稼働時間から差し引いて行う。
 */
export function mergeBusyIntervals(events: readonly NormalizedEvent[]): BusyInterval[] {
  const sorted = [...events].sort(byStartThenId);
  const merged: BusyInterval[] = [];

  for (const event of sorted) {
    const last = merged[merged.length - 1];

    if (last && event.start.getTime() <= last.end.getTime()) {
      if (event.end.getTime() > last.end.getTime()) {
        last.end = new Date(event.end);
      }
      last.sourceIds.push(event.id);
      last.sourceIds.sort();
      continue;
    }

    merged.push({
      start: new Date(event.start),
      end: new Date(event.end),
      sourceIds: [event.id],
    });
  }

  return merged;
}

function isExcluded(event: RawCalendarEvent): boolean {
  if (event.status === 'cancelled') return true;
  // Google 上で「予定なし」に設定された予定は時間を占有しない
  if (event.transparency === 'transparent') return true;
  return isDeclinedBySelf(event);
}

function isDeclinedBySelf(event: RawCalendarEvent): boolean {
  return (event.attendees ?? []).some(
    (attendee) => attendee.self === true && attendee.responseStatus === 'declined',
  );
}

function isAllDay(event: RawCalendarEvent): boolean {
  return typeof event.start.date === 'string';
}

function timedSpan(event: RawCalendarEvent): { start: Date; end: Date } | null {
  if (!event.start.dateTime || !event.end.dateTime) return null;

  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return { start, end };
}

const laterOf = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);
const earlierOf = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);

/** 決定性のため、最終比較キーに必ず id を含める（PLAN.md 3.3） */
function byStartThenId(a: NormalizedEvent, b: NormalizedEvent): number {
  return (
    a.start.getTime() - b.start.getTime() ||
    a.end.getTime() - b.end.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
