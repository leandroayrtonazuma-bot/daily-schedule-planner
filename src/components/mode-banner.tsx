import { AlertTriangle } from 'lucide-react';

/**
 * モックモードで動いていることを常に見せる。
 * 実データと取り違えたまま配置ロジックを評価してしまうのを防ぐため、
 * 目立つ位置に出して消せないようにしている。
 */
export function ModeBanner({ missing }: { missing: string[] }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        モックモードで動作中
      </p>
      <p className="mt-2 leading-relaxed">
        表示されている予定は <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">mocks/calendar-events.json</code>{' '}
        のダミーデータです。Google カレンダーには接続していません。
      </p>
      {missing.length > 0 && (
        <p className="mt-2 leading-relaxed">
          実データに切り替えるには <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">.env.local</code> に{' '}
          {missing.join(' と ')} を設定してください。
        </p>
      )}
    </div>
  );
}
