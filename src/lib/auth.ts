import { getAppMode } from './app-mode';
import { createSupabaseServerClient } from './supabase/server';

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** Google Calendar API 用。mock モードでは null */
  accessToken: string | null;
  isMock: boolean;
};

/** Supabase 未設定のときに使う固定ユーザー。UI の動作確認用 */
export const MOCK_USER: AppUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'mock@example.com',
  name: 'モックユーザー',
  avatarUrl: null,
  accessToken: null,
  isMock: true,
};

/**
 * 現在のログインユーザーを返す。未ログインなら null。
 * mock モードでは常に MOCK_USER を返し、ログインを素通りさせる。
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { mode } = getAppMode();
  if (mode === 'mock') return MOCK_USER;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // provider_token は Google API 用。Cookie 内のセッションから取る
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? '',
    name: (metadata.full_name as string) || (metadata.name as string) || user.email || 'ユーザー',
    avatarUrl: (metadata.avatar_url as string) ?? null,
    accessToken: session?.provider_token ?? null,
    isMock: false,
  };
}
