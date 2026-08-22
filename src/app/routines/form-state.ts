/**
 * 'use server' のファイルからは async 関数しか export できないので、
 * フォームの状態の型と初期値だけをここに置く。
 */
export type RoutineFormState = {
  status: 'idle' | 'saved' | 'error';
  errors: string[];
};

export const INITIAL_ROUTINE_FORM_STATE: RoutineFormState = { status: 'idle', errors: [] };
