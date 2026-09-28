import type {
  StudentPortalRegistrationState,
  StudentPortalResult,
  StudentPortalUnit,
} from './types';

export function studentStageLabel(
  academicPeriodNumber: number | null,
): string {
  if (
    !academicPeriodNumber ||
    academicPeriodNumber < 1
  ) {
    return 'Stage unavailable';
  }

  const year =
    Math.ceil(
      academicPeriodNumber /
        2,
    );

  const semester =
    academicPeriodNumber %
      2 ===
    0
      ? 2
      : 1;

  return `Y${year}S${semester}`;
}

export function deriveStudentRegistrationState(
  units: StudentPortalUnit[],
  submissionStatus:
    string | null,
): StudentPortalRegistrationState {
  const registered =
    units.filter(
      (unit) =>
        unit.registrationStatus ===
        'registered',
    );

  if (
    registered.length >
      0 &&
    submissionStatus ===
      'verified'
  ) {
    return 'confirmed';
  }

  if (
    registered.length >
    0
  ) {
    return 'pre_registered';
  }

  if (
    units.some(
      (unit) =>
        unit.registrationStatus ===
        'dropped',
    )
  ) {
    return 'deregistered';
  }

  return 'not_registered';
}

export function studentRegistrationLabel(
  state: StudentPortalRegistrationState,
): string {
  switch (state) {
    case 'pre_registered':
      return 'Pre-registered';

    case 'confirmed':
      return 'Confirmed';

    case 'deregistered':
      return 'Deregistered';

    default:
      return 'Not registered';
  }
}

export function activeStudentUnits(
  units: StudentPortalUnit[],
): StudentPortalUnit[] {
  return units.filter(
    (unit) =>
      unit.registrationStatus ===
      'registered',
  );
}

export function formatPortalClock(
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

  if (
    !Number.isFinite(
      hour,
    )
  ) {
    return value;
  }

  const displayHour =
    hour %
      12 ||
    12;

  return `${displayHour}:${match[2]} ${
    hour >= 12
      ? 'PM'
      : 'AM'
  }`;
}

export function studentResultDisplay(
  result: Pick<
    StudentPortalResult,
    | 'mark'
    | 'maximumMark'
    | 'resultStatus'
  >,
): string {
  if (
    result.resultStatus ===
    'absent'
  ) {
    return 'AB';
  }

  if (
    result.mark ===
      null ||
    result.maximumMark ===
      null
  ) {
    return '—';
  }

  return `${result.mark}/${result.maximumMark}`;
}


export function studentResultComponentDisplay(
  value: number | null,
  maximum: number,
): string {
  return value ===
    null
    ? '—'
    : `${value}/${maximum}`;
}
