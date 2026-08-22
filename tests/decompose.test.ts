import { describe, expect, it } from 'vitest';
import { MAX_DRAFTS, parseDecomposition } from '@/lib/decompose';

describe('parseDecomposition', () => {
  it('素直な JSON 配列を読む', () => {
    const raw = '[{"title":"資料の骨子を書く","estimatedMinutes":30,"priority":1}]';

    expect(parseDecomposition(raw)).toEqual([
      { title: '資料の骨子を書く', estimatedMinutes: 30, priority: 1 },
    ]);
  });

  it('前後に説明文がついていても取り出す', () => {
    const raw = `わかりました。以下に分解します。

\`\`\`json
[{"title":"下調べ","estimatedMinutes":45,"priority":2}]
\`\`\`

以上です。`;

    expect(parseDecomposition(raw)).toEqual([
      { title: '下調べ', estimatedMinutes: 45, priority: 2 },
    ]);
  });

  it('{"tasks": [...]} の形でも読む', () => {
    const raw = '{"tasks":[{"title":"下調べ","estimatedMinutes":45}]}';

    expect(parseDecomposition(raw)).toEqual([
      { title: '下調べ', estimatedMinutes: 45, priority: 2 },
    ]);
  });

  it('タイトルが無い項目は捨てる', () => {
    const raw = '[{"estimatedMinutes":30},{"title":"有効","estimatedMinutes":30}]';

    expect(parseDecomposition(raw).map((t) => t.title)).toEqual(['有効']);
  });

  it('タイトルの前後の空白を落とす', () => {
    const raw = '[{"title":"  下調べ  ","estimatedMinutes":30}]';

    expect(parseDecomposition(raw)[0].title).toBe('下調べ');
  });

  it('見積が無ければ 30 分にする', () => {
    expect(parseDecomposition('[{"title":"a"}]')[0].estimatedMinutes).toBe(30);
  });

  it('見積が文字列でも数字なら読む', () => {
    expect(parseDecomposition('[{"title":"a","estimatedMinutes":"45"}]')[0].estimatedMinutes).toBe(
      45,
    );
  });

  it('見積を現実的な範囲に丸める', () => {
    expect(parseDecomposition('[{"title":"a","estimatedMinutes":0}]')[0].estimatedMinutes).toBe(5);
    expect(parseDecomposition('[{"title":"a","estimatedMinutes":9999}]')[0].estimatedMinutes).toBe(
      480,
    );
  });

  it('見積は整数にする', () => {
    expect(parseDecomposition('[{"title":"a","estimatedMinutes":32.7}]')[0].estimatedMinutes).toBe(
      33,
    );
  });

  it('範囲外の優先度は 2 にする', () => {
    expect(parseDecomposition('[{"title":"a","priority":9}]')[0].priority).toBe(2);
    expect(parseDecomposition('[{"title":"a","priority":0}]')[0].priority).toBe(2);
  });

  it('件数が多すぎるときは打ち切る', () => {
    const many = Array.from({ length: MAX_DRAFTS + 5 }, (_, i) => `{"title":"t${i}"}`);

    expect(parseDecomposition(`[${many.join(',')}]`)).toHaveLength(MAX_DRAFTS);
  });

  it('JSON でなければ空配列を返す（例外を投げない）', () => {
    expect(parseDecomposition('すみません、分解できませんでした')).toEqual([]);
  });

  it('壊れた JSON でも空配列を返す', () => {
    expect(parseDecomposition('[{"title":')).toEqual([]);
  });

  it('空文字でも空配列を返す', () => {
    expect(parseDecomposition('')).toEqual([]);
  });

  it('配列でもオブジェクトでもなければ空配列', () => {
    expect(parseDecomposition('42')).toEqual([]);
  });

  it('長すぎるタイトルは切り詰める', () => {
    const long = 'あ'.repeat(300);

    expect(parseDecomposition(`[{"title":"${long}"}]`)[0].title).toHaveLength(120);
  });
});
