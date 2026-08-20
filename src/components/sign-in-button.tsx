'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** PLAN.md 2章のスコープ。書き込み系は要求しない */
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: SCOPES,
          redirectTo: `${window.location.origin}/auth/callback`,
          // リフレッシュトークンを受け取るために毎回同意画面を出す
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) throw error;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ログインに失敗しました');
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={signIn} disabled={pending} className="w-full">
        {pending ? 'Google に移動しています…' : 'Google でログイン'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
