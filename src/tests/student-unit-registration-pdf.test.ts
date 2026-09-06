import { describe, expect, it } from 'vitest';

import { buildStudentUnitRegistrationPdf } from '@/features/student-portal/registration-pdf';
import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

describe('student unit registration PDF form', () => {
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

  function countPdfPages(buffer: Buffer): number {
    const text = buffer.toString('latin1');
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 0;
  }

  it('generates a valid PDF buffer for 1 unit on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(1));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 2 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(2));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 4 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(4));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 6 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(6));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 7 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(7));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 8 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(8));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 10 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(10));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });

  it('generates a valid PDF buffer for 12 units on exactly 1 page', async () => {
    const document = await buildStudentUnitRegistrationPdf(makeContext(12));
    expect(document.byteLength).toBeGreaterThan(1_000);
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
    expect(countPdfPages(document)).toBe(1);
  });
});
