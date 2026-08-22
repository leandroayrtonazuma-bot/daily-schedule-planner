import { describe, expect, it } from 'vitest';
import {
  intersectIntervals,
  normalizeIntervals,
  padInterval,
  subtractIntervals,
  totalMinutes,
} from '@/lib/planner/intervals';

describe('normalizeIntervals', () => {
  it('開始時刻でソートする', () => {
    expect(
      normalizeIntervals([
        { start: 600, end: 660 },
        { start: 60, end: 120 },
      ]),
    ).toEqual([
      { start: 60, end: 120 },
      { start: 600, end: 660 },
    ]);
  });

  it('重なる区間をまとめる', () => {
    expect(
      normalizeIntervals([
        { start: 780, end: 840 },
        { start: 810, end: 900 },
      ]),
    ).toEqual([{ start: 780, end: 900 }]);
  });

  it('隙間なく隣り合う区間もまとめる', () => {
    expect(
      normalizeIntervals([
        { start: 60, end: 120 },
        { start: 120, end: 180 },
      ]),
    ).toEqual([{ start: 60, end: 180 }]);
  });

  it('内側に完全に含まれる区間を飲み込む', () => {
    expect(
      normalizeIntervals([
        { start: 60, end: 300 },
        { start: 100, end: 120 },
      ]),
    ).toEqual([{ start: 60, end: 300 }]);
  });

  it('長さの無い区間は捨てる', () => {
    expect(normalizeIntervals([{ start: 60, end: 60 }])).toEqual([]);
    expect(normalizeIntervals([{ start: 120, end: 60 }])).toEqual([]);
  });

  it('入力の配列を書き換えない', () => {
    const input = [
      { start: 600, end: 660 },
      { start: 60, end: 120 },
    ];
    normalizeIntervals(input);
    expect(input[0]).toEqual({ start: 600, end: 660 });
  });
});

describe('subtractIntervals', () => {
  it('区間の真ん中を削ると2つに割れる', () => {
    expect(subtractIntervals([{ start: 540, end: 1320 }], [{ start: 780, end: 840 }])).toEqual([
      { start: 540, end: 780 },
      { start: 840, end: 1320 },
    ]);
  });

  it('先頭を削ると後ろだけ残る', () => {
    expect(subtractIntervals([{ start: 540, end: 720 }], [{ start: 480, end: 600 }])).toEqual([
      { start: 600, end: 720 },
    ]);
  });

  it('丸ごと覆われると何も残らない', () => {
    expect(subtractIntervals([{ start: 540, end: 720 }], [{ start: 480, end: 780 }])).toEqual([]);
  });

  it('重ならない区間は影響しない', () => {
    expect(subtractIntervals([{ start: 540, end: 720 }], [{ start: 900, end: 960 }])).toEqual([
      { start: 540, end: 720 },
    ]);
  });

  it('複数の削り取りを順に適用する', () => {
    expect(
      subtractIntervals(
        [{ start: 540, end: 1320 }],
        [
          { start: 600, end: 660 },
          { start: 780, end: 840 },
        ],
      ),
    ).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 780 },
      { start: 840, end: 1320 },
    ]);
  });

  it('削り取り側が重なっていても正しく引く', () => {
    expect(
      subtractIntervals(
        [{ start: 0, end: 600 }],
        [
          { start: 100, end: 300 },
          { start: 200, end: 400 },
        ],
      ),
    ).toEqual([
      { start: 0, end: 100 },
      { start: 400, end: 600 },
    ]);
  });
});

describe('intersectIntervals', () => {
  it('両方に含まれる部分だけを返す', () => {
    expect(
      intersectIntervals([{ start: 540, end: 1320 }], [{ start: 1200, end: 1440 }]),
    ).toEqual([{ start: 1200, end: 1320 }]);
  });

  it('接しているだけの区間は長さ0なので返さない', () => {
    expect(intersectIntervals([{ start: 0, end: 600 }], [{ start: 600, end: 900 }])).toEqual([]);
  });

  it('複数の空きと複数の許可時間帯を突き合わせる', () => {
    expect(
      intersectIntervals(
        [
          { start: 300, end: 480 },
          { start: 1080, end: 1320 },
        ],
        [
          { start: 360, end: 420 },
          { start: 1100, end: 1500 },
        ],
      ),
    ).toEqual([
      { start: 360, end: 420 },
      { start: 1100, end: 1320 },
    ]);
  });
});

describe('padInterval', () => {
  it('前後にバッファを付ける', () => {
    expect(padInterval({ start: 600, end: 660 }, 10, 15)).toEqual({ start: 590, end: 675 });
  });

  it('0 を下回らない', () => {
    expect(padInterval({ start: 5, end: 60 }, 10, 0)).toEqual({ start: 0, end: 60 });
  });
});

describe('totalMinutes', () => {
  it('区間の長さを合計する', () => {
    expect(
      totalMinutes([
        { start: 300, end: 480 },
        { start: 1080, end: 1320 },
      ]),
    ).toBe(420);
  });

  it('空なら0', () => {
    expect(totalMinutes([])).toBe(0);
  });
});
