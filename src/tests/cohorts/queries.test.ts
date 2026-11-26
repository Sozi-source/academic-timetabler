import { describe, expect, it, vi } from 'vitest';

const cohortRowsFixture = [
  {
    id: 'cohort-planned-cnd',
    programme_id: 'prog-cnd',
    code: 'CND-JAN-2027',
    name: 'CND JAN 2027',
    intake_date: '2027-01-04',
    expected_completion_date: '2028-12-29',
    current_academic_period_number: 1,
    planned_size: 40,
    actual_size: 0,
    status: 'planned' as const,
    is_timetable_available: true,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-11-26T00:00:00.000Z',
    updated_at: '2026-11-26T00:00:00.000Z',
    programmes: {
      id: 'prog-cnd',
      code: 'CND',
      name: 'Certificate in Nutrition and Dietetics',
      total_academic_periods: 6,
      maximum_cohort_size: 60,
      is_active: true,
      is_timetable_available: true,
    },
  },
  {
    id: 'cohort-planned-dnd-zero',
    programme_id: 'prog-dnd',
    code: 'DND-JAN-2027',
    name: 'DND JAN 2027',
    intake_date: '2027-01-04',
    expected_completion_date: '2029-12-28',
    current_academic_period_number: 1,
    planned_size: null,
    actual_size: 0,
    status: 'planned' as const,
    is_timetable_available: true,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-11-26T00:00:00.000Z',
    updated_at: '2026-11-26T00:00:00.000Z',
    programmes: {
      id: 'prog-dnd',
      code: 'DND',
      name: 'Diploma in Nutrition and Dietetics',
      total_academic_periods: 9,
      maximum_cohort_size: 60,
      is_active: true,
      is_timetable_available: true,
    },
  },
  {
    id: 'cohort-active-existing',
    programme_id: 'prog-dnd',
    code: 'DND-SEP-2026',
    name: 'DND SEP 2026',
    intake_date: '2026-09-07',
    expected_completion_date: '2029-08-31',
    current_academic_period_number: 1,
    planned_size: null,
    actual_size: 12,
    status: 'active' as const,
    is_timetable_available: true,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    programmes: {
      id: 'prog-dnd',
      code: 'DND',
      name: 'Diploma in Nutrition and Dietetics',
      total_academic_periods: 9,
      maximum_cohort_size: 60,
      is_active: true,
      is_timetable_available: true,
    },
  },
  {
    id: 'cohort-completed',
    programme_id: 'prog-cnd',
    code: 'CND-JAN-2024',
    name: 'CND JAN 2024',
    intake_date: '2024-01-08',
    expected_completion_date: '2025-12-19',
    current_academic_period_number: 6,
    planned_size: null,
    actual_size: 35,
    status: 'completed' as const,
    is_timetable_available: true,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2025-12-20T00:00:00.000Z',
    programmes: {
      id: 'prog-cnd',
      code: 'CND',
      name: 'Certificate in Nutrition and Dietetics',
      total_academic_periods: 6,
      maximum_cohort_size: 60,
      is_active: true,
      is_timetable_available: true,
    },
  },
];

const studentRowsFixture = [
  { current_cohort_id: 'cohort-active-existing' },
  { current_cohort_id: 'cohort-active-existing' },
  { current_cohort_id: 'cohort-active-existing' },
];

const capturedFilters: Array<{
  table: string;
  method: string;
  column: string;
  value: unknown;
}> = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'cohorts') {
        let rows = [...cohortRowsFixture];
        const builder = {
          select: () => builder,
          in: (column: string, values: unknown[]) => {
            capturedFilters.push({ table, method: 'in', column, value: values });
            rows = rows.filter((row) =>
              values.includes(row[column as keyof typeof row]),
            );
            return builder;
          },
          eq: (column: string, value: unknown) => {
            capturedFilters.push({ table, method: 'eq', column, value });
            rows = rows.filter(
              (row) => row[column as keyof typeof row] === value,
            );
            return builder;
          },
          order: async () => ({ data: rows, error: null }),
        };
        return builder;
      }

      if (table === 'students') {
        const builder = {
          select: () => builder,
          in: async () => ({ data: studentRowsFixture, error: null }),
        };
        return builder;
      }

      throw new Error(`Unexpected table query: ${table}`);
    },
  }),
}));

import { getTimetableAvailableCohorts } from '@/features/cohorts/queries';

describe('getTimetableAvailableCohorts', () => {
  it('includes both active and planned timetable-available cohorts for future period scheduling', async () => {
    const cohorts = await getTimetableAvailableCohorts();

    expect(
      capturedFilters.some(
        (entry) =>
          entry.table === 'cohorts' &&
          entry.method === 'in' &&
          entry.column === 'status' &&
          Array.isArray(entry.value) &&
          entry.value.includes('active') &&
          entry.value.includes('planned'),
      ),
    ).toBe(true);

    expect(cohorts.map((cohort) => cohort.code)).toEqual([
      'CND-JAN-2027',
      'DND-JAN-2027',
      'DND-SEP-2026',
    ]);

    const cndPlanned = cohorts.find((cohort) => cohort.code === 'CND-JAN-2027');
    expect(cndPlanned?.actualSize).toBe(40);

    const dndPlanned = cohorts.find((cohort) => cohort.code === 'DND-JAN-2027');
    expect(dndPlanned?.actualSize).toBe(0);

    const dndActive = cohorts.find((cohort) => cohort.code === 'DND-SEP-2026');
    expect(dndActive?.actualSize).toBe(3);
  });
});
