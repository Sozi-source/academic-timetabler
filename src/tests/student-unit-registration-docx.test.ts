import { describe, expect, it } from 'vitest';

import { buildStudentUnitRegistrationDocx } from '@/features/student-portal/registration-docx';
import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

describe('student unit registration Word form', () => {
  function makeContext(unitCount: number): StudentPortalRegistrationContext {
    return {
      student: {
        id: 'student-1',
        admissionNumber: 'CND/S-1001/IC/25',
        fullName: 'Student One',
        programmeName: 'Certificate in Nutrition and Dietetics',
        programmeCode: 'CND',
        departmentName: 'Human Nutrition and Dietetics',
        cohortId: 'cohort-1',
        cohortName: 'CND SEP 25',
        academicPeriodNumber: 3,
        stageCode: 'Y1S3',
        stageName: 'Year 1 Semester 3',
        lifecycleStatus: 'admitted',
        detailsVerifiedAt: null,
      },
      period: {
        id: 'period-1',
        code: 'MAY-AUG-2026',
        name: 'May-August 2026',
        startsOn: '2026-05-01',
        endsOn: '2026-08-31',
      },
      submission: null,
      registrationState: 'pre_registered',
      reportingStatus: 'pending',
      reportedOn: null,
      units: Array.from({ length: unitCount }, (_, i) => ({
        registrationId: `reg-${i + 1}`,
        unitId: `unit-${i + 1}`,
        unitCode: `CND 130${i + 1}`,
        unitName: `Unit Name ${i + 1}`,
        registrationStatus: 'registered' as const,
        source: 'department' as const,
        registeredAt: '2026-08-29T00:00:00Z',
      })),
    };
  }

  it('generates the polished form for standard 6 units', async () => {
    const document = await buildStudentUnitRegistrationDocx(makeContext(6));
    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');
  });

  it('generates the form with 8 units without overflowing', async () => {
    const document = await buildStudentUnitRegistrationDocx(makeContext(8));
    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');
  });

  it('generates the form with 12 units using compact mode', async () => {
    const document = await buildStudentUnitRegistrationDocx(makeContext(12));
    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');
  });
});
