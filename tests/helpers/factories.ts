import {
  ALL_DAYS_OF_WEEK,
  ALL_MONTHS,
  type BlockedWindow,
  type Routine,
  type Task,
} from '@/lib/domain';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/settings';

const USER_ID = 'user-1';

export function makeRoutine(overrides: Partial<Routine> & { id: string }): Routine {
  return {
    userId: USER_ID,
    title: overrides.id,
    durationMinutes: 30,
    timesPerDay: 1,
    minGapMinutes: 0,
    priority: 2,
    daysOfWeek: ALL_DAYS_OF_WEEK,
    activeMonths: ALL_MONTHS,
    allowedWindows: [{ start: '00:00', end: '24:00' }],
    isActive: true,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    userId: USER_ID,
    title: overrides.id,
    estimatedMinutes: 60,
    actualMinutes: null,
    priority: 2,
    dueDate: null,
    status: 'pending',
    carryoverCount: 0,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

export function makeBlockedWindow(
  overrides: Partial<BlockedWindow> & { id: string },
): BlockedWindow {
  return {
    userId: USER_ID,
    label: overrides.id,
    startTime: '12:00',
    endTime: '13:00',
    daysOfWeek: ALL_DAYS_OF_WEEK,
    specificDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
