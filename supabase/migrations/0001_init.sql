-- 一日スケジュール自動生成アプリ 初期スキーマ
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルを貼り付けて実行する。
--
-- 認証は Supabase Auth（Google プロバイダ）を使う前提。
-- したがって user_id は auth.users(id) を参照し、RLS は auth.uid() で判定する。
-- PLAN.md の技術スタック表には Auth.js とあるが、同じ SQL の中で auth.users /
-- auth.uid() を使っており両立しない。Supabase Auth 側に統一した。
--
-- PLAN.md 3.1 の方針により、カレンダー予定のタイトルや ID はどのテーブルにも保存しない。

-- ---------------------------------------------------------------------------
-- 設定（ユーザーごとに1行）
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  work_start time not null default '09:00',
  work_end time not null default '22:00',
  buffer_before_minutes int not null default 10 check (buffer_before_minutes >= 0),
  buffer_after_minutes int not null default 10 check (buffer_after_minutes >= 0),
  break_after_minutes int not null default 90 check (break_after_minutes > 0),
  break_duration_minutes int not null default 15 check (break_duration_minutes >= 0),
  calendar_id text not null default 'primary',
  include_all_day boolean not null default false,
  ask_carryover boolean not null default true,
  estimate_factor numeric not null default 1.0 check (estimate_factor > 0),
  timezone text not null default 'Asia/Tokyo',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 予定を入れない時間帯
-- ---------------------------------------------------------------------------
create table if not exists blocked_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  start_time time not null,
  end_time time not null,
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',  -- 0=日曜
  specific_date date,          -- 単発ブロック用。指定時は days_of_week を無視
  created_at timestamptz not null default now()
);

create index if not exists blocked_windows_user_idx on blocked_windows (user_id);

-- ---------------------------------------------------------------------------
-- ルーティン
-- ---------------------------------------------------------------------------
create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  duration_minutes int not null check (duration_minutes > 0),
  times_per_day int not null default 1 check (times_per_day between 1 and 10),
  min_gap_minutes int not null default 0 check (min_gap_minutes >= 0),
  priority int not null default 2 check (priority between 1 and 3),  -- 1が最優先
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  active_months int[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  allowed_windows jsonb not null,   -- [{"start":"05:00","end":"08:00"}, ...]
  is_active boolean not null default true,
  archived_at timestamptz,          -- 論理削除
  created_at timestamptz not null default now()
);

-- 配置対象の絞り込みで毎回使う条件
create index if not exists routines_active_idx
  on routines (user_id)
  where archived_at is null and is_active;

-- ---------------------------------------------------------------------------
-- タスク
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  estimated_minutes int not null check (estimated_minutes > 0),
  actual_minutes int check (actual_minutes >= 0),
  priority int not null default 2 check (priority between 1 and 3),
  due_date date,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  carryover_count int not null default 0 check (carryover_count >= 0),
  source text not null default 'manual' check (source in ('manual','ai')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_pending_idx
  on tasks (user_id, due_date, priority)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 生成された一日の計画（1日1件）
-- ---------------------------------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  generated_at timestamptz not null default now(),
  -- PlanItem[]。kind は 'routine' | 'task' | 'break' のみ。
  -- カレンダー予定（event）とブロック（blocked）は保存しない（PLAN.md 3.1）
  items jsonb not null,
  unique (user_id, plan_date)
);

-- ---------------------------------------------------------------------------
-- 今日だけスキップしたルーティン
-- ---------------------------------------------------------------------------
create table if not exists routine_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  skip_date date not null,
  unique (routine_id, skip_date)
);

-- ---------------------------------------------------------------------------
-- RLS: 自分の行だけ読み書きできる
-- ---------------------------------------------------------------------------
alter table app_settings enable row level security;
alter table blocked_windows enable row level security;
alter table routines enable row level security;
alter table tasks enable row level security;
alter table plans enable row level security;
alter table routine_skips enable row level security;

drop policy if exists "own rows" on app_settings;
create policy "own rows" on app_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on blocked_windows;
create policy "own rows" on blocked_windows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on routines;
create policy "own rows" on routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on tasks;
create policy "own rows" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on plans;
create policy "own rows" on plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on routine_skips;
create policy "own rows" on routine_skips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 新規ユーザーに既定の設定行を作る
-- ---------------------------------------------------------------------------
create or replace function public.create_default_app_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_default_app_settings();
