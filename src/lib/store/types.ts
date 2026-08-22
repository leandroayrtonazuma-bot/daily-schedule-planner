import type { BlockedWindow, Routine, Task } from '@/lib/domain';

/**
 * 保存層の入力型。file-store.ts と supabase-store.ts の両方から使う共通の形。
 * どちらの実装も、この形さえ満たせば index.ts のディスパッチャから呼び分けられる。
 */

export type BlockedWindowInput = Omit<BlockedWindow, 'id' | 'userId' | 'createdAt'>;

export type RoutineInput = Omit<Routine, 'id' | 'userId' | 'createdAt' | 'archivedAt'>;

export type TaskInput = Pick<
  Task,
  'title' | 'estimatedMinutes' | 'priority' | 'dueDate' | 'source'
>;

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'estimatedMinutes'
    | 'priority'
    | 'dueDate'
    | 'status'
    | 'actualMinutes'
    | 'carryoverCount'
  >
>;
