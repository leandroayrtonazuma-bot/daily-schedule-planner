# 一日スケジュール自動生成アプリ 開発計画書

## 0. このドキュメントについて

Claude Code にそのまま渡すことを想定した開発計画書。
実装時はこのファイルをプロジェクトルートに置き、Phase 単位で進行する。

---

## 1. 何を作るか

Google カレンダーの確定予定を土台に、**入れてはいけない時間**を除外し、**時間帯の決まったルーティン**を先に配置し、残った隙間にタスクを詰めて一日を組み上げる Web アプリ。

### 成功基準（KPI）

1. 朝の予定組みが **5分以内** で終わる
2. 生成した予定通りに **7割** 進む
3. 手動での配置修正が **1日3回以内**

この3つを満たさない場合、配置ロジックに欠陥があると判断して修正する。

### 扱う4種類の時間

| 種類 | 性質 | 出所 | 例 |
|---|---|---|---|
| 予定 (event) | 動かせない | Google Calendar API | 授業、打ち合わせ |
| ブロック (blocked) | 絶対に空ける | アプリ内で設定 | 移動時間、睡眠、入浴 |
| ルーティン (routine) | 時間帯と回数に制約あり | アプリ内で設定 | ランニング、食事 |
| タスク (task) | 隙間に自由配置 | アプリ内で入力 | LP修正、資料読み |

---

## 2. 技術スタック

| 領域 | 採用 |
|---|---|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| 認証 | Auth.js (NextAuth v5) Google Provider |
| DB | Supabase (Postgres) |
| UI | Tailwind CSS + shadcn/ui |
| 日付処理 | date-fns + date-fns-tz |
| AI | Claude API (claude-sonnet-4-6) — サーバー側 Route Handler 経由 |
| テスト | Vitest |
| ホスティング | Vercel |

### OAuth スコープ

```
openid
email
profile
https://www.googleapis.com/auth/calendar.readonly
```

書き込み系スコープは**要求しない**。

---

## 3. 最重要の設計方針

### 3.1 カレンダーの予定内容を DB に保存しない

Google のユーザーデータポリシー上のリスクを避けるため、予定は毎リクエストで API から取得し、サーバーのメモリ上でのみ扱う。DB に保存するのは自分が作成したタスク・ルーティン・設定・配置結果のみ。

`plans` テーブルにもカレンダー予定のタイトルや ID は保存しない。表示時に毎回 API から取得して合成する。

### 3.2 配置ロジックに AI を使わない

配置は純粋な決定論的アルゴリズムで行う。同じ入力なら必ず同じ出力になること。
Claude API を使うのは以下の2箇所のみ。

- 貼り付けテキストのタスク分解
- 一日の総評コメント（任意機能・失敗しても本体は動く）

### 3.3 決定性の保証

すべてのソートの最終比較キーに `id` を含める。乱数を使わない。

---

## 4. データモデル

Auth.js の標準テーブル（users / accounts / sessions / verification_tokens）に加えて以下を作成する。

```sql
-- 設定（ユーザーごとに1行）
create table app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  work_start time not null default '09:00',
  work_end time not null default '22:00',
  buffer_before_minutes int not null default 10,
  buffer_after_minutes int not null default 10,
  break_after_minutes int not null default 90,
  break_duration_minutes int not null default 15,
  calendar_id text not null default 'primary',
  include_all_day boolean not null default false,
  ask_carryover boolean not null default true,
  estimate_factor numeric not null default 1.0,
  timezone text not null default 'Asia/Tokyo',
  updated_at timestamptz not null default now()
);

-- 予定を入れない時間帯
create table blocked_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  start_time time not null,
  end_time time not null,
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',  -- 0=日曜
  specific_date date,          -- 単発ブロック用。指定時は days_of_week を無視
  created_at timestamptz not null default now()
);

-- ルーティン
create table routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  duration_minutes int not null check (duration_minutes > 0),
  times_per_day int not null default 1 check (times_per_day between 1 and 10),
  min_gap_minutes int not null default 0,
  priority int not null default 2 check (priority between 1 and 3),  -- 1が最優先
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  active_months int[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  allowed_windows jsonb not null,   -- [{"start":"05:00","end":"08:00"}, ...]
  is_active boolean not null default true,
  archived_at timestamptz,          -- 論理削除
  created_at timestamptz not null default now()
);

-- タスク
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  estimated_minutes int not null check (estimated_minutes > 0),
  actual_minutes int,
  priority int not null default 2 check (priority between 1 and 3),
  due_date date,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  carryover_count int not null default 0,
  source text not null default 'manual' check (source in ('manual','ai')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 生成された一日の計画（1日1件）
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  generated_at timestamptz not null default now(),
  items jsonb not null,   -- 後述。event は含めない
  unique (user_id, plan_date)
);

-- 今日だけスキップしたルーティン
create table routine_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  skip_date date not null,
  unique (routine_id, skip_date)
);
```

### plans.items の形式

```ts
type PlanItem = {
  kind: 'routine' | 'task' | 'break';
  refId: string | null;      // routine_id / task_id。break は null
  start: string;             // "HH:mm"
  end: string;               // "HH:mm"
  pinned: boolean;           // 手動でピン留めされたか
  occurrence?: number;       // ルーティンの何回目か
};
```

`event` と `blocked` は保存しない。表示のたびに API と DB から再取得して合成する。

### RLS

全テーブルで RLS を有効化し、以下のポリシーを設定する。

```sql
alter table <table> enable row level security;
create policy "own rows" on <table>
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`service_role` キーはサーバー側の環境変数にのみ置き、クライアントに露出させない。

---

## 5. カレンダー取得の仕様

`events.list` を以下のパラメータで呼ぶ。

```
calendarId: settings.calendar_id
timeMin:    当日 00:00 (Asia/Tokyo)
timeMax:    当日 24:00 (Asia/Tokyo)
singleEvents: true
orderBy: startTime
```

### 除外ルール（重要）

以下は「空き時間」として扱う。実装漏れが最も起きやすい箇所。

| 条件 | 扱い |
|---|---|
| `status === 'cancelled'` | 除外 |
| `transparency === 'transparent'` | 除外（Google 上で「予定なし」設定） |
| 自分の `attendees.responseStatus === 'declined'` | 除外 |
| 終日予定（`start.date` がある） | `include_all_day` が false なら除外 |
| 日跨ぎ予定 | 当日分のみに切り取る |

重複する予定は時間帯をマージして1つの占有ブロックとして扱う。

---

## 6. 配置アルゴリズム

### 6.1 全体の流れ

```
1. 稼働時間 [work_start, work_end] を初期の空きブロックとする
2. カレンダー予定を差し引く
3. 各予定の前後に buffer_before / buffer_after を差し引く   ← 移動時間対策
4. blocked_windows を差し引く
5. ルーティンを配置                                        ← タスクより必ず先
6. 残った空きにタスクを配置
7. 連続作業が break_after_minutes を超える箇所に休憩を挿入
8. ピン留め済みの項目は 5・6 の前に固定領域として確保する
```

### 6.2 ルーティン配置（ステップ5）

対象は `is_active = true` かつ `archived_at is null` かつ当日が `days_of_week` と `active_months` に含まれ、`routine_skips` に無いもの。

**配置順序**は以下でソートする（制約の強いものから置く）。

1. `allowed_windows` の合計幅 ÷ (`duration_minutes` × `times_per_day`) が小さい順
2. `priority` の昇順
3. `id` の昇順（決定性のため）

各ルーティンについて `times_per_day` 回ぶん、以下を満たす位置に置く。

- `allowed_windows` のいずれかに完全に収まる
- 空きブロックに完全に収まる
- 同一ルーティンの他の回と `min_gap_minutes` 以上離れている

候補が複数ある場合は **最も早い時刻** を選ぶ。

### 6.3 タスク配置（ステップ6）

対象は `status = 'pending'` のタスク。ソート順は以下。

1. `due_date` の昇順（null は最後）
2. `priority` の昇順
3. `estimated_minutes` の**降順**（大きいタスクを先に置く）
4. `id` の昇順

各タスクを、収まる空きブロックのうち**最も小さいブロック**に置く（Best-Fit）。これにより大きな空きが温存され、長時間タスクが入らなくなる問題を軽減する。

実際の所要時間には `estimated_minutes × settings.estimate_factor` を使う。

### 6.4 配置できなかった場合の段階的緩和

置けない項目が出たら、以下の順に緩和案をユーザーに**提示する**（自動適用はしない）。

1. 休憩時間を短縮する（15分 → 10分）
2. 予定前後のバッファを短縮する（10分 → 5分）
3. 優先度3のタスクを翌日に回す
4. ルーティンの許可時間帯を広げる

提示は具体的に行う。「入りませんでした」ではなく「バッファを5分にすればランニングが入ります」と表示する。

### 6.5 設定の妥当性検証

ルーティン保存時に `times_per_day × duration_minutes + (times_per_day - 1) × min_gap_minutes` が `allowed_windows` の合計幅を超えていないか検証し、超える場合は保存前にエラーを出す。

### 6.6 再計算（「今から組み直す」）

現在時刻より前の項目は一切変更しない。現在時刻以降の空き時間に対してのみ 5〜7 を再実行する。完了済み・ピン留め済みの項目は固定。

---

## 7. 画面仕様

### 7.1 `/` ホーム（今日のタイムライン）

- 縦軸に時間、`work_start` から `work_end` まで表示
- 予定＝グレー、ブロック＝斜線、ルーティン＝青、タスク＝優先度別の色、休憩＝薄い緑
- 終日予定は**タイムライン外の上部帯**に表示する
- 重複する予定は横並びに分割して描画
- 各項目をドラッグで移動できる。移動すると自動で**ピン留め**される
- 各項目に完了チェック。完了時に実測分の入力を求める（任意）
- ヘッダーに「今から組み直す」ボタン
- 初回アクセス時、未完了タスクがあれば**繰り越し確認ダイアログ**を出す（後述）
- 配置できなかった項目は下部に「今日は入りませんでした」として一覧表示し、緩和案を併記

### 7.2 繰り越し確認ダイアログ

その日最初のアクセス時、`status = 'pending'` かつ前日以前に作られたタスクがあれば表示する。

- タスクを一覧表示し、チェックボックスで個別に選択
- 「繰り越す」を選んだものは `carryover_count` を +1
- `carryover_count >= 3` のタスクには警告アイコンと「本当にやりますか？」の一文を添える
- 「今日はやらない」を選んだものは翌日以降も pending のまま残る

### 7.3 `/tasks` タスク管理

- タスクの一覧・追加・編集・削除
- 追加フォーム：タイトル、見積時間、優先度、締切
- 「まとめて貼り付け」ボタン → テキストエリア → Claude API で分解 → **確認画面で編集してから保存**
- AI 分解が失敗しても手入力フォームは常に動作すること

### 7.4 `/routines` ルーティン管理

必須要件。以下をすべて実装する。

- **追加**：タイトル、所要時間、1日の回数、最小間隔、優先度、曜日、有効月、許可時間帯（複数登録可）
- **編集**：既存ルーティンの全項目を変更可能
- **一時停止**：`is_active` のトグル。設定を残したまま today 以降の配置から外れる
- **削除**：`archived_at` を立てる論理削除。過去の `plans` を壊さない
- **複製**：既存ルーティンをコピーして新規作成
- 許可時間帯は **0〜24時の横棒を範囲選択する UI** で設定する（数値入力のみにしない）
- 一覧では停止中のルーティンをグレーアウトして下部に表示

### 7.5 `/settings` 設定

稼働時間、予定前後のバッファ、休憩の間隔と長さ、終日予定を含めるか、繰り越し確認の有無、ブロック時間帯の管理（追加・編集・削除）。

---

## 8. 開発フェーズ

| Phase | 内容 | 完了条件 |
|---|---|---|
| 0 | GCP 設定、Supabase 作成、Next.js 雛形、スキーマ適用 | `npm run dev` が起動する |
| 1 | Google ログイン → 当日の予定を一覧表示 | 自分の予定が画面に出る |
| 2 | 設定・ブロック時間帯の CRUD、RLS 確認 | 別アカウントから他人の行が見えない |
| 3a | ルーティン CRUD（停止・論理削除・複製を含む） | 全操作が動く |
| 3b | 配置アルゴリズム + タイムライン UI | ルーティンとタスクが正しく置かれる |
| 3c | ドラッグ移動、ピン留め、再計算、完了チェック | 手で直せる |
| **3.5** | **ドッグフーディング 1週間** | 下記 |
| 4 | 繰り越し確認ダイアログ、実測記録と `estimate_factor` 補正 | — |
| 5 | Claude API によるタスク分解 | AI が落ちても手入力は動く |
| 6 | PWA 化、Vercel デプロイ、友人をテストユーザー登録 | スマホのホーム画面から起動できる |

### Phase 3.5 の記録項目

毎日以下を記録し、Phase 4 に進む前に配置ロジックへ反映する。

1. 生成にかかった時間
2. その日の達成率
3. 手動で修正した回数と、その内容

手動修正が特定パターンに集中する場合、それは配置ロジックの欠陥である。

---

## 9. テスト方針

配置アルゴリズムには **Vitest で単体テストを書く**。これは省略しない。

最低限カバーするケース。

- 予定なし・タスクのみ
- 予定で1日が埋まっている
- ルーティンの許可時間帯が予定と完全に重なる
- `times_per_day = 3` かつ `min_gap` が厳しく、解が存在しない
- 大きいタスクと小さいタスクが混在（Best-Fit の検証）
- 日跨ぎ予定、終日予定、辞退済み予定の除外
- 同じ入力を2回流して同じ出力になること（決定性）
- 再計算時に過去の項目が変更されないこと

---

## 10. 運用上の注意

### 10.1 OAuth の 7日問題

同意画面が「テスト」状態の外部アプリでは、リフレッシュトークンが7日で失効する。
`invalid_grant` を検知したら再ログインを促すバナーを表示すること。サイレントに機能停止させない。

本格運用時はプライバシーポリシーと利用規約を用意して Google の審査を申請する。

### 10.2 友人への配布

- 配布前に対象者の Gmail アドレスをテストユーザーに登録する（上限100人）
- 「このアプリは確認されていません」という警告画面が出るため、**スクリーンショット付きの手順案内を添える**（「詳細」→「（アプリ名）に移動」）

### 10.3 秘密情報

- Claude API キーはサーバー側の環境変数のみ。クライアントに渡さない
- リフレッシュトークンは暗号化して保存する
- `SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` プレフィックスで公開しない

---

## 11. 事前準備チェックリスト

- [ ] Google Cloud Console でプロジェクト作成
- [ ] Google Calendar API を有効化
- [ ] OAuth 同意画面を「外部・テスト」で作成
- [ ] スコープに `calendar.readonly` を追加
- [ ] テストユーザーに自分と配布先のアドレスを登録
- [ ] OAuth クライアント ID（ウェブアプリケーション）を作成
- [ ] リダイレクト URI に `http://localhost:3000/api/auth/callback/google` を追加
- [ ] Supabase プロジェクト作成、上記スキーマを適用
- [ ] `.env.local` に各種キーを設定（`.gitignore` の確認）
