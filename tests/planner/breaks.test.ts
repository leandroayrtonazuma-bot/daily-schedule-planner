import { describe, expect, it } from 'vitest';
import { insertBreaks } from '@/lib/planner/breaks';

const OPTIONS = { breakAfterMinutes: 90, breakDurationMinutes: 15 };

describe('insertBreaks', () => {
  it('連続作業が上限を超えたら直後に休憩を入れる', () => {
    const result = insertBreaks({
      work: [{ start: 540, end: 660 }], // 9:00-11:00 の120分
      free: [{ start: 660, end: 1320 }],
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([{ start: 660, end: 675 }]);
  });

  it('休憩ぶんだけ空きが減る', () => {
    const result = insertBreaks({
      work: [{ start: 540, end: 660 }],
      free: [{ start: 660, end: 1320 }],
      ...OPTIONS,
    });

    expect(result.free).toEqual([{ start: 675, end: 1320 }]);
  });

  it('上限に届かなければ休憩を入れない', () => {
    const result = insertBreaks({
      work: [{ start: 540, end: 600 }], // 60分
      free: [{ start: 600, end: 1320 }],
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([]);
  });

  it('隣り合う作業は連続作業として合算する', () => {
    const result = insertBreaks({
      work: [
        { start: 540, end: 600 },
        { start: 600, end: 660 },
      ],
      free: [{ start: 660, end: 1320 }],
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([{ start: 660, end: 675 }]);
  });

  it('休憩と同じだけ空いていれば、そこで一区切りとみなす', () => {
    const result = insertBreaks({
      work: [
        { start: 540, end: 600 }, // 60分
        { start: 660, end: 720 }, // 60分。間に60分空いている
      ],
      free: [
        { start: 600, end: 660 },
        { start: 720, end: 1320 },
      ],
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([]);
  });

  it('休憩を入れたら連続作業のカウントをやり直す', () => {
    const result = insertBreaks({
      work: [
        { start: 540, end: 660 }, // 120分 → 休憩
        { start: 675, end: 795 }, // 休憩明けの120分 → もう一度休憩
      ],
      free: [
        { start: 660, end: 675 },
        { start: 795, end: 1320 },
      ],
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([
      { start: 660, end: 675 },
      { start: 795, end: 810 },
    ]);
  });

  it('作業の直後に空きが無ければ休憩を入れない', () => {
    const result = insertBreaks({
      work: [{ start: 540, end: 660 }],
      free: [{ start: 1000, end: 1320 }], // 11:00 直後は予定で埋まっている
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([]);
  });

  it('空きが休憩の長さに足りなければ入れない', () => {
    const result = insertBreaks({
      work: [{ start: 540, end: 660 }],
      free: [{ start: 660, end: 665 }], // 5分しかない
      ...OPTIONS,
    });

    expect(result.breaks).toEqual([]);
  });

  it('休憩の長さが0なら何もしない', () => {
    const result = insertBreaks({
      work: [{ start: 540, end: 900 }],
      free: [{ start: 900, end: 1320 }],
      breakAfterMinutes: 90,
      breakDurationMinutes: 0,
    });

    expect(result.breaks).toEqual([]);
    expect(result.free).toEqual([{ start: 900, end: 1320 }]);
  });

  it('作業が無ければ何も起きない', () => {
    const result = insertBreaks({ work: [], free: [{ start: 0, end: 1440 }], ...OPTIONS });

    expect(result.breaks).toEqual([]);
    expect(result.free).toEqual([{ start: 0, end: 1440 }]);
  });

  it('作業の並び順に関係なく同じ結果になる（決定性）', () => {
    const work = [
      { start: 600, end: 660 },
      { start: 540, end: 600 },
    ];

    const result = insertBreaks({ work, free: [{ start: 660, end: 1320 }], ...OPTIONS });

    expect(result.breaks).toEqual([{ start: 660, end: 675 }]);
  });
});
