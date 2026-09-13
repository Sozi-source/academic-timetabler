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

  it('includes students registered across equivalent units in a shared class', async () => {
    const mockSupabase = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          in: () => query,
          not: () => query,
          maybeSingle: async () => {
            if (table === 'teaching_allocations') {
              return {
                data: {
                  id: 'alloc-shared-1',
                  unit_id: 'unit-dnd-1104',
                  academic_period_id: 'period-1',
                  cohort_id: 'cohort-dnd',
                  participant_cohort_ids: ['cohort-cnd'],
                  teaching_offering_id: 'shared-offering-1',
                },
                error: null,
              };
            }
            if (table === 'units') {
              return {
                data: {
                  name: 'Principles of Human Nutrition',
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
          then: (resolve: any) => {
            if (table === 'unit_offerings') {
              return resolve({
                data: [
                  { unit_id: 'unit-dnd-1104', cohort_id: 'cohort-dnd', confirmed_shared_offering_id: 'shared-offering-1' },
                  { unit_id: 'unit-cnd-1104', cohort_id: 'cohort-cnd', confirmed_shared_offering_id: 'shared-offering-1' },
                ],
                error: null,
              });
            }
            if (table === 'teaching_allocations') {
              return resolve({
                data: [{ cohort_id: 'cohort-dnd', participant_cohort_ids: ['cohort-cnd'] }],
                error: null,
              });
            }
            if (table === 'student_unit_registrations') {
              return resolve({
                data: [
                  {
                    student_id: 'student-dnd-1',
                    cohort_id: 'cohort-dnd',
                    registration_status: 'registered',
                    student: {
                      id: 'student-dnd-1',
                      admission_number: 'DND/2026/001',
                      full_name: 'DND Student One',
                      current_cohort_id: 'cohort-dnd',
                      lifecycle_status: 'active',
                    },
                  },
                  {
                    student_id: 'student-cnd-1',
                    cohort_id: 'cohort-cnd',
                    registration_status: 'registered',
                    student: {
                      id: 'student-cnd-1',
                      admission_number: 'CND/2026/001',
                      full_name: 'CND Student One',
                      current_cohort_id: 'cohort-cnd',
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
                    id: 'cohort-cnd',
                    name: 'CND SEPT 26',
                    code: 'CND-SEP-2026',
                    programme: {
                      id: 'prog-cnd',
                      name: 'Certificate in Nutrition and Dietetics',
                      code: 'CND',
                      department: { id: 'dept-1', name: 'Nutrition' },
                    },
                  },
                  {
                    id: 'cohort-dnd',
                    name: 'DND SEPT 26',
                    code: 'DND-SEP-2026',
                    programme: {
                      id: 'prog-dnd',
                      name: 'Diploma in Nutrition and Dietetics',
                      code: 'DND',
                      department: { id: 'dept-1', name: 'Nutrition' },
                    },
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
      allocationId: 'alloc-shared-1',
    });

    expect(roster.cohortNames).toEqual(['CND SEPT 26', 'DND SEPT 26']);
    expect(roster.joinedCohortName).toBe('CND SEPT 26 / DND SEPT 26');
    expect(roster.totalCount).toBe(2);
    expect(roster.students).toHaveLength(2);
    expect(roster.students.map((s) => s.admissionNumber)).toEqual(['CND/2026/001', 'DND/2026/001']);
    expect(roster.students[0].cohortName).toBe('CND SEPT 26');
    expect(roster.students[1].cohortName).toBe('DND SEPT 26');
  });
});
