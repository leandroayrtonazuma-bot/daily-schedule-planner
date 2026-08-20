import type { DayEvents } from './index';

/** JSON で受け渡すときの形。Date は ISO 文字列にする */
export type DayEventsDto = {
  date: string;
  timezone: string;
  mode: 'live' | 'mock';
  events: EventDto[];
  allDayEvents: EventDto[];
  busy: { start: string; end: string; sourceIds: string[] }[];
};

export type EventDto = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

export function toDayEventsDto(day: DayEvents): DayEventsDto {
  return {
    date: day.date,
    timezone: day.timezone,
    mode: day.mode,
    events: day.events.map(toEventDto),
    allDayEvents: day.allDayEvents.map(toEventDto),
    busy: day.busy.map((interval) => ({
      start: interval.start.toISOString(),
      end: interval.end.toISOString(),
      sourceIds: interval.sourceIds,
    })),
  };
}

function toEventDto(event: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
}): EventDto {
  return {
    id: event.id,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    allDay: event.allDay,
  };
}
