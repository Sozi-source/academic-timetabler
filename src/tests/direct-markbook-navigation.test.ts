import { describe, expect, it } from 'vitest';

describe('direct markbook navigation & cohort pre-selection', () => {
  interface MockCandidateRow {
    id: string;
    student: { id: string; admission_number: string; full_name: string };
    cohort: { id: string; code: string; name: string };
  }

  const samplePopulation: MockCandidateRow[] = [
    {
      id: 'pop-1',
      student: { id: 's1', admission_number: 'CND/2025/001', full_name: 'Alice Wanjiku' },
      cohort: { id: 'cohort-cnd', code: 'CND-2025', name: 'CND Jan 2025' },
    },
    {
      id: 'pop-2',
      student: { id: 's2', admission_number: 'CND/2025/002', full_name: 'Bob Kiprono' },
      cohort: { id: 'cohort-cnd', code: 'CND-2025', name: 'CND Jan 2025' },
    },
    {
      id: 'pop-3',
      student: { id: 's3', admission_number: 'DND/2025/001', full_name: 'Carol Akinyi' },
      cohort: { id: 'cohort-dnd', code: 'DND-2025', name: 'DND Jan 2025' },
    },
  ];

  function resolveInitialCohort(
    initialCohort: string | undefined,
    population: MockCandidateRow[],
  ): string {
    if (!initialCohort || initialCohort === 'all') return 'all';
    // Match directly by cohort UUID
    const matchesId = population.some((p) => p.cohort?.id === initialCohort);
    if (matchesId) return initialCohort;
    // Match by cohort name or code
    const found = population.find(
      (p) =>
        p.cohort?.name?.toLowerCase() === initialCohort.toLowerCase() ||
        p.cohort?.code?.toLowerCase() === initialCohort.toLowerCase(),
    );
    return found?.cohort?.id ?? initialCohort;
  }

  it('defaults to "all" cohorts when no initialCohort is specified', () => {
    expect(resolveInitialCohort(undefined, samplePopulation)).toBe('all');
    expect(resolveInitialCohort('all', samplePopulation)).toBe('all');
  });

  it('resolves cohort directly by cohort UUID', () => {
    expect(resolveInitialCohort('cohort-cnd', samplePopulation)).toBe('cohort-cnd');
    expect(resolveInitialCohort('cohort-dnd', samplePopulation)).toBe('cohort-dnd');
  });

  it('resiliently matches cohort by case-insensitive name or code', () => {
    expect(resolveInitialCohort('cnd jan 2025', samplePopulation)).toBe('cohort-cnd');
    expect(resolveInitialCohort('DND-2025', samplePopulation)).toBe('cohort-dnd');
  });

  it('constructs direct markbook routes avoiding dead-end roster pages', () => {
    const singleCohortUnit = {
      unitId: 'unit-anatomy',
      items: [
        { id: 'event-1', cohortId: 'cohort-cnd', cohortName: 'CND Jan 2025', totalExpected: 25 },
      ],
    };

    const multiCohortUnit = {
      unitId: 'unit-comm-skills',
      items: [
        { id: 'event-cnd', cohortId: 'cohort-cnd', cohortName: 'CND Jan 2025', totalExpected: 25 },
        { id: 'event-dnd', cohortId: 'cohort-dnd', cohortName: 'DND Jan 2025', totalExpected: 30 },
      ],
    };

    // Single cohort target
    const singleTarget = `/assessment/marks/${singleCohortUnit.items[0]?.id ?? singleCohortUnit.unitId}`;
    expect(singleTarget).toBe('/assessment/marks/event-1');

    // Multi-cohort individual cohort targets
    const cohortCNDTarget = `/assessment/marks/${multiCohortUnit.items[0]?.id}?cohortId=${encodeURIComponent(multiCohortUnit.items[0]?.cohortId)}`;
    expect(cohortCNDTarget).toBe('/assessment/marks/event-cnd?cohortId=cohort-cnd');

    const cohortDNDTarget = `/assessment/marks/${multiCohortUnit.items[0]?.id}?cohortId=${encodeURIComponent(multiCohortUnit.items[1]?.cohortId)}`;
    expect(cohortDNDTarget).toBe('/assessment/marks/event-cnd?cohortId=cohort-dnd');

    // Consolidated multi-cohort target (all cohorts)
    const consolidatedTarget = `/assessment/marks/${multiCohortUnit.items[0]?.id}`;
    expect(consolidatedTarget).toBe('/assessment/marks/event-cnd');
  });

  it('filters students by the resolved initialCohort', () => {
    const selectedCohort = resolveInitialCohort('cohort-dnd', samplePopulation);
    const filtered = samplePopulation.filter((row) =>
      selectedCohort === 'all' ? true : row.cohort.id === selectedCohort,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.student.admission_number).toBe('DND/2025/001');
  });
});
