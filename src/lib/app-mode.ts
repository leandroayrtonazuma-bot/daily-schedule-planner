/**
 * live / mock の判定。
 *
 * Supabase と Google の設定が揃うまでは、アプリ全体をモックで動かす。
 * 環境変数を入れれば自動的に live に切り替わり、コードの書き換えは要らない。
 */
export type AppMode = 'live' | 'mock';

export type AppModeResult = {
  mode: AppMode;
  /** live に必要なのに未設定だった環境変数名 */
  missing: string[];
};

const REQUIRED_FOR_LIVE = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

type EnvLike = Record<string, string | undefined>;

export function resolveAppMode(env: EnvLike): AppModeResult {
  const missing = REQUIRED_FOR_LIVE.filter((key) => !isFilled(env[key]));
  const override = env.APP_MODE?.trim();

  if (override && override !== 'live' && override !== 'mock') {
    throw new Error(`APP_MODE は 'live' か 'mock' を指定してください: ${override}`);
  }

  if (override === 'live' && missing.length > 0) {
    throw new Error(`APP_MODE=live ですが次の環境変数が未設定です: ${missing.join(', ')}`);
  }

  if (override === 'mock' || missing.length > 0) {
    return { mode: 'mock', missing };
  }

  return { mode: 'live', missing: [] };
}

/** process.env から判定する。サーバー側でのみ呼ぶこと */
export function getAppMode(): AppModeResult {
  return resolveAppMode(process.env as EnvLike);
}

function isFilled(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
