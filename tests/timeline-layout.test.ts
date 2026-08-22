import { describe, expect, it } from 'vitest';
import { layoutTimeline } from '@/lib/timeline-layout';

const span = (key: string, start: number, end: number) => ({ key, start, end });

describe('layoutTimeline', () => {
  it('重ならない項目は全幅を使う', () => {
    const laid = layoutTimeline([span('a', 0, 60), span('b', 60, 120)]);

    expect(laid.map((item) => [item.key, item.column, item.columns])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });

  it('重なる2件は半分ずつに割る', () => {
    const laid = layoutTimeline([span('a', 0, 60), span('b', 30, 90)]);

    expect(laid.map((item) => [item.key, item.column, item.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ]);
  });

  it('3件重なれば3分割', () => {
    const laid = layoutTimeline([span('a', 0, 90), span('b', 10, 90), span('c', 20, 90)]);

    expect(laid.map((item) => item.columns)).toEqual([3, 3, 3]);
    expect(laid.map((item) => item.column)).toEqual([0, 1, 2]);
  });

  it('空いた列を再利用する', () => {
    // a と b が重なり、c は a が終わってから始まる
    const laid = layoutTimeline([span('a', 0, 60), span('b', 30, 120), span('c', 60, 120)]);

    expect(laid.find((item) => item.key === 'c')?.column).toBe(0);
  });

  it('重なりの塊ごとに分割数を数える', () => {
    const laid = layoutTimeline([
      span('a', 0, 60),
      span('b', 30, 90),
      span('c', 600, 660), // 離れている
    ]);

    expect(laid.find((item) => item.key === 'c')?.columns).toBe(1);
  });

  it('接しているだけなら重なりとみなさない', () => {
    const laid = layoutTimeline([span('a', 0, 60), span('b', 60, 120)]);

    expect(laid.every((item) => item.columns === 1)).toBe(true);
  });

  it('開始が同じなら終了が早い順、それも同じならキー順（決定性）', () => {
    const laid = layoutTimeline([span('b', 0, 60), span('a', 0, 60), span('c', 0, 30)]);

    expect(laid.map((item) => item.key)).toEqual(['c', 'a', 'b']);
  });

  it('入力が空でも落ちない', () => {
    expect(layoutTimeline([])).toEqual([]);
  });

  it('入力の配列を書き換えない', () => {
    const input = [span('b', 30, 90), span('a', 0, 60)];
    layoutTimeline(input);

    expect(input.map((item) => item.key)).toEqual(['b', 'a']);
  });
});
