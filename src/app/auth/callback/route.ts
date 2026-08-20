import { NextResponse, type NextRequest } from 'next/server';
import { getAppMode } from '@/lib/app-mode';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Google のログイン後に戻ってくる先。認可コードをセッションに交換する */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (getAppMode().mode === 'mock') {
    return NextResponse.redirect(`${origin}/`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
