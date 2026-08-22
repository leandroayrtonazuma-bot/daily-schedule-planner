import { redirect } from 'next/navigation';
import { getAppMode, type AppMode } from './app-mode';
import { getCurrentUser, type AppUser } from './auth';
import type { AppSettings } from './settings';
import { getSettings } from './store';

export type Session = {
  user: AppUser;
  mode: AppMode;
  /** live に切り替えるために足りない環境変数 */
  missing: string[];
  settings: AppSettings;
};

/**
 * ログイン中のユーザーと設定をまとめて取る。未ログインならログイン画面へ送る。
 *
 * Server Component / Server Action の入口で必ずこれを通すこと。
 * ここを通さずに store を触ると、他人のデータに手が届いてしまう。
 */
export async function requireSession(): Promise<Session> {
  const { mode, missing } = getAppMode();

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return { user, mode, missing, settings: await getSettings(user.id) };
}
