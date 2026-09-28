import {
  resolveMinuteInterval,
} from './time';
import type {
  MinuteInterval,
  TimeInterval,
} from './types';

export function minuteIntervalsOverlap(
  first: MinuteInterval,
  second: MinuteInterval,
): boolean {
  return (
    first.startMinutes <
      second.endMinutes &&
    second.startMinutes <
      first.endMinutes
  );
}

export function timeIntervalsOverlap(
  first: TimeInterval,
  second: TimeInterval,
): boolean {
  return minuteIntervalsOverlap(
    resolveMinuteInterval(first),
    resolveMinuteInterval(second),
  );
}

export function getOverlapDurationMinutes(
  first: TimeInterval,
  second: TimeInterval,
): number {
  const firstInterval =
    resolveMinuteInterval(first);

  const secondInterval =
    resolveMinuteInterval(second);

  const overlapStart = Math.max(
    firstInterval.startMinutes,
    secondInterval.startMinutes,
  );

  const overlapEnd = Math.min(
    firstInterval.endMinutes,
    secondInterval.endMinutes,
  );

  return Math.max(
    0,
    overlapEnd - overlapStart,
  );
}

export function intervalContains(
  outer: TimeInterval,
  inner: TimeInterval,
): boolean {
  const outerInterval =
    resolveMinuteInterval(outer);

  const innerInterval =
    resolveMinuteInterval(inner);

  return (
    outerInterval.startMinutes <=
      innerInterval.startMinutes &&
    outerInterval.endMinutes >=
      innerInterval.endMinutes
  );
}

export function intervalsAreAdjacent(
  first: TimeInterval,
  second: TimeInterval,
): boolean {
  const firstInterval =
    resolveMinuteInterval(first);

  const secondInterval =
    resolveMinuteInterval(second);

  return (
    firstInterval.endMinutes ===
      secondInterval.startMinutes ||
    secondInterval.endMinutes ===
      firstInterval.startMinutes
  );
}