import { describe, expect, it } from 'vitest';

import { buildStudentUnitRegistrationPdf } from '@/features/student-portal/registration-pdf';
import type { StudentPortalRegistrationContext } from '@/features/student-portal/types';

describe('student unit registration PDF form migration check', () => {
  it('verifies PDF replacement', async () => {
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
          registrationId: 'reg-1',
          unitId: 'unit-1',
          unitCode: 'CND 1301',
          unitName: 'Unit One',
          registrationStatus: 'registered',
          source: 'department',
          registeredAt: '2026-08-29T00:00:00Z',
        },
      ],
    };

    const pdfBuffer = await buildStudentUnitRegistrationPdf(context);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
