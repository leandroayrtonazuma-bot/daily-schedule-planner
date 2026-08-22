import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { BlockedWindow, Plan, Routine, RoutineSkip, Task } from '@/lib/domain';
import type { AppSettings } from '@/lib/settings';

/**
 * ユーザーが作ったデータ（設定・ルーティン・タスク・計画）の保存先。
 *
 * Supabase を用意しなくても一日を組めるように、まずは JSON ファイル1つに置く。
 * Supabase 版に差し替えるときは src/lib/store/index.ts の中身だけを入れ替えれば済むよう、
 * ファイル操作はこのモジュールに閉じ込めてある。
 *
 * カレンダーの予定はここに一切入らない（PLAN.md 3.1）。
 */
export type UserData = {
  settings: Partial<AppSettings>;
  blockedWindows: BlockedWindow[];
  routines: Routine[];
  tasks: Task[];
  plans: Plan[];
  routineSkips: RoutineSkip[];
  /** 繰り越し確認を最後に出した日。'YYYY-MM-DD'（PLAN.md 7.2） */
  carryoverPromptedOn: string | null;
};

export type Database = {
  version: 1;
  users: Record<string, UserData>;
};

const DATA_DIRECTORY = 'data';
const DEFAULT_FILE = 'store.json';

export function emptyUserData(): UserData {
  return {
    settings: {},
    blockedWindows: [],
    routines: [],
    tasks: [],
    plans: [],
    routineSkips: [],
    carryoverPromptedOn: null,
  };
}

/**
 * 読み込み → 変更 → 書き込みを直列化する。
 * Server Actions は同時に走りうるので、読んだ直後に別の書き込みが挟まると
 * 片方の変更が消える。プロセス内の Promise を数珠つなぎにして防ぐ。
 */
let queue: Promise<unknown> = Promise.resolve();

export function withDatabase<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const db = await readDatabase();
    const result = await mutate(db);
    await writeDatabase(db);
    return result;
  });

  // 失敗しても後続を止めない
  queue = next.catch(() => undefined);

  return next;
}

/** 読むだけの操作。書き込みの途中の状態を見ないよう、同じ列に並べる */
export function readOnly<T>(read: (db: Database) => T): Promise<T> {
  const next = queue.then(async () => read(await readDatabase()));
  queue = next.catch(() => undefined);

  return next;
}

export function userData(db: Database, userId: string): UserData {
  const existing = db.users[userId];
  if (existing) return existing;

  const created = emptyUserData();
  db.users[userId] = created;

  return created;
}

/**
 * Vercel の関数実行環境は /var/task 以下が読み取り専用で、
 * data/ を作ろうとすると ENOENT で落ちる（実際にデプロイして確認した）。
 * 書き込めるのは /tmp だけなので、そこに逃がす。
 *
 * ただし /tmp は関数インスタンスが入れ替わると消える。モックモードは
 * 「外部サービス未設定でも動作確認できる」ためのものなので、Vercel 上での
 * 揮発性は許容する（本気で使うなら Supabase に切り替える）。
 */
export function resolveDataFilePath(): string {
  const override = process.env.SCHEDULE_DATA_FILE;
  if (override) return resolve(/* turbopackIgnore: true */ override);

  if (process.env.VERCEL) return join('/tmp', DATA_DIRECTORY, DEFAULT_FILE);

  // 既定は data/ の下に固定する。ここを動的にすると
  // Turbopack がプロジェクト全体を成果物に含めてしまう
  return join(process.cwd(), DATA_DIRECTORY, DEFAULT_FILE);
}

async function readDatabase(): Promise<Database> {
  try {
    // 保存先はユーザーが決める1ファイルだけ。追跡対象を広げる必要はない
    const raw = await readFile(/* turbopackIgnore: true */ resolveDataFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<Database>;

    return { version: 1, users: parsed.users ?? {} };
  } catch (error) {
    if (isNotFound(error)) return { version: 1, users: {} };
    throw error;
  }
}

async function writeDatabase(db: Database): Promise<void> {
  const path = resolveDataFilePath();
  await mkdir(dirname(path), { recursive: true });

  // 書き込み中に落ちてもファイルが壊れないよう、一時ファイル経由で差し替える
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}
