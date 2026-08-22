import type { DraftTask } from '@/lib/decompose';

/**
 * 「まとめて貼り付け」の状態（PLAN.md 7.3）。
 * 'use server' のファイルは async 関数しか export できないので、型と初期値はここに置く。
 */
export type DecomposeState = {
  drafts: DraftTask[];
  /** 分解に使った元のテキスト。やり直せるよう残す */
  input: string;
  error: string | null;
};

export const INITIAL_DECOMPOSE_STATE: DecomposeState = {
  drafts: [],
  input: '',
  error: null,
};
