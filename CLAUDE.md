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
| 2 | 設定・ブロック時間帯の CRUD | 完了（RLS は Supabase 上で有効化を確認済み） |
| 3a | ルーティン CRUD（停止・論理削除・複製・範囲選択 UI） | 完了 |
| 3b | 配置アルゴリズム + タイムライン UI | 完了 |
| 3c | ドラッグ移動、ピン留め、再計算、完了チェック | 完了 |
| 4 | 繰り越し確認ダイアログ、実測記録と estimate_factor 補正 | 完了 |
| 5 | Claude API によるタスク分解 | 完了（キー未設定でも手入力は動く） |
| 6 | PWA 化、Vercel デプロイ | 完了（<https://daily-schedule-planner-ten.vercel.app>） |
| **3.5** | **ドッグフーディング1週間** | **← 次はここ** |

Google Cloud と Supabase は**設定済み**（2026-08-28）。ローカルは `.env.local` があるので live モード。
本番（Vercel）は環境変数を入れるまでモックモードのままなので注意。

| 項目 | 値 |
|---|---|
| Supabase プロジェクト | `daily-schedule-planner` / ref `ebwhxlumwngnokmnpvdw`（Tokyo, Free） |
| Supabase URL | `https://ebwhxlumwngnokmnpvdw.supabase.co` |
| GCP プロジェクト | `daily-schedule-planner-506708` |
| OAuth クライアント | `supabase-auth`（ウェブアプリケーション） |
| コールバック URL | `https://ebwhxlumwngnokmnpvdw.supabase.co/auth/v1/callback` |

機能はひととおり揃った。**残っているのは実際に使うことだけ。**
PLAN.md 8章はドッグフーディングを Phase 4 の前に置いているが、実装を先に終えた。
順序を入れ替えただけで、省いてはいない。**1週間使ってから次に触ること。**
毎日 (1)生成にかかった時間 (2)達成率 (3)手動修正の回数と内容 を記録する。
手動修正が特定のパターンに集中していたら、それは配置ロジックの欠陥。先にそちらを直す。

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

4. **ユーザーデータの保存先はモードで切り替える。**
   live は Supabase（`src/lib/store/supabase-store.ts`）、mock は JSON ファイル
   （`data/store.json` / `src/lib/store/file-store.ts`）。呼び分けは `src/lib/store/index.ts` の
   `impl()` だけが行い、画面と Server Actions はモードを意識しない。
   両者は同じ関数シグネチャを保つこと。`data/` は `.gitignore` 済み。

5. **ブロック時間帯の日跨ぎは「前日ぶんの朝」も塞ぐ。**
   23:00–07:00 の睡眠を登録したとき、当日の 23:00–24:00 だけでなく 00:00–07:00 も埋める。
   これを落とすと睡眠中の朝にルーティンが置かれる（実際に一度そうなった）。
   曜日指定つきの場合、朝の部分は**前日**が対象曜日のときだけ効く。

6. **estimate_factor の補正は自動適用しない。**
   PLAN.md 8章は「実測記録と estimate_factor 補正」としか書いていない。
   実測から中央値を出して**提案**し、押されたときだけ設定に入れる方式にした。
   配置結果が黙って変わるのが、この手の補正で一番困る事故なので。

7. **Service Worker は HTML をキャッシュしない。**
   ページにはカレンダーの予定内容が載っており、PLAN.md 3.1 は保存を禁じている。
   Cache Storage に入れればそれは端末への保存にあたる。
   `public/sw.js` が扱うのは静的ファイルだけ。**オフラインで一日を組む機能は無い。**

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
node scripts/generate-icons.mjs   # アイコンを描き直したとき
```

### 環境変数

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 揃うと live モードに入る |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用。`NEXT_PUBLIC_` を付けない（PLAN.md 10.3） |
| `ANTHROPIC_API_KEY` | AI 分解。無ければボタンが無効になるだけ |
| `ANTHROPIC_BASE_URL` | 動作確認用にスタブへ向ける。通常は未設定 |
| `APP_MODE=mock` | 環境変数が揃っていても強制的にモックで動かす |
| `SCHEDULE_DATA_FILE` | JSON の保存先を移す |
| `VERCEL` | Vercel が自動で立てる。モックモードの保存先を `/tmp` に切り替える（下記） |

### Vercel にモックモードのままデプロイする場合

Vercel の関数実行環境は `/var/task` 以下が読み取り専用で、`data/store.json` を
作ろうとすると `ENOENT: no such file or directory, mkdir '/var/task/data'` で落ちる。
**実際にデプロイして踏んだ。**

`file-db.ts` の `resolveDataFilePath()` が `VERCEL` 環境変数を見て `/tmp` に逃がすので、
モックモードなら追加設定なしでそのまま動く。ただし `/tmp` は関数インスタンスが
入れ替わると消える揮発性のストレージ。**動作確認以上の用途では Supabase に切り替えること。**

---

## ディレクトリ

```
PLAN.md                        要件定義（正）
CLAUDE.md                      このファイル
mocks/calendar-events.json     ダミー予定。相対日指定なのでいつ開いても「今日」に出る
data/store.json                ユーザーデータの保存先（gitignore 済み。消せば初期状態に戻る）
public/icon.svg                アイコンの原本。PNG は scripts/generate-icons.mjs で作る
public/sw.js                   Service Worker（静的ファイルだけ。HTML は触らない）
scripts/generate-icons.mjs     icon.svg → PNG（192/512/apple-touch）
supabase/migrations/           DB スキーマ。Supabase の SQL Editor に貼って適用する
tests/                         Vitest
src/
  app/
    page.tsx                   今日のタイムライン
    actions.ts                 組み直し・ピン留め・ドラッグ移動・当日スキップ
    manifest.ts                PWA マニフェスト
    settings/                  設定とブロック時間帯（PLAN.md 7.5）
    routines/                  ルーティン CRUD（PLAN.md 7.4）
    tasks/                     タスク CRUD と AI 分解（PLAN.md 7.3）
    login/page.tsx             ログイン（live のみ。mock では / へ素通り）
    auth/callback/route.ts     Google からの戻り先
    api/calendar/today/        予定取得 API（クライアント側から再取得する用）
  components/
    timeline.tsx               ★タイムライン。ドラッグ移動・完了・スキップ
    carryover-dialog.tsx       繰り越し確認（PLAN.md 7.2）
    task-paste.tsx             まとめて貼り付け → AI 分解 → 確認画面
    service-worker.tsx         sw.js の登録（本番のみ）
    window-picker.tsx          許可時間帯の横棒（PLAN.md 7.4 の必須要件）
    routine-form.tsx           ルーティンの追加・編集
    weekday-picker.tsx         曜日の選択
    skipped-routines.tsx       当日スキップの取り消し
    day-view.tsx               予定の一覧表示（Phase 1 の名残。API の確認用）
    mode-banner.tsx            モックモードの警告
    ui/                        shadcn/ui。手で編集しない
  lib/
    app-mode.ts                live / mock の判定
    auth.ts                    getCurrentUser()
    session.ts                 requireSession()。画面と Server Action の入口
    domain.ts                  テーブルに対応するアプリ内の型
    carryover.ts               繰り越し候補の抽出と、確認を出すかの判定
    estimate.ts                実測から estimate_factor を割り出す
    decompose.ts               AI の応答 → タスク候補（当てにせず検証する）
    ai/claude.ts               Claude API の呼び出し。server-only
    settings.ts                app_settings の既定値
    form.ts                    FormData の読み取り
    format.ts                  時刻・所要時間の表示
    day-plan.ts                カレンダー＋保存データ→画面用のデータに束ねる
    timeline-layout.ts         重なる項目の列割り当て
    store/
      index.ts                 ★読み書きの窓口。Supabase 版への差し替え点
      file-db.ts               JSON ファイルの入出力と書き込みの直列化
    supabase/                  クライアント生成
    calendar/
      types.ts                 Raw / Normalized の型
      day.ts                   タイムゾーン込みの日付範囲
      normalize.ts             ★除外・切り取り・マージ
      google.ts                events.list の呼び出し
      mock.ts                  モック定義 → Raw 形式への変換
      index.ts                 live / mock を束ねる入口
      dto.ts                   JSON 受け渡し用の変換
    planner/
      index.ts                 ★buildPlan。6章の全体の流れと緩和案
      time.ts                  'HH:mm' ↔ 00:00 からの分
      intervals.ts             区間の差集合・積集合
      blocked.ts               ブロック時間帯 → 区間
      routines.ts              ルーティンの配置順と配置、保存前の検証
      tasks.ts                 タスクの配置順と Best-Fit
      breaks.ts                休憩の挿入
      now.ts                   現在時刻（配置ロジック本体は現在時刻を読まない）
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

### 6. 配置ロジックは現在時刻を読まない
`buildPlan` の中で `new Date()` を呼ばない。再計算の基準時刻は `fromMinutes` として
外から渡す。これを守らないと「同じ入力なら同じ出力」がテストできなくなる。

### 7. 画面と配置で同じ関数を使う
タイムラインに出す区間と、空き時間の計算に使う区間は同じ関数から作る
（例: `blockedSpansForDate`）。別々に書くと「画面には出ていないのに置けない」ずれが出る。

### 8. `<input type="number">` に `step` を安易に付けない
`min={1} step={5}` と書くと、ブラウザが認めるのは 1, 6, 11… だけになる。
30 のような値が「不正」と判定され、**submit が何のエラーも出さずに黙って止まる**。
実際にこれで AI 分解の保存が動かなくなった（原因究明に時間を取られた）。
分は 1 刻み、係数は 0.01 刻みにしてある。値の刻みを制限したくなったらサーバー側で丸めること。

### 9. AI が落ちても手入力は動く
PLAN.md 8章 Phase 5 の完了条件。`decomposeTasks` は例外を投げず、
理由つきの結果を返す。キーが無ければボタンを無効にして理由を出すだけで、
`/tasks` の手入力フォームには一切影響させない。

---

## 作業の進め方

- **配置ロジックとカレンダー処理は TDD。** 先にテストを書き、落ちるのを見てから実装する。
  PLAN.md 9章のテスト方針は省略しない。
- 新しい純粋関数は `src/lib/` に置き、`tests/` にテストを足す。
  React コンポーネントにロジックを埋め込まない。
- `npm test` と `npm run build` が両方通る状態を保つ。警告も残さない。
- ファイルを消す前に必ず確認を取る。整理は削除より移動を優先。
- 画面の確認はブラウザで実際に触って行う。テストが通ることと、使えることは別。

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
2. `supabase/migrations/` の SQL を**番号順にすべて** SQL Editor で実行する
   （現在は `0001_init.sql` と `0002_carryover_prompted_on.sql` の2本。`0001` だけでは
   `app_settings.carryover_prompted_on` が無く、繰り越し確認が動かない）
3. Authentication → Providers → Google を有効化し、上で作ったクライアント ID / シークレットを入れる
4. Authentication → URL Configuration の Redirect URLs に
   `http://localhost:3000/**` と本番 URL の `/**` を追加
5. `.env.local.example` を `.env.local` にコピーして URL と anon key を入れる

> **Google のクライアントシークレットは作成直後のダイアログでしか表示されない。**
> 閉じてしまったら再表示はできないので、クライアント詳細から新しいシークレットを追加し直す。

### 動作確認
`npm run dev` → モックバナーが消え、ログイン画面が出れば live モードに入っている。

---

## 本番（Vercel）

GitHub の `main` に push すると自動でデプロイされる。URL は
<https://daily-schedule-planner-ten.vercel.app>。

**本番を live モードにするには Vercel 側にも環境変数が要る**
（Project → Settings → Environment Variables に `NEXT_PUBLIC_SUPABASE_URL` と
`NEXT_PUBLIC_SUPABASE_ANON_KEY` を Production / Preview / Development すべてに登録 → Redeploy）。
入れるまではモックモードのまま動くので、**本番を見て「動いている」と判断しないこと。**
判別はモックバナーの有無で行う。

---

## 既知の注意点

- **OAuth の7日問題**（PLAN.md 10.1）: 同意画面が「テスト」状態だとリフレッシュトークンが7日で失効する。
  `CalendarAuthError` を投げて再ログインを促すところまでは実装済み。サイレントに止めないこと。
- **リフレッシュトークンは自前で保存していない。** Google のアクセストークンは
  Supabase セッションの `provider_token` から都度取るだけ（`src/lib/auth.ts`）。
  PLAN.md 10.3 の「暗号化して保存する」は、**保存しないことで満たしている**。
  自前の保存を足したくなったら、暗号化とセットでなければ入れないこと。
  ただしこの方式には未検証の点がある: Supabase がセッションを更新したあとも
  `provider_token` が残るかはドッグフーディングで確かめる。消えるなら
  カレンダーが読めなくなり `CalendarWarning` が出る。**出たら記録すること。**
- `src/components/ui/` は shadcn/ui が生成したもの。原則手で編集せず、`npx shadcn@latest add` で足す。
