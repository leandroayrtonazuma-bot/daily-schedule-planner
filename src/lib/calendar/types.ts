/**
 * Google Calendar events.list のレスポンスのうち、本アプリが使う部分だけを型にしたもの。
 * モックデータもこの形で書く。
 */
export type RawCalendarEvent = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  /** 'transparent' は Google 上で「予定なし」扱い。占有時間に数えない */
  transparency?: 'opaque' | 'transparent';
  start: RawEventTime;
  end: RawEventTime;
  attendees?: RawAttendee[];
};

export type RawEventTime = {
  /** 時刻ありの予定。RFC3339 */
  dateTime?: string;
  /** 終日予定。'YYYY-MM-DD'。end.date は排他的（翌日を指す） */
  date?: string;
  timeZone?: string;
};

export type RawAttendee = {
  email?: string;
  /** 自分自身かどうか */
  self?: boolean;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
};

/**
 * 除外・切り取りを終えた、アプリ内で扱う唯一の予定表現。
 * start / end は必ず対象日の範囲内に収まっている。
 */
export type NormalizedEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

/** 重複する予定をまとめた「埋まっている時間帯」 */
export type BusyInterval = {
  start: Date;
  end: Date;
  /** この区間を構成した予定の id（昇順） */
  sourceIds: string[];
};

export type NormalizeOptions = {
  /** 対象日の 00:00（タイムゾーン適用済みの絶対時刻） */
  dayStart: Date;
  /** 対象日の 24:00（＝翌日 00:00） */
  dayEnd: Date;
  /** 終日予定を占有時間として含めるか（app_settings.include_all_day） */
  includeAllDay: boolean;
};
