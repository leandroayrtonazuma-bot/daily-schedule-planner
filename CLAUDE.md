@AGENTS.md

# 一日スケジュール自動生成アプリ

Google カレンダーの確定予定を土台に、入れてはいけない時間を除外し、ルーティンを先に配置し、
残った隙間にタスクを詰めて一日を組み上げる Web アプリ。

**要件定義は `PLAN.md` が正**。このファイルは「実装上の決定事項」と「作業の進め方」を記録する。
両者が食い違ったら、下の「PLAN.md からの逸脱」を先に読むこと。

---

## 現在地

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | Next.js 雛形、スキーマ用意 | 完了 |
| 1 | ログイン → 当日の予定を一覧表示 | 完了（モックモードで動作） |
| 2 | 設定・ブロック時間帯の CRUD、RLS 確認 | 未着手 |
| 3a | ルーティン CRUD | 未着手 |
| 3b | 配置アルゴリズム + タイムライン UI | 未着手 |
| 3c | ドラッグ移動、ピン留め、再計算、完了チェック | 未着手 |
| 3.5 | ドッグフーディング1週間 | 未着手 |
| 4〜6 | 繰り越し、AI 分解、PWA、デプロイ | 未着手 |

Google Cloud と Supabase は**まだ未設定**。そのためアプリはモックモードで動いている。

---

## PLAN.md からの逸脱（合意済み）

1. **認証は Supabase Auth に統一した。**
   PLAN.md の技術スタック表は Auth.js (NextAuth v5) だが、同じ文書の SQL が `auth.users` を参照し
   RLS に `auth.uid()` を使っており両立しない。SQL 側に合わせた。
   Google のアクセストークンは Supabase セッションの `provider_token` から取る。

2. **Next.js は 16 系。**
   PLAN.md は 15 と書いているが、これは計画時点の最新版を指したものと解釈した。
   App Router の使い方は変わらない。Next 16 では `middleware.ts` が非推奨なので `src/proxy.ts` を使う。

3. **モックモードを追加した。**
   PLAN.md には無い仕組み。外部サービス未設定でも配置ロジックと UI を検証できるようにするため。
   実データに切り替わったら消すのではなく、**回帰確認用に残す**。

---

## 動作モード

環境変数の有無で自動的に切り替わる。判定は `src/lib/app-mode.ts` の `resolveAppMode`。

| モード | 条件 | 認証 | カレンダー |
|---|---|---|---|
| `mock` | Supabase の環境変数が未設定 | 固定ユーザー（`MOCK_USER`） | `mocks/calendar-events.json` |
| `live` | `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が揃っている | Supabase Auth (Google) | Google Calendar API |

`APP_MODE=mock` を書けば、環境変数が揃っていても強制的にモックで動く。

**モックモード中は画面上部に必ず黄色いバナーが出る。** これを消してはいけない。
ダミーデータを実データと取り違えたまま配置ロジックを評価するのが、この設計で唯一怖い事故。

---

## コマンド

```bash
npm run dev        # 開発サーバー http://localhost:3000
npm test           # Vitest（配置ロジックのテスト。省略しない）
npm run test:watch
npm run build      # 本番ビルド。型チェックも走る
npx eslint .       # Lint
```

---

## ディレクトリ

```
PLAN.md                        要件定義（正）
CLAUDE.md                      このファイル
mocks/calendar-events.json     ダミー予定。相対日指定なのでいつ開いても「今日」に出る
supabase/migrations/           DB スキーマ。Supabase の SQL Editor に貼って適用する
tests/                         Vitest
src/
  app/
    page.tsx                   今日の予定
    login/page.tsx             ログイン（live のみ。mock では / へ素通り）
    auth/callback/route.ts     Google からの戻り先
    api/calendar/today/        予定取得 API（クライアント側から再取得する用）
  components/
    day-view.tsx               予定の表示
    mode-banner.tsx            モックモードの警告
    ui/                        shadcn/ui。手で編集しない
  lib/
    app-mode.ts                live / mock の判定
    auth.ts                    getCurrentUser()
    settings.ts                app_settings の既定値（Phase 2 で DB 化）
    format.ts                  時刻・所要時間の表示
    supabase/                  クライアント生成
    calendar/
      types.ts                 Raw / Normalized の型
      day.ts                   タイムゾーン込みの日付範囲
      normalize.ts             ★除外・切り取り・マージ
      google.ts                events.list の呼び出し
      mock.ts                  モック定義 → Raw 形式への変換
      index.ts                 live / mock を束ねる入口
      dto.ts                   JSON 受け渡し用の変換
  proxy.ts                     Supabase セッションの更新（live のみ）
```

---

## 設計上、崩してはいけない点

### 1. カレンダーの予定内容を DB に保存しない
PLAN.md 3.1。予定は毎リクエストで取得し、サーバーのメモリ上でのみ扱う。
`plans.items` にもカレンダー予定のタイトルや ID を入れない。
ページは `dynamic = 'force-dynamic'`。キャッシュさせない。

### 2. 配置ロジックに AI を使わない
PLAN.md 3.2。決定論的アルゴリズムのみ。Claude API はタスク分解と総評コメントだけ。

### 3. 決定性
PLAN.md 3.3。**すべてのソートの最終比較キーに `id` を含める。乱数を使わない。**
`normalize.ts` の `byStartThenId` がその例。新しいソートを書くときは必ず倣うこと。

### 4. アクセストークンをクライアントに渡さない
カレンダー取得は Server Component か Route Handler の中だけで行う。

### 5. `normalizeEvents` の前提
入力は「対象日と重なる予定だけ」であること（`events.list` を timeMin/timeMax = 当日で
呼んだ結果と同じ状態）。終日予定を「当日いっぱい」として扱えるのはこの前提による。
モック側では `materializeMockEvents` が同じ絞り込みを行っている。

---

## 作業の進め方

- **配置ロジックとカレンダー処理は TDD。** 先にテストを書き、落ちるのを見てから実装する。
  PLAN.md 9章のテスト方針は省略しない。
- 新しい純粋関数は `src/lib/` に置き、`tests/` にテストを足す。
  React コンポーネントにロジックを埋め込まない。
- `npm test` と `npm run build` が両方通る状態を保つ。警告も残さない。
- ファイルを消す前に必ず確認を取る。整理は削除より移動を優先。

---

## Phase 2 以降に入る前の準備

外部サービスは未設定。実データで動かすには以下が必要。

### Google Cloud
1. プロジェクトを作成し、**Google Calendar API** を有効化
2. OAuth 同意画面を「外部・テスト」で作成
3. スコープに `.../auth/calendar.readonly` を追加
4. テストユーザーに自分と配布先のアドレスを登録（上限100人）
5. OAuth クライアント ID（ウェブアプリケーション）を作成
6. 承認済みリダイレクト URI に **Supabase のコールバック URL** を登録
   （`https://<プロジェクト>.supabase.co/auth/v1/callback`）
   ※ Supabase Auth 経由なので、`localhost:3000/api/auth/callback/google` ではない

### Supabase
1. プロジェクトを作成
2. `supabase/migrations/0001_init.sql` を SQL Editor で実行
3. Authentication → Providers → Google を有効化し、上で作ったクライアント ID / シークレットを入れる
4. Authentication → URL Configuration の Redirect URLs に `http://localhost:3000/auth/callback` を追加
5. `.env.local.example` を `.env.local` にコピーして URL と anon key を入れる

### 動作確認
`npm run dev` → モックバナーが消え、ログイン画面が出れば live モードに入っている。

---

## 既知の注意点

- **OAuth の7日問題**（PLAN.md 10.1）: 同意画面が「テスト」状態だとリフレッシュトークンが7日で失効する。
  `CalendarAuthError` を投げて再ログインを促すところまでは実装済み。サイレントに止めないこと。
- `provider_token` は Supabase のセッション Cookie に入る。Phase 2 以降でトークンの
  リフレッシュ運用（PLAN.md 10.3 の暗号化保存）を詰める必要がある。
- `src/components/ui/` は shadcn/ui が生成したもの。原則手で編集せず、`npx shadcn@latest add` で足す。
