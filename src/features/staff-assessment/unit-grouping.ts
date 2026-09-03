import type { StaffUnitAllocation } from './types';

export type GroupedStaffUnitAllocation = StaffUnitAllocation & {
  cohortNames: string[];
};

/**
 * A teaching allocation is stored per cohort. Trainers, however, work with a
 * unit once even when the same unit is shared by several cohorts.
 */
export function groupStaffUnitAllocations(
  allocations: StaffUnitAllocation[],
): GroupedStaffUnitAllocation[] {
  const groups = new Map<string, GroupedStaffUnitAllocation>();

  for (const allocation of allocations) {
    const key = `${allocation.academicPeriodId}:${allocation.unitId}`;
    const existing = groups.get(key);

    if (existing) {
      if (!existing.cohortNames.includes(allocation.cohortName)) {
        existing.cohortNames.push(allocation.cohortName);
      }
      continue;
    }

    groups.set(key, {
      ...allocation,
      cohortNames: [allocation.cohortName],
    });
  }

  return [...groups.values()];
}
