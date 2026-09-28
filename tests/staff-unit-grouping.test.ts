import { describe, expect, it } from 'vitest';

import { canonicalUnitKey, groupStaffUnitAllocations } from '@/features/staff-assessment/unit-grouping';
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
    expect(result[0].combinedCohortLabel).toBe('DND SEP 25 + CN SEP 25');
  });

  it('groups units with different database unit_id UUIDs if unit title is identical (Nutrition Epidemiology)', () => {
    const result = groupStaffUnitAllocations([
      allocation({
        allocationId: 'alloc-1',
        unitId: 'uuid-dhn-101',
        unitCode: 'DHN 1105',
        unitName: 'Nutrition Epidemiology',
        cohortName: 'DHN MAY 24',
      }),
      allocation({
        allocationId: 'alloc-2',
        unitId: 'uuid-dndt-202',
        unitCode: 'DNDT 1105',
        unitName: 'Nutrition Epidemiology',
        cohortName: 'DNDT JAN 26',
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].unitName).toBe('Nutrition Epidemiology');
    expect(result[0].cohortNames).toEqual(['DHN MAY 24', 'DNDT JAN 26']);
    expect(result[0].combinedCohortLabel).toBe('DHN MAY 24 + DNDT JAN 26');
    expect(result[0].allAllocationIds).toEqual(['alloc-1', 'alloc-2']);
  });

  it('keeps distinct units separate when names are different', () => {
    const result = groupStaffUnitAllocations([
      allocation({ unitId: 'unit-1', unitCode: 'DND 1301', unitName: 'Basic Mathematics' }),
      allocation({ unitId: 'unit-2', unitCode: 'DND 1302', unitName: 'Calculus' }),
    ]);

    expect(result).toHaveLength(2);
  });

  it('preserves academic period isolation across different sessions', () => {
    const result = groupStaffUnitAllocations([
      allocation({ academicPeriodId: 'period-1', unitName: 'Nutrition Epidemiology' }),
      allocation({ academicPeriodId: 'period-2', unitName: 'Nutrition Epidemiology' }),
    ]);

    expect(result).toHaveLength(2);
  });

  it('canonicalUnitKey normalizes whitespace and punctuation', () => {
    expect(canonicalUnitKey('DHN 1105', 'Nutrition Epidemiology')).toBe('nutritionepidemiology');
    expect(canonicalUnitKey('DNDT-1105', 'Nutrition Epidemiology')).toBe('nutritionepidemiology');
  });
});
