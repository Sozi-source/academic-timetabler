import { describe, expect, it } from 'vitest';

import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';

describe('unified unit roster domain logic', () => {
  it('includes only students explicitly registered for the unit, excluding unregistered cohort members', async () => {
    // Mock Supabase client returning 2 offering cohorts, 2 registered students, and 1 unregistered cohort student
    const mockSupabase = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          in: () => query,
          maybeSingle: async () => {
            if (table === 'teaching_allocations') {
              return {
                data: {
                  id: 'alloc-1',
                  unit_id: 'unit-1',
                  academic_period_id: 'period-1',
                  cohort_id: 'cohort-a',
                  participant_cohort_ids: ['cohort-b'],
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
          then: (resolve: any) => {
            if (table === 'unit_offerings') {
              return resolve({
                data: [{ cohort_id: 'cohort-a' }, { cohort_id: 'cohort-b' }],
                error: null,
              });
            }
            if (table === 'teaching_allocations') {
              return resolve({
                data: [{ cohort_id: 'cohort-a', participant_cohort_ids: ['cohort-b'] }],
                error: null,
              });
            }
            if (table === 'student_unit_registrations') {
              return resolve({
                data: [
                  {
                    student_id: 'student-1',
                    cohort_id: 'cohort-a',
                    registration_status: 'registered',
                    student: {
                      id: 'student-1',
                      admission_number: 'DHNT/2025/002',
                      full_name: 'Jane Doe',
                      current_cohort_id: 'cohort-a',
                      lifecycle_status: 'active',
                    },
                  },
                  {
                    student_id: 'student-3',
                    cohort_id: 'cohort-b',
                    registration_status: 'registered',
                    student: {
                      id: 'student-3',
                      admission_number: 'DHNT/2025/001',
                      full_name: 'Alice Wonder',
                      current_cohort_id: 'cohort-b',
                      lifecycle_status: 'active',
                    },
                  },
                ],
                error: null,
              });
            }
            if (table === 'cohorts') {
              return resolve({
                data: [
                  {
                    id: 'cohort-a',
                    name: 'CHN MAY 25',
                    code: 'CHN-MAY-25',
                    programme: {
                      id: 'prog-1',
                      name: 'Certificate in Community Health',
                      code: 'CCHN',
                      department: { id: 'dept-1', name: 'Health Sciences' },
                    },
                  },
                  {
                    id: 'cohort-b',
                    name: 'CHN JAN/MAR 25',
                    code: 'CHN-JAN-MAR-25',
                    programme: {
                      id: 'prog-1',
                      name: 'Certificate in Community Health',
                      code: 'CCHN',
                      department: { id: 'dept-1', name: 'Health Sciences' },
                    },
                  },
                ],
                error: null,
              });
            }
            if (table === 'students') {
              return resolve({
                data: [
                  // student-2 is in cohort-b but NOT registered for this unit
                  {
                    id: 'student-2',
                    admission_number: 'DHNT/2025/003',
                    full_name: 'Unregistered Student',
                    current_cohort_id: 'cohort-b',
                    lifecycle_status: 'active',
                  },
                ],
                error: null,
              });
            }
            return resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };

    const roster = await getUnifiedUnitRoster({
      supabase: mockSupabase,
      allocationId: 'alloc-1',
    });

    // 1. Both cohorts should be resolved for display headers
    expect(roster.cohortNames).toEqual(['CHN JAN/MAR 25', 'CHN MAY 25']);
    expect(roster.joinedCohortName).toBe('CHN JAN/MAR 25 / CHN MAY 25');

    // 2. Only registered students should be included (student-2 excluded)
    expect(roster.totalCount).toBe(2);
    expect(roster.students).toHaveLength(2);
    expect(roster.students.some((s) => s.studentId === 'student-2')).toBe(false);

    // 3. Naturally sorted by admission number (001 before 002)
    expect(roster.students[0].studentId).toBe('student-3');
    expect(roster.students[0].admissionNumber).toBe('DHNT/2025/001');
    expect(roster.students[0].registrationStatus).toBe('registered');
    expect(roster.students[0].cohortName).toBe('CHN JAN/MAR 25');

    expect(roster.students[1].studentId).toBe('student-1');
    expect(roster.students[1].admissionNumber).toBe('DHNT/2025/002');
    expect(roster.students[1].registrationStatus).toBe('registered');
    expect(roster.students[1].cohortName).toBe('CHN MAY 25');
  });

  it('handles empty parameters gracefully', async () => {
    const mockSupabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
    const roster = await getUnifiedUnitRoster({ supabase: mockSupabase });
    expect(roster.students).toEqual([]);
    expect(roster.totalCount).toBe(0);
    expect(roster.joinedCohortName).toBe('Cohort');
  });
});
