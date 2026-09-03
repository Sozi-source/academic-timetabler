import { describe, expect, it } from 'vitest';

import { groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
import type { StaffUnitAllocation } from '@/features/staff-assessment/types';

function allocation(overrides: Partial<StaffUnitAllocation> = {}): StaffUnitAllocation {
  return {
    allocationId: 'allocation-a',
    academicPeriodId: 'period-1',
    academicPeriodName: 'May–August 2026',
    cohortId: 'cohort-a',
    cohortName: 'DND SEP 25',
    unitId: 'unit-1',
    unitCode: 'DND 1301',
    unitName: 'Basic Mathematics',
    allocationStatus: 'active',
    cat: null,
    exam: null,
    ...overrides,
  };
}

describe('staff unit grouping', () => {
  it('shows a shared unit once and combines all allocated cohorts', () => {
    const result = groupStaffUnitAllocations([
      allocation(),
      allocation({ allocationId: 'allocation-b', cohortId: 'cohort-b', cohortName: 'CN SEP 25' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].cohortNames).toEqual(['DND SEP 25', 'CN SEP 25']);
  });

  it('keeps distinct units separate even when their names are similar', () => {
    const result = groupStaffUnitAllocations([
      allocation(),
      allocation({ allocationId: 'allocation-b', unitId: 'unit-2', unitCode: 'DND 1302' }),
    ]);

    expect(result).toHaveLength(2);
  });
});
