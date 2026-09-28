import type {
  StaffTimetableSession,
} from './types';

function timetableKey(
  session: StaffTimetableSession,
): string {
  return [
    session.academicPeriodId,
    session.daySequence,
    session.startSequence,
    session.startsAt,
    session.endsAt,
    session.unitId,
    session.roomLabel,
    session.deliveryMode,
  ].join(
    ':',
  );
}

export function mergeStaffTimetableSessions(
  sessions: StaffTimetableSession[],
): StaffTimetableSession[] {
  const merged =
    new Map<
      string,
      StaffTimetableSession
    >();

  for (
    const session of
      sessions
  ) {
    const key =
      timetableKey(
        session,
      );

    const current =
      merged.get(
        key,
      );

    if (!current) {
      merged.set(
        key,
        {
          ...session,
          cohortNames: [
            ...new Set(
              session.cohortNames,
            ),
          ],
          sessionNumbers: [
            ...new Set(
              session.sessionNumbers,
            ),
          ],
        },
      );

      continue;
    }

    current.cohortNames =
      [
        ...new Set([
          ...current.cohortNames,
          ...session.cohortNames,
        ]),
      ];

    current.sessionNumbers =
      [
        ...new Set([
          ...current.sessionNumbers,
          ...session.sessionNumbers,
        ]),
      ].sort(
        (
          left,
          right,
        ) =>
          left -
          right,
      );
  }

  return [
    ...merged.values(),
  ].sort(
    (
      left,
      right,
    ) => {
      const period =
        left.academicPeriodName
          .localeCompare(
            right.academicPeriodName,
          );

      if (
        period !==
        0
      ) {
        return period;
      }

      if (
        left.daySequence !==
        right.daySequence
      ) {
        return (
          left.daySequence -
          right.daySequence
        );
      }

      if (
        left.startSequence !==
        right.startSequence
      ) {
        return (
          left.startSequence -
          right.startSequence
        );
      }

      return left.unitName
        .localeCompare(
          right.unitName,
        );
    },
  );
}

export function formatTimetableClock(
  value: string | null,
): string {
  if (!value) {
    return '—';
  }

  const match =
    value.match(
      /^(\d{1,2}):(\d{2})/,
    );

  if (!match) {
    return value;
  }

  const hour =
    Number(
      match[1],
    );

  const minute =
    match[2];

  if (
    !Number.isFinite(
      hour,
    )
  ) {
    return value;
  }

  const period =
    hour >=
      12
      ? 'PM'
      : 'AM';

  const displayHour =
    hour %
      12 ||
    12;

  return `${displayHour}:${minute} ${period}`;
}

export function historyTimestamp(
  value: string | null,
): number {
  if (!value) {
    return 0;
  }

  const parsed =
    Date.parse(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}
