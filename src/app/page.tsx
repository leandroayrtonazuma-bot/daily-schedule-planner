import { redirect } from 'next/navigation';
import { DayView } from '@/components/day-view';
import { ModeBanner } from '@/components/mode-banner';
import { SignOutButton } from '@/components/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { getAppMode } from '@/lib/app-mode';
import { getCurrentUser } from '@/lib/auth';
import { CalendarAuthError, getDayEvents, todayInTimeZone } from '@/lib/calendar';
import { formatDateHeading } from '@/lib/format';
import { DEFAULT_SETTINGS } from '@/lib/settings';

// カレンダーは毎リクエストで取得する（PLAN.md 3.1: 予定内容を保存しない）
export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { mode, missing } = getAppMode();

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const settings = DEFAULT_SETTINGS;
  const { date: requestedDate } = await searchParams;
  const date = requestedDate ?? todayInTimeZone(settings.timezone);

  let day = null;
  let authExpired = false;

  try {
    day = await getDayEvents({ mode, date, settings, accessToken: user.accessToken });
  } catch (error) {
    if (!(error instanceof CalendarAuthError)) throw error;
    authExpired = true;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{formatDateHeading(date)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            稼働時間 {settings.workStart}–{settings.workEnd} ／ {settings.timezone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === 'mock' ? 'outline' : 'secondary'}>
            {mode === 'mock' ? 'モック' : user.email}
          </Badge>
          {mode === 'live' && <SignOutButton />}
        </div>
      </header>

      {mode === 'mock' && <ModeBanner missing={missing} />}

      {authExpired ? <ReauthNotice /> : day && <DayView day={day} />}
    </main>
  );
}

/** PLAN.md 10.1: トークン失効をサイレントに握りつぶさない */
function ReauthNotice() {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">Google カレンダーへのアクセス権が切れています</p>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        一度ログアウトして、もう一度 Google でログインしてください。
        テスト状態の OAuth アプリでは、リフレッシュトークンが7日で失効します。
      </p>
    </div>
  );
}
