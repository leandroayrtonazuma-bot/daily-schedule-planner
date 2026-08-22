-- 繰り越し確認ダイアログ（PLAN.md 7.2）を、その日最初のアクセス時にだけ出すための列。
--
-- 「今日すでに確認済みか」を保存する。app_settings はユーザーごとに1行しか無いので、
-- ここに載せる。適用方法は 0001_init.sql と同じく SQL Editor に貼って実行する。

alter table app_settings
  add column if not exists carryover_prompted_on date;
