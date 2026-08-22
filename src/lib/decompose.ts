import type { Priority } from '@/lib/domain';

/**
 * Claude の応答を、保存できる形のタスク候補に直す（PLAN.md 7.3 / Phase 5）。
 *
 * AI の出力は当てにできない。JSON でないこともあるし、説明文が前後についたり、
 * 見積が文字列だったり、優先度が範囲外だったりする。
 * ここでは**例外を投げず**、読めなかったものは黙って捨てて空配列を返す。
 * AI が落ちても手入力フォームが動き続けることが完了条件なので（PLAN.md 8章 Phase 5）。
 *
 * ここを通った後も、保存されるのは人が確認画面で「保存」を押したときだけ。
 */

/** 一度に受け取る上限。これ以上返してきたら打ち切る */
export const MAX_DRAFTS = 20;

const DEFAULT_MINUTES = 30;
const MIN_MINUTES = 5;
const MAX_MINUTES = 480;
const MAX_TITLE_LENGTH = 120;

export type DraftTask = {
  title: string;
  estimatedMinutes: number;
  priority: Priority;
};

export function parseDecomposition(raw: string): DraftTask[] {
  const parsed = extractJson(raw);
  if (!parsed) return [];

  // 配列で返ることもあれば {"tasks": [...]} で包んでくることもある
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { tasks?: unknown }).tasks)
      ? ((parsed as { tasks: unknown[] }).tasks)
      : null;

  if (!list) return [];

  return list
    .map(toDraft)
    .filter((draft): draft is DraftTask => draft !== null)
    .slice(0, MAX_DRAFTS);
}

function toDraft(value: unknown): DraftTask | null {
  if (typeof value !== 'object' || value === null) return null;

  const row = value as Record<string, unknown>;

  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!title) return null;

  return {
    title: title.slice(0, MAX_TITLE_LENGTH),
    estimatedMinutes: toMinutes(row.estimatedMinutes),
    priority: toPriority(row.priority),
  };
}

function toMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MINUTES;

  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(parsed)));
}

function toPriority(value: unknown): Priority {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (parsed === 1 || parsed === 3) return parsed;

  return 2;
}

/**
 * 応答から JSON を取り出す。まるごと JSON のこともあれば、
 * ```json ブロックに入っていたり、説明文に挟まれていたりする。
 */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (!text) return null;

  const candidates = [text, ...fencedBlocks(text), ...bracketed(text)];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch {
      // 次の候補を試す
    }
  }

  return null;
}

function fencedBlocks(text: string): string[] {
  return [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((match) => match[1].trim());
}

/** 最初の [ か { から、対応する最後の閉じ括弧までを切り出す */
function bracketed(text: string): string[] {
  const results: string[] = [];

  for (const [open, close] of [
    ['[', ']'],
    ['{', '}'],
  ] as const) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) results.push(text.slice(start, end + 1));
  }

  return results;
}
