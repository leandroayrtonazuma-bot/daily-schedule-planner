/**
 * 配置アルゴリズムの内部では、時刻を「その日の 00:00 からの分数」として扱う。
 *
 * Date のまま計算しないのは、
 *  - 比較・加減算が素直で、境界のずれが起きにくい
 *  - タイムゾーンやサマータイムの影響を配置ロジックに持ち込まずに済む
 * ため。絶対時刻への変換は入口（カレンダー）と出口（表示）だけで行う。
 */
export type Minutes = number;

/** 一日の長さ。work_end に 24:00 を指定できるよう、上限として許容する */
export const MINUTES_PER_DAY = 1440;

const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** 'HH:mm'（Postgres の time 型が返す 'HH:mm:ss' も可）を分数に変換する */
export function parseTime(value: string): Minutes {
  const matched = TIME_PATTERN.exec(value);
  if (!matched) {
    throw new Error(`時刻は HH:mm 形式で指定してください: ${JSON.stringify(value)}`);
  }

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);

  if (minutes > 59) {
    throw new Error(`分が範囲外です: ${value}`);
  }

  const total = hours * 60 + minutes;
  if (total > MINUTES_PER_DAY) {
    throw new Error(`時刻が一日の範囲を超えています: ${value}`);
  }

  return total;
}

/** 分数を 'HH:mm' に戻す。1440 は一日の終わりなので '24:00' */
export function formatMinutes(minutes: Minutes): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  return `${pad(hours)}:${pad(rest)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
