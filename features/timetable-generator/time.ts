import type {
  MinuteInterval,
  TimeInterval,
} from './types';

const TIME_PATTERN =
  /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export class TimetableTimeError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimetableTimeError';
  }
}

export function parseTimeToMinutes(
  value: string,
): number {
  const normalized = value.trim();

  const match =
    TIME_PATTERN.exec(normalized);

  if (!match) {
    throw new TimetableTimeError(
      `Invalid timetable time: "${value}".`,
    );
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

  const seconds =
    Number(match[3] ?? 0);

  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23
  ) {
    throw new TimetableTimeError(
      `Timetable hour must be between 0 and 23: "${value}".`,
    );
  }

  if (
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new TimetableTimeError(
      `Timetable minutes must be between 0 and 59: "${value}".`,
    );
  }

  if (
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new TimetableTimeError(
      `Timetable seconds must be between 0 and 59: "${value}".`,
    );
  }

  return (
    hours * 60 +
    minutes +
    seconds / 60
  );
}

export function resolveMinuteInterval(
  interval: TimeInterval,
): MinuteInterval {
  const startMinutes =
    parseTimeToMinutes(
      interval.startsAt,
    );

  const endMinutes =
    parseTimeToMinutes(
      interval.endsAt,
    );

  if (endMinutes <= startMinutes) {
    throw new TimetableTimeError(
      `Timetable interval must end after it starts: ${interval.startsAt}–${interval.endsAt}.`,
    );
  }

  return {
    startMinutes,
    endMinutes,
  };
}

export function getIntervalDurationMinutes(
  interval: TimeInterval,
): number {
  const resolved =
    resolveMinuteInterval(interval);

  return (
    resolved.endMinutes -
    resolved.startMinutes
  );
}

export function formatMinutesAsTime(
  totalMinutes: number,
): string {
  if (
    !Number.isFinite(totalMinutes) ||
    totalMinutes < 0 ||
    totalMinutes >= 24 * 60
  ) {
    throw new TimetableTimeError(
      `Minutes must represent a time within one day: ${totalMinutes}.`,
    );
  }

  const wholeMinutes =
    Math.floor(totalMinutes);

  const hours =
    Math.floor(
      wholeMinutes / 60,
    );

  const minutes =
    wholeMinutes % 60;

  return `${String(hours).padStart(
    2,
    '0',
  )}:${String(minutes).padStart(
    2,
    '0',
  )}`;
}