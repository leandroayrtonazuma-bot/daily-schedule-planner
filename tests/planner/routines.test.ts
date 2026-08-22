import { describe, expect, it } from 'vitest';
import {
  isRoutineActiveOn,
  placeRoutines,
  sortRoutinesForPlacement,
  validateRoutine,
} from '@/lib/planner/routines';
import { makeRoutine } from '../helpers/factories';

// 2026-08-21 は金曜日
const FRIDAY = '2026-08-21';
const SATURDAY = '2026-08-22';

describe('isRoutineActiveOn', () => {
  it('曜日が含まれていれば対象', () => {
    const routine = makeRoutine({ id: 'r1', daysOfWeek: [5] });
    expect(isRoutineActiveOn(routine, FRIDAY)).toBe(true);
    expect(isRoutineActiveOn(routine, SATURDAY)).toBe(false);
  });

  it('有効月の外なら対象外', () => {
    const routine = makeRoutine({ id: 'r1', activeMonths: [6, 7] });
    expect(isRoutineActiveOn(routine, FRIDAY)).toBe(false);
  });

  it('一時停止中は対象外', () => {
    expect(isRoutineActiveOn(makeRoutine({ id: 'r1', isActive: false }), FRIDAY)).toBe(false);
  });

  it('論理削除済みは対象外', () => {
    const routine = makeRoutine({ id: 'r1', archivedAt: '2026-08-01T00:00:00.000Z' });
    expect(isRoutineActiveOn(routine, FRIDAY)).toBe(false);
  });

  it('実行環境のタイムゾーンに関係なく日付文字列の曜日で判定する', () => {
    // '2026-08-21' を UTC で解釈しても JST で解釈しても金曜であること
    const friday = makeRoutine({ id: 'r1', daysOfWeek: [5] });
    expect(isRoutineActiveOn(friday, '2026-08-21')).toBe(true);
    expect(isRoutineActiveOn(friday, '2026-08-28')).toBe(true);
  });
});

describe('sortRoutinesForPlacement', () => {
  it('許可時間帯が窮屈なものから置く', () => {
    const loose = makeRoutine({
      id: 'loose',
      durationMinutes: 30,
      allowedWindows: [{ start: '00:00', end: '24:00' }],
    });
    const tight = makeRoutine({
      id: 'tight',
      durationMinutes: 30,
      allowedWindows: [{ start: '07:00', end: '08:00' }],
    });

    expect(sortRoutinesForPlacement([loose, tight]).map((r) => r.id)).toEqual(['tight', 'loose']);
  });

  it('窮屈さが同じなら優先度の高い順', () => {
    const low = makeRoutine({ id: 'a-low', priority: 3 });
    const high = makeRoutine({ id: 'b-high', priority: 1 });

    expect(sortRoutinesForPlacement([low, high]).map((r) => r.id)).toEqual(['b-high', 'a-low']);
  });

  it('同点なら id 昇順（決定性のため）', () => {
    const second = makeRoutine({ id: 'r2' });
    const first = makeRoutine({ id: 'r1' });

    expect(sortRoutinesForPlacement([second, first]).map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('回数が多いほど窮屈とみなす', () => {
    const once = makeRoutine({ id: 'once', durationMinutes: 30, timesPerDay: 1 });
    const thrice = makeRoutine({ id: 'thrice', durationMinutes: 30, timesPerDay: 3 });

    expect(sortRoutinesForPlacement([once, thrice]).map((r) => r.id)).toEqual(['thrice', 'once']);
  });

  it('入力の配列を書き換えない', () => {
    const input = [makeRoutine({ id: 'r2' }), makeRoutine({ id: 'r1' })];
    sortRoutinesForPlacement(input);
    expect(input.map((r) => r.id)).toEqual(['r2', 'r1']);
  });
});

describe('placeRoutines', () => {
  const wholeDay = [{ start: 0, end: 1440 }];

  it('許可時間帯の中で最も早い位置に置く', () => {
    const routine = makeRoutine({
      id: 'run',
      durationMinutes: 30,
      allowedWindows: [{ start: '05:00', end: '08:00' }],
    });

    const result = placeRoutines({ routines: [routine], free: wholeDay });

    expect(result.placed).toEqual([
      { routineId: 'run', occurrence: 1, start: 300, end: 330 },
    ]);
  });

  it('置いた分だけ空きが減る', () => {
    const routine = makeRoutine({
      id: 'run',
      durationMinutes: 30,
      allowedWindows: [{ start: '05:00', end: '08:00' }],
    });

    const result = placeRoutines({ routines: [routine], free: wholeDay });

    expect(result.free).toEqual([
      { start: 0, end: 300 },
      { start: 330, end: 1440 },
    ]);
  });

  it('空きの無い時間帯は避ける', () => {
    const routine = makeRoutine({
      id: 'lunch',
      durationMinutes: 30,
      allowedWindows: [{ start: '12:00', end: '14:00' }],
    });

    // 12:00-13:00 は予定で埋まっている
    const result = placeRoutines({
      routines: [routine],
      free: [{ start: 780, end: 1440 }],
    });

    expect(result.placed[0]).toEqual({ routineId: 'lunch', occurrence: 1, start: 780, end: 810 });
  });

  it('許可時間帯をまたいでは置かない', () => {
    const routine = makeRoutine({
      id: 'meal',
      durationMinutes: 60,
      allowedWindows: [
        { start: '07:00', end: '07:30' },
        { start: '12:00', end: '13:30' },
      ],
    });

    const result = placeRoutines({ routines: [routine], free: wholeDay });

    // 07:00-07:30 は30分しかないので入らない。次の窓に置かれる
    expect(result.placed[0]).toEqual({ routineId: 'meal', occurrence: 1, start: 720, end: 780 });
  });

  it('回数ぶん置き、最小間隔を空ける', () => {
    const routine = makeRoutine({
      id: 'meal',
      durationMinutes: 30,
      timesPerDay: 3,
      minGapMinutes: 240,
      allowedWindows: [{ start: '07:00', end: '20:00' }],
    });

    const result = placeRoutines({ routines: [routine], free: wholeDay });

    expect(result.placed).toEqual([
      { routineId: 'meal', occurrence: 1, start: 420, end: 450 },
      { routineId: 'meal', occurrence: 2, start: 690, end: 720 },
      { routineId: 'meal', occurrence: 3, start: 960, end: 990 },
    ]);
  });

  it('許可時間帯が予定と完全に重なると置けない', () => {
    const routine = makeRoutine({
      id: 'run',
      durationMinutes: 30,
      allowedWindows: [{ start: '05:00', end: '06:00' }],
    });

    // 05:00-06:00 に空きが無い
    const result = placeRoutines({
      routines: [routine],
      free: [{ start: 360, end: 1440 }],
    });

    expect(result.placed).toEqual([]);
    expect(result.unplaced).toEqual([
      { routineId: 'run', title: 'run', placedCount: 0, requiredCount: 1 },
    ]);
  });

  it('最小間隔が厳しくて解が無いときは置けた回数だけ報告する', () => {
    const routine = makeRoutine({
      id: 'meal',
      durationMinutes: 30,
      timesPerDay: 3,
      minGapMinutes: 300,
      allowedWindows: [{ start: '07:00', end: '13:00' }],
    });

    const result = placeRoutines({ routines: [routine], free: wholeDay });

    expect(result.placed).toEqual([
      { routineId: 'meal', occurrence: 1, start: 420, end: 450 },
      { routineId: 'meal', occurrence: 2, start: 750, end: 780 },
    ]);
    expect(result.unplaced).toEqual([
      { routineId: 'meal', title: 'meal', placedCount: 2, requiredCount: 3 },
    ]);
  });

  it('窮屈なルーティンが先に場所を取る', () => {
    const anytime = makeRoutine({
      id: 'anytime',
      durationMinutes: 60,
      allowedWindows: [{ start: '00:00', end: '24:00' }],
    });
    const morningOnly = makeRoutine({
      id: 'morning',
      durationMinutes: 60,
      allowedWindows: [{ start: '06:00', end: '07:00' }],
    });

    const result = placeRoutines({
      routines: [anytime, morningOnly],
      free: [{ start: 360, end: 480 }],
    });

    // 6:00-7:00 しか置けない morning が先。anytime は 7:00 から
    expect(result.placed).toEqual([
      { routineId: 'morning', occurrence: 1, start: 360, end: 420 },
      { routineId: 'anytime', occurrence: 1, start: 420, end: 480 },
    ]);
  });

  it('同じ入力なら同じ結果になる（決定性）', () => {
    const routines = [
      makeRoutine({ id: 'b', durationMinutes: 30 }),
      makeRoutine({ id: 'a', durationMinutes: 30 }),
      makeRoutine({ id: 'c', durationMinutes: 30 }),
    ];

    const first = placeRoutines({ routines, free: wholeDay });
    const second = placeRoutines({ routines: [...routines].reverse(), free: wholeDay });

    expect(second.placed).toEqual(first.placed);
  });
});

describe('validateRoutine', () => {
  it('許可時間帯に収まるなら通る', () => {
    const routine = makeRoutine({
      id: 'meal',
      durationMinutes: 30,
      timesPerDay: 3,
      minGapMinutes: 60,
      allowedWindows: [{ start: '07:00', end: '20:00' }],
    });

    expect(validateRoutine(routine)).toEqual([]);
  });

  it('必要な合計時間が許可時間帯の幅を超えたら弾く（PLAN.md 6.5）', () => {
    const routine = makeRoutine({
      id: 'meal',
      durationMinutes: 60,
      timesPerDay: 3,
      minGapMinutes: 180,
      allowedWindows: [{ start: '07:00', end: '12:00' }],
    });

    // 60*3 + 180*2 = 540分 > 300分
    const errors = validateRoutine(routine);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('許可時間帯');
  });

  it('許可時間帯が空なら弾く', () => {
    expect(validateRoutine(makeRoutine({ id: 'r1', allowedWindows: [] }))).toContainEqual(
      expect.stringContaining('許可時間帯'),
    );
  });

  it('終了が開始より前の許可時間帯を弾く', () => {
    const routine = makeRoutine({
      id: 'r1',
      allowedWindows: [{ start: '20:00', end: '07:00' }],
    });

    expect(validateRoutine(routine)).toContainEqual(expect.stringContaining('終了'));
  });

  it('タイトルが空なら弾く', () => {
    expect(validateRoutine(makeRoutine({ id: 'r1', title: '   ' }))).toContainEqual(
      expect.stringContaining('タイトル'),
    );
  });

  it('所要時間が0以下なら弾く', () => {
    expect(validateRoutine(makeRoutine({ id: 'r1', durationMinutes: 0 }))).toContainEqual(
      expect.stringContaining('所要時間'),
    );
  });

  it('曜日が1つも選ばれていなければ弾く', () => {
    expect(validateRoutine(makeRoutine({ id: 'r1', daysOfWeek: [] }))).toContainEqual(
      expect.stringContaining('曜日'),
    );
  });
});
