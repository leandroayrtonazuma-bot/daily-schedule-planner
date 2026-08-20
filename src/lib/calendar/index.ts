import type { AppMode } from '@/lib/app-mode';
import type { AppSettings } from '@/lib/settings';
import { getDayRange, type DateString } from './day';
import { fetchGoogleEvents } from './google';
import { loadMockSpecs, materializeMockEvents } from './mock';
import { mergeBusyIntervals, normalizeEvents } from './normalize';
import type { BusyInterval, NormalizedEvent, RawCalendarEvent } from './types';

export type DayEvents = {
  date: DateString;
  timezone: string;
  mode: AppMode;
  /** 稼働時間の中に置かれる、時刻が決まった予定 */
  events: NormalizedEvent[];
  /** タイムライン外の上部帯に出す終日予定 */
  allDayEvents: NormalizedEvent[];
  /** 重複をまとめた占有時間帯。Phase 3b の配置アルゴリズムが使う */
  busy: BusyInterval[];
};

/**
 * 一日ぶんの予定を取得して正規化する。
 * live と mock の違いは「生イベントの出どころ」だけで、そこから先は同じ道を通る。
 */
export async function getDayEvents(params: {
  mode: AppMode;
  date: DateString;
  settings: AppSettings;
  accessToken?: string | null;
}): Promise<DayEvents> {
  const { date, settings } = params;
  const { dayStart, dayEnd } = getDayRange(date, settings.timezone);

  const raw = await loadRawEvents({ ...params, dayStart, dayEnd });

  const normalized = normalizeEvents(raw, {
    dayStart,
    dayEnd,
    includeAllDay: true, // 終日予定は除外せず、時刻ありと分けて返す
  });

  const allDayEvents = normalized.filter((event) => event.allDay);
  const events = normalized.filter((event) => !event.allDay);

  // 占有時間の計算に終日予定を含めるかは設定次第（PLAN.md 5章）
  const occupying = settings.includeAllDay ? normalized : events;

  return {
    date,
    timezone: settings.timezone,
    mode: params.mode,
    events,
    allDayEvents,
    busy: mergeBusyIntervals(occupying),
  };
}

async function loadRawEvents(params: {
  mode: AppMode;
  date: DateString;
  settings: AppSettings;
  accessToken?: string | null;
  dayStart: Date;
  dayEnd: Date;
}): Promise<RawCalendarEvent[]> {
  if (params.mode === 'mock' || !params.accessToken) {
    const specs = await loadMockSpecs();
    return materializeMockEvents(specs, params.date, params.settings.timezone);
  }

  return fetchGoogleEvents({
    accessToken: params.accessToken,
    calendarId: params.settings.calendarId,
    dayStart: params.dayStart,
    dayEnd: params.dayEnd,
    timeZone: params.settings.timezone,
  });
}

export { CalendarAuthError, CalendarFetchError } from './google';
export { getDayRange, todayInTimeZone } from './day';
export type { BusyInterval, NormalizedEvent } from './types';
