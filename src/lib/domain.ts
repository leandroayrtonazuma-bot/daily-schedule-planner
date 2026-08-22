/**
 * PLAN.md 4章のテーブルに対応するアプリ内の型。
 *
 * 列名は snake_case、こちらは camelCase。変換は保存層（src/lib/store/）で行い、
 * 配置ロジックと UI はこの形しか知らない。保存先が JSON ファイルでも Supabase でも
 * ここから先は同じ道を通る。
 */
import type { DateString } from './calendar/day';

/** 'HH:mm' */
export type TimeString = string;

/** 0=日曜 〜 6=土曜。Date#getDay と同じ並び */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 1が最優先（PLAN.md 4章） */
export type Priority = 1 | 2 | 3;

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: '高',
  2: '中',
  3: '低',
};

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** ルーティンを置いてよい時間帯 */
export type TimeWindow = {
  start: TimeString;
  end: TimeString;
};

/** 予定を入れない時間帯（睡眠・入浴・移動など） */
export type BlockedWindow = {
  id: string;
  userId: string;
  label: string;
  startTime: TimeString;
  endTime: TimeString;
  daysOfWeek: DayOfWeek[];
  /** 単発ブロック。指定時は daysOfWeek を無視する */
  specificDate: DateString | null;
  createdAt: string;
};

export type Routine = {
  id: string;
  userId: string;
  title: string;
  durationMinutes: number;
  timesPerDay: number;
  minGapMinutes: number;
  priority: Priority;
  daysOfWeek: DayOfWeek[];
  /** 1〜12。季節限定のルーティン用 */
  activeMonths: number[];
  allowedWindows: TimeWindow[];
  /** 一時停止。設定を残したまま配置から外す */
  isActive: boolean;
  /** 論理削除。過去の plans を壊さないため物理削除しない */
  archivedAt: string | null;
  createdAt: string;
};

export type TaskStatus = 'pending' | 'done' | 'skipped';

export type Task = {
  id: string;
  userId: string;
  title: string;
  estimatedMinutes: number;
  /** 完了時に入力された実測。estimate_factor の補正に使う */
  actualMinutes: number | null;
  priority: Priority;
  dueDate: DateString | null;
  status: TaskStatus;
  carryoverCount: number;
  source: 'manual' | 'ai';
  createdAt: string;
  completedAt: string | null;
};

/**
 * 保存される配置結果の1項目（PLAN.md 4章 plans.items）。
 * カレンダー予定（event）とブロック（blocked）は含めない。表示のたびに再取得して合成する。
 */
export type PlanItem = {
  kind: 'routine' | 'task' | 'break';
  /** routineId / taskId。break は null */
  refId: string | null;
  start: TimeString;
  end: TimeString;
  /** 手動で動かされたか。true の項目は再計算しても動かさない */
  pinned: boolean;
  /** そのルーティンの何回目か（1始まり） */
  occurrence?: number;
};

export type Plan = {
  id: string;
  userId: string;
  planDate: DateString;
  generatedAt: string;
  items: PlanItem[];
};

/** 今日だけこのルーティンを飛ばす */
export type RoutineSkip = {
  id: string;
  userId: string;
  routineId: string;
  skipDate: DateString;
};

export const ALL_DAYS_OF_WEEK: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
