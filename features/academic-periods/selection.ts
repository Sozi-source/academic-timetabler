export interface SelectableAcademicPeriod {
  id: string;
  status: string;
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
