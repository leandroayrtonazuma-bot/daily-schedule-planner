import { fromZonedTime } from 'date-fns-tz';
import { addDaysToDate, getDayRange, type DateString } from './day';
import type { RawAttendee, RawCalendarEvent } from './types';

/**
 * mocks/calendar-events.json に書く1件分の形式。
 * 対象日からの相対指定にしてあるので、いつ開いても「今日の予定」として現れる。
 */
export type MockEventSpec = {
  id: string;
  summary?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  transparency?: 'opaque' | 'transparent';
  attendees?: RawAttendee[];
  /** 終日予定にする場合は true。start / end は無視される */
  allDay?: boolean;
  /** 対象日を 0 とした相対日数。前日から始まるなら -1 */
  startOffsetDays?: number;
  /** 'HH:mm'。allDay でない場合は必須 */
  start?: string;
  /** 対象日を 0 とした相対日数。翌日まで続くなら 1 */
  endOffsetDays?: number;
  /** 'HH:mm'。allDay でない場合は必須 */
  end?: string;
  /** 人間向けのメモ。出力には含まれない */
  note?: string;
};

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * モック定義を Google Calendar API と同じ形に変換する。
 *
 * events.list を timeMin/timeMax = 対象日で呼んだときと同じになるよう、
 * 対象日と重ならない予定はここで落とす。normalizeEvents はこの前提に依存している。
 */
export function materializeMockEvents(
  specs: readonly MockEventSpec[],
  date: DateString,
  timeZone: string,
): RawCalendarEvent[] {
  const { dayStart, dayEnd } = getDayRange(date, timeZone);

  const events = specs
    .map((spec) => (spec.allDay ? buildAllDayEvent(spec, date) : buildTimedEvent(spec, date, timeZone)))
    .filter((event) => overlapsDay(event, date, dayStart, dayEnd));

  return events.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** サーバー側でモック定義ファイルを読み込む */
export async function loadMockSpecs(): Promise<MockEventSpec[]> {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const file = path.join(process.cwd(), 'mocks', 'calendar-events.json');
  const parsed = JSON.parse(await readFile(file, 'utf8')) as { events?: MockEventSpec[] };

  return parsed.events ?? [];
}

function buildAllDayEvent(spec: MockEventSpec, date: DateString): RawCalendarEvent {
  const startOffset = spec.startOffsetDays ?? 0;
  const endOffset = spec.endOffsetDays ?? startOffset + 1;

  return {
    ...common(spec),
    start: { date: addDaysToDate(date, startOffset) },
    end: { date: addDaysToDate(date, endOffset) },
  };
}

function buildTimedEvent(
  spec: MockEventSpec,
  date: DateString,
  timeZone: string,
): RawCalendarEvent {
  const start = instantOf(spec.start, spec.startOffsetDays ?? 0, date, timeZone, spec.id);
  const end = instantOf(spec.end, spec.endOffsetDays ?? 0, date, timeZone, spec.id);

  return {
    ...common(spec),
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
  };
}

function common(spec: MockEventSpec) {
  return {
    id: spec.id,
    status: spec.status ?? ('confirmed' as const),
    summary: spec.summary,
    ...(spec.transparency ? { transparency: spec.transparency } : {}),
    ...(spec.attendees ? { attendees: spec.attendees } : {}),
  };
}

function instantOf(
  time: string | undefined,
  offsetDays: number,
  date: DateString,
  timeZone: string,
  id: string,
): Date {
  if (!time || !TIME_PATTERN.test(time)) {
    throw new Error(`モック予定 "${id}" の時刻は HH:mm 形式で指定してください: ${time}`);
  }

  return fromZonedTime(`${addDaysToDate(date, offsetDays)}T${time}:00`, timeZone);
}

function overlapsDay(
  event: RawCalendarEvent,
  date: DateString,
  dayStart: Date,
  dayEnd: Date,
): boolean {
  if (event.start.date && event.end.date) {
    return event.start.date <= date && date < event.end.date;
  }

  const start = new Date(event.start.dateTime!).getTime();
  const end = new Date(event.end.dateTime!).getTime();

  return start < dayEnd.getTime() && end > dayStart.getTime();
}
