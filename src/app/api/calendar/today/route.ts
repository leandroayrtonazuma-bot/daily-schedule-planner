import { NextResponse, type NextRequest } from 'next/server';
import { getAppMode } from '@/lib/app-mode';
import { getCurrentUser } from '@/lib/auth';
import { CalendarAuthError, getDayEvents, todayInTimeZone } from '@/lib/calendar';
import { toDayEventsDto } from '@/lib/calendar/dto';
import { DEFAULT_SETTINGS } from '@/lib/settings';

// アクセストークンをクライアントに渡さないため、取得は必ずここを通す
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const settings = DEFAULT_SETTINGS;
  const date =
    new URL(request.url).searchParams.get('date') ?? todayInTimeZone(settings.timezone);

  try {
    const day = await getDayEvents({
      mode: getAppMode().mode,
      date,
      settings,
      accessToken: user.accessToken,
    });

    return NextResponse.json(toDayEventsDto(day));
  } catch (error) {
    if (error instanceof CalendarAuthError) {
      // PLAN.md 10.1: サイレントに機能停止させず、再ログインを促す
      return NextResponse.json({ error: 'reauth_required' }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : 'カレンダーの取得に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
