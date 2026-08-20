/**
 * app_settings テーブルに対応する設定。
 *
 * Phase 1 の時点では DB を読まず、この既定値をそのまま使う。
 * Phase 2 で /settings 画面と CRUD を作り、ここは「DB が無いときの既定値」になる。
 * 値は PLAN.md 4章の DEFAULT と一致させておくこと。
 */
export type AppSettings = {
  workStart: string;
  workEnd: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  breakAfterMinutes: number;
  breakDurationMinutes: number;
  calendarId: string;
  includeAllDay: boolean;
  askCarryover: boolean;
  estimateFactor: number;
  timezone: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  workStart: '09:00',
  workEnd: '22:00',
  bufferBeforeMinutes: 10,
  bufferAfterMinutes: 10,
  breakAfterMinutes: 90,
  breakDurationMinutes: 15,
  calendarId: 'primary',
  includeAllDay: false,
  askCarryover: true,
  estimateFactor: 1.0,
  timezone: 'Asia/Tokyo',
};
