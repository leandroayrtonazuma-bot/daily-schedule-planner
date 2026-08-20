import type { RawCalendarEvent } from './types';

const API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * アクセストークンが失効している状態。
 * PLAN.md 10.1 の「7日問題」もここに落ちてくるので、
 * 画面側はこれを握りつぶさず再ログインを促すこと。
 */
export class CalendarAuthError extends Error {
  constructor(message = 'Google カレンダーへのアクセス権が切れています') {
    super(message);
    this.name = 'CalendarAuthError';
  }
}

export class CalendarFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CalendarFetchError';
  }
}

/**
 * events.list を PLAN.md 5章のパラメータで呼ぶ。
 * 除外や切り取りはここでは一切やらない（normalizeEvents の担当）。
 */
export async function fetchGoogleEvents(params: {
  accessToken: string;
  calendarId: string;
  dayStart: Date;
  dayEnd: Date;
  timeZone: string;
}): Promise<RawCalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin: params.dayStart.toISOString(),
    timeMax: params.dayEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    timeZone: params.timeZone,
  });

  const url = `${API_BASE}/calendars/${encodeURIComponent(params.calendarId)}/events?${query}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    throw new CalendarAuthError();
  }

  if (!response.ok) {
    throw new CalendarFetchError(
      `カレンダーの取得に失敗しました (HTTP ${response.status})`,
      response.status,
    );
  }

  const body = (await response.json()) as { items?: RawCalendarEvent[] };

  return body.items ?? [];
}
