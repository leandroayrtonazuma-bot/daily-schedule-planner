/**
 * 画面遷移中に出す骨組み。
 *
 * 全ページが dynamic（ログイン Cookie を見る）なので Next.js は prefetch できず、
 * loading.tsx が無いとサーバーの応答が返るまで画面が一切変わらない。
 * 押しても何も起きないように見えるのが「重い」の正体だったので、
 * 中身が来るまでの数百ミリ秒をここで埋める。
 */
export function PageSkeleton({ title, rows = 3 }: { title: string; rows?: number }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8" aria-busy>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
      </header>

      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-lg border bg-muted/40"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>

      <span className="sr-only">読み込み中</span>
    </main>
  );
}
