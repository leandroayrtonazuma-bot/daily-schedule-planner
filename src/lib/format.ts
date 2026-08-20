import { formatInTimeZone } from 'date-fns-tz';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 指定タイムゾーンでの HH:mm */
export function formatTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'HH:mm');
}

/** 所要時間を「1時間30分」の形にする */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;

  return `${hours}時間${rest}分`;
}

/** 'YYYY-MM-DD' を「2026年8月21日(金)」にする。実行環境のタイムゾーンに依存しない */
export function formatDateHeading(date: string): string {
  const utc = new Date(`${date}T00:00:00Z`);

  const year = utc.getUTCFullYear();
  const month = utc.getUTCMonth() + 1;
  const day = utc.getUTCDate();
  const weekday = WEEKDAYS[utc.getUTCDay()];

  return `${year}年${month}月${day}日(${weekday})`;
}

/** 2つの時刻の差を分で返す */
export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}
