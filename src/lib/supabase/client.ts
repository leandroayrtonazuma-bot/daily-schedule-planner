import { createBrowserClient } from '@supabase/ssr';

/** ブラウザ側用の Supabase クライアント。ログインボタンからのみ使う */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase の環境変数が設定されていません');
  }

  return createBrowserClient(url, anonKey);
}
