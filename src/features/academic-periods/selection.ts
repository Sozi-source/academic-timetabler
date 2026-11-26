export interface SelectableAcademicPeriod {
  id: string;
  status: string;
}

export interface ConfigurableAcademicPeriod extends SelectableAcademicPeriod {
  academicYear?: {
    status: string;
  } | null;
}

export function isTimetableConfigurablePeriod<
  T extends ConfigurableAcademicPeriod,
>(
  period: T,
  options: { includeClosed?: boolean } = {},
): boolean {
  const allowedStatuses = options.includeClosed
    ? ['active', 'planned', 'closed']
    : ['active', 'planned'];

  if (!allowedStatuses.includes(period.status)) {
    return false;
  }

  return period.academicYear?.status !== 'archived';
}

export function computeCohortStageForPeriod({
  intakeDate,
  periodStartsOn,
  totalAcademicPeriods,
}: {
  intakeDate: string | null | undefined;
  periodStartsOn: string | null | undefined;
  totalAcademicPeriods?: number | null;
}): number | null {
  if (!intakeDate || !periodStartsOn) {
    return null;
  }

  const intake = new Date(`${intakeDate.slice(0, 10)}T00:00:00Z`);
  const periodStart = new Date(`${periodStartsOn.slice(0, 10)}T00:00:00Z`);

  if (Number.isNaN(intake.getTime()) || Number.isNaN(periodStart.getTime())) {
    return null;
  }

  const intakeTermIndex =
    intake.getUTCFullYear() * 3 + Math.floor(intake.getUTCMonth() / 4);
  const periodTermIndex =
    periodStart.getUTCFullYear() * 3 + Math.floor(periodStart.getUTCMonth() / 4);
  const stage = periodTermIndex - intakeTermIndex + 1;

  if (stage < 1) {
    return null;
  }

  if (
    typeof totalAcademicPeriods === 'number' &&
    totalAcademicPeriods > 0 &&
    stage > totalAcademicPeriods
  ) {
    return null;
  }

  return stage;
}

export function prioritizeActiveAcademicPeriods<
  T extends SelectableAcademicPeriod,
>(periods: T[]): T[] {
  return [...periods].sort((first, second) => {
    const firstPriority = first.status === 'active' ? 0 : 1;
    const secondPriority = second.status === 'active' ? 0 : 1;

    return firstPriority - secondPriority;
  });
}

export function resolveAcademicPeriodId<
  T extends SelectableAcademicPeriod,
>(periods: T[], requestedId?: string | null): string {
  const requested = requestedId?.trim();

  if (
    requested &&
    periods.some((period) => period.id === requested)
  ) {
    return requested;
  }

  return (
    periods.find((period) => period.status === 'active')?.id ??
    periods[0]?.id ??
    ''
  );
}
