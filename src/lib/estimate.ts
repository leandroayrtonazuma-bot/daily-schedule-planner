import type { Task } from '@/lib/domain';

/**
 * 実測から estimate_factor を割り出す（PLAN.md 8章 Phase 4）。
 *
 * 「見積の何倍かかったか」の中央値を採る。平均にすると、1件の事故
 * （60分の見積で10時間かかった等）で係数が跳ね上がってしまう。
 *
 * 自動では適用しない。設定画面に提案として出し、押されたときだけ反映する。
 * 配置結果が黙って変わるのが、この手の補正で一番困る事故なので。
 */

/** これ未満の件数では提案しない。数件のブレで係数を動かしても意味がない */
export const MIN_SAMPLES = 3;

/** 極端な値で一日が壊れないための上下限 */
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 3;

export type EstimateSuggestion = {
  factor: number;
  sampleCount: number;
};

export function suggestEstimateFactor(tasks: readonly Task[]): EstimateSuggestion | null {
  const ratios = tasks
    .filter(
      (task) =>
        task.status === 'done' &&
        task.actualMinutes !== null &&
        // 0分は「すぐ終わった」なのか「記録し忘れ」なのか区別できない
        task.actualMinutes > 0 &&
        task.estimatedMinutes > 0,
    )
    .map((task) => (task.actualMinutes as number) / task.estimatedMinutes)
    .sort((a, b) => a - b);

  if (ratios.length < MIN_SAMPLES) return null;

  const clamped = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, median(ratios)));

  return {
    factor: Math.round(clamped * 100) / 100,
    sampleCount: ratios.length,
  };
}

/** 昇順に並んだ配列の中央値。偶数件なら中央2件の平均 */
function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
