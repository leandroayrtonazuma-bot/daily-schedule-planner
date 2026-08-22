import 'server-only';
import { parseDecomposition, type DraftTask } from '@/lib/decompose';

/**
 * Claude API によるタスク分解（PLAN.md 7.3 / Phase 5）。
 *
 * API キーはサーバー側の環境変数だけで扱い、クライアントには渡さない（PLAN.md 10.3）。
 * 'server-only' を import しているので、うっかりクライアントから読むとビルドが落ちる。
 *
 * ここが失敗しても、手入力フォームは常に動く（PLAN.md 8章 Phase 5 の完了条件）。
 * そのため例外は投げず、理由つきの結果を返す。
 */

const MODEL = 'claude-sonnet-5';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const TIMEOUT_MS = 30_000;
const MAX_INPUT_LENGTH = 4000;

export type DecomposeResult =
  | { ok: true; drafts: DraftTask[] }
  | { ok: false; reason: 'no-key' | 'empty-input' | 'api-error' | 'unparsable'; message: string };

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function decomposeTasks(input: string): Promise<DecomposeResult> {
  const text = input.trim().slice(0, MAX_INPUT_LENGTH);

  if (!text) {
    return { ok: false, reason: 'empty-input', message: '分解するテキストが空です。' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: 'no-key',
      message:
        'ANTHROPIC_API_KEY が設定されていないため、AI 分解は使えません。下のフォームから手で追加できます。',
    };
  }

  let raw: string;
  try {
    raw = await callClaude(apiKey, text);
  } catch (error) {
    return {
      ok: false,
      reason: 'api-error',
      message: `AI に接続できませんでした（${describe(error)}）。手で追加してください。`,
    };
  }

  const drafts = parseDecomposition(raw);
  if (drafts.length === 0) {
    return {
      ok: false,
      reason: 'unparsable',
      message: 'AI の返答からタスクを読み取れませんでした。手で追加してください。',
    };
  }

  return { ok: true, drafts };
}

async function callClaude(apiKey: string, text: string): Promise<string> {
  // 返答が返らないまま画面を固めないよう、必ず時間で打ち切る
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl()}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };

    return (body.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n');
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT = `あなたは、書き殴られたメモを実行可能なタスクに分解する道具です。

入力されたテキストを、1つずつ着手できる大きさのタスクに分解してください。

規則:
- 出力は JSON 配列のみ。前後に説明文を書かない
- 各要素は {"title": string, "estimatedMinutes": number, "priority": 1|2|3}
- title は日本語で、動詞で終わる具体的な行動にする（例:「章立てを決める」）
- estimatedMinutes は 5〜480 の整数。1つが2時間を超えるならさらに分割する
- priority は 1=高 2=中 3=低
- 入力に無い作業を創作しない。書かれている範囲だけを分解する
- 20件を超えない`;

/** 接続先。動作確認のためにスタブへ向けられるようにしてある */
function baseUrl(): string {
  return (process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function describe(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'タイムアウト';

  return error instanceof Error ? error.message : '原因不明';
}
