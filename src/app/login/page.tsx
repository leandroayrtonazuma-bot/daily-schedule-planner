import { redirect } from 'next/navigation';
import { SignInButton } from '@/components/sign-in-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAppMode } from '@/lib/app-mode';
import { getCurrentUser } from '@/lib/auth';

// 環境変数の状態で表示が変わるため、ビルド時に固めない
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { mode, missing } = getAppMode();

  // mock モードではログインの必要が無いので素通りさせる
  if (mode === 'mock') redirect('/');

  const user = await getCurrentUser();
  if (user) redirect('/');

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>一日スケジュール</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Google カレンダーの予定を読み取ります。予定の追加や変更は行いません。
          </p>

          <SignInButton />

          {error && (
            <p className="text-sm text-destructive">ログインできませんでした: {error}</p>
          )}

          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">未設定: {missing.join(', ')}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
