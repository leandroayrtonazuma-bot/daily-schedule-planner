import { describe, expect, it } from 'vitest';
import { carryoverCandidates, needsCarryoverPrompt } from '@/lib/carryover';
import { makeSettings, makeTask } from './helpers/factories';

const TODAY = '2026-08-22';
const TZ = 'Asia/Tokyo';

/** 指定日の日本時間 09:00 を ISO で返す。createdAt の作成用 */
function createdOn(date: string): string {
  return `${date}T00:00:00.000Z`;
}

describe('carryoverCandidates', () => {
  it('前日以前に作られた pending タスクを返す', () => {
    const tasks = [
      makeTask({ id: 'a', createdAt: createdOn('2026-08-21') }),
      makeTask({ id: 'b', createdAt: createdOn('2026-08-10') }),
    ];

    expect(carryoverCandidates(tasks, TODAY, TZ).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('今日作られたタスクは対象にしない', () => {
    const tasks = [makeTask({ id: 'today', createdAt: createdOn(TODAY) })];

    expect(carryoverCandidates(tasks, TODAY, TZ)).toEqual([]);
  });

  it('完了・見送りのタスクは対象にしない', () => {
    const tasks = [
      makeTask({ id: 'done', status: 'done', createdAt: createdOn('2026-08-01') }),
      makeTask({ id: 'skipped', status: 'skipped', createdAt: createdOn('2026-08-01') }),
    ];

    expect(carryoverCandidates(tasks, TODAY, TZ)).toEqual([]);
  });

  it('古いものから並べる。同じ作成日なら id 順（決定性）', () => {
    const tasks = [
      makeTask({ id: 'b', createdAt: createdOn('2026-08-01') }),
      makeTask({ id: 'a', createdAt: createdOn('2026-08-01') }),
      makeTask({ id: 'c', createdAt: createdOn('2026-07-01') }),
    ];

    expect(carryoverCandidates(tasks, TODAY, TZ).map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('タイムゾーンをまたいで日付を判定する', () => {
    // UTC では 8/21 だが Asia/Tokyo では 8/22。今日なので対象外
    const tasks = [makeTask({ id: 'edge', createdAt: '2026-08-21T15:30:00.000Z' })];

    expect(carryoverCandidates(tasks, TODAY, TZ)).toEqual([]);
  });
});

describe('needsCarryoverPrompt', () => {
  const candidate = [makeTask({ id: 'old', createdAt: createdOn('2026-08-01') })];

  it('候補があり、今日まだ聞いていなければ出す', () => {
    expect(
      needsCarryoverPrompt({
        settings: makeSettings({ askCarryover: true }),
        promptedOn: null,
        today: TODAY,
        candidates: candidate,
      }),
    ).toBe(true);
  });

  it('今日すでに聞いていれば出さない', () => {
    expect(
      needsCarryoverPrompt({
        settings: makeSettings({ askCarryover: true }),
        promptedOn: TODAY,
        today: TODAY,
        candidates: candidate,
      }),
    ).toBe(false);
  });

  it('前日に聞いていても、今日はまた出す', () => {
    expect(
      needsCarryoverPrompt({
        settings: makeSettings({ askCarryover: true }),
        promptedOn: '2026-08-21',
        today: TODAY,
        candidates: candidate,
      }),
    ).toBe(true);
  });

  it('設定で切っていれば出さない', () => {
    expect(
      needsCarryoverPrompt({
        settings: makeSettings({ askCarryover: false }),
        promptedOn: null,
        today: TODAY,
        candidates: candidate,
      }),
    ).toBe(false);
  });

  it('候補が無ければ出さない', () => {
    expect(
      needsCarryoverPrompt({
        settings: makeSettings({ askCarryover: true }),
        promptedOn: null,
        today: TODAY,
        candidates: [],
      }),
    ).toBe(false);
  });
});
