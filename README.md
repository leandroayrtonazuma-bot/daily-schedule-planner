# 一日スケジュール自動生成アプリ

Google カレンダーの確定予定を土台に、入れてはいけない時間を除外し、ルーティンを先に配置し、
残った隙間にタスクを詰めて一日を組み上げる Web アプリ。

- 要件定義: [`PLAN.md`](./PLAN.md)
- 開発上の決定事項と進め方: [`CLAUDE.md`](./CLAUDE.md)

## 動かす

```bash
npm install
npm run dev
```

<http://localhost:3000> を開く。

環境変数を設定していない間は**モックモード**で動く。
Google カレンダーには接続せず、[`mocks/calendar-events.json`](./mocks/calendar-events.json) の
ダミー予定を表示する。ログインも不要。

実データに切り替える手順は `CLAUDE.md` の「Phase 2 以降に入る前の準備」を参照。

## 開発

```bash
npm test        # Vitest
npm run build   # 本番ビルド（型チェック込み）
npx eslint .    # Lint
```

## 現在のフェーズ

Phase 1 まで完了。ログインと当日の予定表示ができる。
配置アルゴリズム（ルーティン・タスクの自動配置）は Phase 3b で実装する。
