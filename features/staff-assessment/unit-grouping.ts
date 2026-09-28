import type { StaffUnitAllocation } from './types';

export type GroupedStaffUnitAllocation = StaffUnitAllocation & {
  primaryAllocationId: string;
  allAllocationIds: string[];
  cohortIds: string[];
  cohortNames: string[];
  combinedCohortLabel: string;
};

/**
 * Derives a canonical key for unit matching.
 * Hardened to group units assigned to a trainer within an academic session based on
 * normalized unit title and unit code, preventing duplicate unit card splitting when
 * identical or shared units have different database unit_id UUIDs across cohorts.
 */
export function canonicalUnitKey(unitCode: string, unitName: string): string {
  const cleanName = (unitName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  if (cleanName.length >= 3) {
    return cleanName;
  }

  const cleanCode = (unitCode || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return cleanCode || cleanName || 'unknown_unit';
}

/**
 * Groups staff unit allocations so that a trainer teaching the same unit across
 * multiple cohorts (even with distinct database unit_id UUIDs or programme code prefixes)
 * sees a single consolidated unit card.
 */
export function groupStaffUnitAllocations(
  allocations: StaffUnitAllocation[],
): GroupedStaffUnitAllocation[] {
  const groups = new Map<string, GroupedStaffUnitAllocation>();

  for (const allocation of allocations) {
    const key = canonicalUnitKey(allocation.unitCode, allocation.unitName);
    const groupKey = `${allocation.academicPeriodId}:${key}`;
    const existing = groups.get(groupKey);

    if (existing) {
      if (!existing.allAllocationIds.includes(allocation.allocationId)) {
        existing.allAllocationIds.push(allocation.allocationId);
      }
      if (!existing.cohortIds.includes(allocation.cohortId)) {
        existing.cohortIds.push(allocation.cohortId);
      }
      if (!existing.cohortNames.includes(allocation.cohortName)) {
        existing.cohortNames.push(allocation.cohortName);
        existing.combinedCohortLabel = existing.cohortNames.join(' + ');
      }
      // Preserve available assessment status
      if (!existing.cat && allocation.cat) {
        existing.cat = allocation.cat;
      }
      if (!existing.exam && allocation.exam) {
        existing.exam = allocation.exam;
      }
      continue;
    }

    groups.set(groupKey, {
      ...allocation,
      primaryAllocationId: allocation.allocationId,
      allAllocationIds: [allocation.allocationId],
      cohortIds: [allocation.cohortId],
      cohortNames: [allocation.cohortName],
      combinedCohortLabel: allocation.cohortName,
    });
  }

  return [...groups.values()];
}
