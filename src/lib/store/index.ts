import { getAppMode } from '@/lib/app-mode';
import * as fileStore from './file-store';
import * as supabaseStore from './supabase-store';

export type { BlockedWindowInput, RoutineInput, TaskInput, TaskPatch } from './types';

/**
 * ユーザーデータの読み書き。画面と Server Actions はここだけを呼ぶ。
 *
 * 実体は file-store.ts（モック）と supabase-store.ts（live）の2つで、
 * 公開する関数の形をそろえてあるので、ここではモードで呼び分けるだけにしてある。
 * 呼び出し側は mode を意識しない。
 */
function impl() {
  return getAppMode().mode === 'mock' ? fileStore : supabaseStore;
}

export const getSettings: typeof fileStore.getSettings = (...args) => impl().getSettings(...args);
export const saveSettings: typeof fileStore.saveSettings = (...args) =>
  impl().saveSettings(...args);
export const getCarryoverPromptedOn: typeof fileStore.getCarryoverPromptedOn = (...args) =>
  impl().getCarryoverPromptedOn(...args);
export const markCarryoverPrompted: typeof fileStore.markCarryoverPrompted = (...args) =>
  impl().markCarryoverPrompted(...args);

export const listBlockedWindows: typeof fileStore.listBlockedWindows = (...args) =>
  impl().listBlockedWindows(...args);
export const createBlockedWindow: typeof fileStore.createBlockedWindow = (...args) =>
  impl().createBlockedWindow(...args);
export const updateBlockedWindow: typeof fileStore.updateBlockedWindow = (...args) =>
  impl().updateBlockedWindow(...args);
export const deleteBlockedWindow: typeof fileStore.deleteBlockedWindow = (...args) =>
  impl().deleteBlockedWindow(...args);

export const listRoutines: typeof fileStore.listRoutines = (...args) =>
  impl().listRoutines(...args);
export const getRoutine: typeof fileStore.getRoutine = (...args) => impl().getRoutine(...args);
export const createRoutine: typeof fileStore.createRoutine = (...args) =>
  impl().createRoutine(...args);
export const updateRoutine: typeof fileStore.updateRoutine = (...args) =>
  impl().updateRoutine(...args);
export const archiveRoutine: typeof fileStore.archiveRoutine = (...args) =>
  impl().archiveRoutine(...args);
export const duplicateRoutine: typeof fileStore.duplicateRoutine = (...args) =>
  impl().duplicateRoutine(...args);

export const listTasks: typeof fileStore.listTasks = (...args) => impl().listTasks(...args);
export const createTask: typeof fileStore.createTask = (...args) => impl().createTask(...args);
export const updateTask: typeof fileStore.updateTask = (...args) => impl().updateTask(...args);
export const deleteTask: typeof fileStore.deleteTask = (...args) => impl().deleteTask(...args);
export const carryOverTasks: typeof fileStore.carryOverTasks = (...args) =>
  impl().carryOverTasks(...args);

export const getPlan: typeof fileStore.getPlan = (...args) => impl().getPlan(...args);
export const savePlan: typeof fileStore.savePlan = (...args) => impl().savePlan(...args);
export const deletePlan: typeof fileStore.deletePlan = (...args) => impl().deletePlan(...args);

export const listSkippedRoutineIds: typeof fileStore.listSkippedRoutineIds = (...args) =>
  impl().listSkippedRoutineIds(...args);
export const setRoutineSkipped: typeof fileStore.setRoutineSkipped = (...args) =>
  impl().setRoutineSkipped(...args);
