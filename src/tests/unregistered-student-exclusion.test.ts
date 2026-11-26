import { describe, expect, it } from 'vitest';

import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';
import { loadRegisteredStudentIdsForUnits } from '@/features/assessment/unit-sibling-groups';

function createMockSupabase(tables: Record<string, unknown[]>) {
  const buildChain = (tableName: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];

    const applyFilters = () => {
      const rows = (tables[tableName] ?? []) as Record<string, unknown>[];
      return rows.filter((row) => filters.every((fn) => fn(row)));
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters.push((row) => row[col] === val);
        return chain;
      },
      neq: (col: string, val: unknown) => {
        filters.push((row) => row[col] !== val);
        return chain;
      },
      in: (col: string, vals: unknown[]) => {
        filters.push((row) => vals.includes(row[col]));
        return chain;
      },
      not: (col: string, op: string, val: unknown) => {
        if (op === 'is' && val === null) {
          filters.push((row) => row[col] !== null && row[col] !== undefined);
        }
        return chain;
      },
      order: () => chain,
      range: async (from: number, to: number) => ({
        data: applyFilters().slice(from, to + 1),
        error: null,
      }),
      maybeSingle: async () => ({
        data: applyFilters()[0] ?? null,
        error: null,
      }),
      then: (resolve: (value: { data: unknown[]; error: null }) => void) => {
        resolve({ data: applyFilters(), error: null });
      },
    };

    return chain;
  };

  return {
    from: (tableName: string) => buildChain(tableName),
  };
}

describe('Unregistered student exclusion across attendance and marksheets', () => {
  it('excludes a dropped/unregistered student from getUnifiedUnitRoster even when still in the same cohort', async () => {
    const mockSupabase = createMockSupabase({
      teaching_allocations: [
        {
          id: 'alloc-1',
          unit_id: 'unit-1',
          academic_period_id: 'period-1',
          cohort_id: 'cohort-1',
          participant_cohort_ids: ['cohort-1'],
          teaching_offering_id: null,
        },
      ],
      unit_offerings: [
        {
          unit_id: 'unit-1',
          cohort_id: 'cohort-1',
          academic_period_id: 'period-1',
          confirmed_shared_offering_id: null,
        },
      ],
      units: [{ id: 'unit-1', name: 'Clinical Nutrition' }],
      cohorts: [
        {
          id: 'cohort-1',
          name: 'DND JAN 2026',
          code: 'DND-JAN-2026',
          programme: { id: 'prog-1', name: 'Diploma in Nutrition', code: 'DND', department: { id: 'dept-1', name: 'Nutrition' } },
        },
      ],
      student_unit_registrations: [
        {
          student_id: 'student-registered',
          cohort_id: 'cohort-1',
          unit_id: 'unit-1',
          academic_period_id: 'period-1',
          registration_status: 'registered',
          student: {
            id: 'student-registered',
            admission_number: 'DND/001',
            full_name: 'Registered Student',
            current_cohort_id: 'cohort-1',
            lifecycle_status: 'active',
            academic_phase: 'in_class',
          },
        },
        {
          student_id: 'student-dropped',
          cohort_id: 'cohort-1',
          unit_id: 'unit-1',
          academic_period_id: 'period-1',
          registration_status: 'dropped',
          student: {
            id: 'student-dropped',
            admission_number: 'DND/002',
            full_name: 'Unregistered Student',
            current_cohort_id: 'cohort-1',
            lifecycle_status: 'active',
            academic_phase: 'in_class',
          },
        },
      ],
      student_class_assignments: [],
      student_period_reporting: [],
    });

    const roster = await getUnifiedUnitRoster({
      supabase: mockSupabase,
      unitId: 'unit-1',
      academicPeriodId: 'period-1',
      allocationId: 'alloc-1',
    });

    expect(roster.students.map((s) => s.studentId)).toEqual(['student-registered']);
    expect(roster.totalCount).toBe(1);
  });

  it('loadRegisteredStudentIdsForUnits resolves registrations across shared and equivalent sibling units and excludes unregistered students', async () => {
    const mockAdmin = createMockSupabase({
      unit_offerings: [
        {
          unit_id: 'unit-cnd',
          academic_period_id: 'period-1',
          confirmed_shared_offering_id: 'shared-1',
        },
        {
          unit_id: 'unit-dnd',
          academic_period_id: 'period-1',
          confirmed_shared_offering_id: 'shared-1',
        },
      ],
      unit_equivalence_members: [
        {
          unit_id: 'unit-cnd',
          equivalence_group_id: 'eq-1',
          status: 'approved',
        },
        {
          unit_id: 'unit-dhn',
          equivalence_group_id: 'eq-1',
          status: 'approved',
        },
      ],
      student_unit_registrations: [
        {
          id: 'reg-1',
          student_id: 'student-direct',
          unit_id: 'unit-cnd',
          academic_period_id: 'period-1',
          registration_status: 'registered',
        },
        {
          id: 'reg-2',
          student_id: 'student-sibling',
          unit_id: 'unit-dhn',
          academic_period_id: 'period-1',
          registration_status: 'registered',
        },
        {
          id: 'reg-3',
          student_id: 'student-unregistered',
          unit_id: 'unit-cnd',
          academic_period_id: 'period-1',
          registration_status: 'dropped',
        },
      ],
      teaching_allocations: [
        {
          id: 'alloc-cnd',
          unit_id: 'unit-cnd',
          academic_period_id: 'period-1',
        },
      ],
      student_class_assignments: [
        {
          student_id: 'student-transfer-active',
          academic_period_id: 'period-1',
          teaching_allocation_id: 'alloc-cnd',
          is_active: true,
          student_unit_registrations: { registration_status: 'registered' },
        },
        {
          student_id: 'student-transfer-unregistered',
          academic_period_id: 'period-1',
          teaching_allocation_id: 'alloc-cnd',
          is_active: true,
          student_unit_registrations: { registration_status: 'dropped' },
        },
      ],
    });

    const registeredIds = await loadRegisteredStudentIdsForUnits(
      mockAdmin as unknown as Parameters<typeof loadRegisteredStudentIdsForUnits>[0],
      'period-1',
      ['unit-cnd'],
    );

    expect(registeredIds.has('student-direct')).toBe(true);
    expect(registeredIds.has('student-sibling')).toBe(true);
    expect(registeredIds.has('student-transfer-active')).toBe(true);
    expect(registeredIds.has('student-unregistered')).toBe(false);
    expect(registeredIds.has('student-transfer-unregistered')).toBe(false);
    expect(registeredIds.has('student-completely-absent')).toBe(false);
  });
});
