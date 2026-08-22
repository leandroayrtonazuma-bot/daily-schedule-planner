import { describe, expect, it } from 'vitest';
import { MIN_SAMPLES, suggestEstimateFactor } from '@/lib/estimate';
import { makeTask } from './helpers/factories';

/** 見積 est 分・実測 act 分の完了済みタスク */
function measured(id: string, est: number, act: number) {
  return makeTask({ id, estimatedMinutes: est, actualMinutes: act, status: 'done' });
}

describe('suggestEstimateFactor', () => {
  it('実測が見積の1.5倍なら 1.5 を返す', () => {
    const tasks = [measured('a', 60, 90), measured('b', 40, 60), measured('c', 20, 30)];

    expect(suggestEstimateFactor(tasks)?.factor).toBe(1.5);
  });

  it('件数が足りなければ提案しない', () => {
    const tasks = Array.from({ length: MIN_SAMPLES - 1 }, (_, i) => measured(`t${i}`, 60, 90));

    expect(suggestEstimateFactor(tasks)).toBeNull();
  });

  it('実測が入っていないタスクは数に入れない', () => {
    const tasks = [
      measured('a', 60, 90),
      measured('b', 60, 90),
      makeTask({ id: 'no-actual', status: 'done', actualMinutes: null }),
    ];

    expect(suggestEstimateFactor(tasks)).toBeNull();
  });

  it('未完了のタスクは数に入れない', () => {
    const tasks = [
      measured('a', 60, 90),
      measured('b', 60, 90),
      makeTask({ id: 'pending', status: 'pending', actualMinutes: 90 }),
    ];

    expect(suggestEstimateFactor(tasks)).toBeNull();
  });

  it('極端な1件に引きずられない（中央値を使う）', () => {
    const tasks = [
      measured('a', 60, 60), // 1.0
      measured('b', 60, 60), // 1.0
      measured('c', 60, 600), // 10.0 — 事故。ここに引っ張られてはいけない
    ];

    expect(suggestEstimateFactor(tasks)?.factor).toBe(1);
  });

  it('偶数件のときは中央2件の平均を取る', () => {
    const tasks = [
      measured('a', 60, 60), // 1.0
      measured('b', 60, 72), // 1.2
      measured('c', 60, 84), // 1.4
      measured('d', 60, 120), // 2.0
    ];

    // 中央2件 = 1.2, 1.4 → 1.3
    expect(suggestEstimateFactor(tasks)?.factor).toBe(1.3);
  });

  it('小数第2位までに丸める', () => {
    const tasks = [measured('a', 60, 55), measured('b', 60, 55), measured('c', 60, 55)];

    // 55/60 = 0.9166... → 0.92
    expect(suggestEstimateFactor(tasks)?.factor).toBe(0.92);
  });

  it('何件から算出したかを返す', () => {
    const tasks = [measured('a', 60, 90), measured('b', 60, 90), measured('c', 60, 90)];

    expect(suggestEstimateFactor(tasks)?.sampleCount).toBe(3);
  });

  it('現実的な範囲に収める', () => {
    const tasks = [measured('a', 10, 600), measured('b', 10, 600), measured('c', 10, 600)];

    expect(suggestEstimateFactor(tasks)?.factor).toBe(3);
  });

  it('実測0分は無視する（記録漏れと区別できないため）', () => {
    const tasks = [measured('a', 60, 0), measured('b', 60, 90), measured('c', 60, 90)];

    expect(suggestEstimateFactor(tasks)).toBeNull();
  });

  it('同じ入力なら同じ結果になる（決定性）', () => {
    const tasks = [measured('a', 60, 90), measured('b', 30, 30), measured('c', 45, 60)];

    expect(suggestEstimateFactor(tasks)).toEqual(suggestEstimateFactor([...tasks].reverse()));
  });
});
