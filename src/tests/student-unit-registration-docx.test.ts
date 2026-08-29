import { describe, expect, it } from 'vitest';

import { buildStudentUnitRegistrationDocx } from '@/features/student-portal/registration-docx';
import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

describe('student unit registration Word form', () => {
  it('generates the polished HOD-assigned form with one registered-unit roster', async () => {
    const context: StudentPortalRegistrationContext = {
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
      units: [
        {
          registrationId: 'registration-2',
          unitId: 'unit-2',
          unitCode: 'CND 1302',
          unitName: 'Meal Planning, Management and Service',
          registrationStatus: 'registered',
          source: 'department',
          registeredAt: '2026-08-29T00:00:00Z',
        },
        {
          registrationId: 'registration-1',
          unitId: 'unit-1',
          unitCode: 'CND 1301',
          unitName: 'Basic Mathematics',
          registrationStatus: 'registered',
          source: 'department',
          registeredAt: '2026-08-29T00:00:00Z',
        },
      ],
    };

    const document = await buildStudentUnitRegistrationDocx(context);

    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');
  });
});

