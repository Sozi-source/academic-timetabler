import { describe, expect, it } from 'vitest';

import { generateAttendanceSheetDocx } from '@/features/assessment/attendance-sheet-docx';

describe('attendance sheet Word document', () => {
  it('generates an institution-formatted CAT document from registered students', async () => {
    const document = await generateAttendanceSheetDocx({
      type: 'cat',
      institutionName: 'Imperial College of Medical and Health Sciences',
      campusName: 'Thika',
      schoolName: 'Imperial',
      departmentName: 'Human Nutrition and Dietetics',
      programmeName: 'Diploma in Human Nutrition and Dietetics',
      academicPeriodName: 'September-December 2026',
      unitCode: 'DHN 2304',
      unitName: 'Nutrition Epidemiology',
      candidates: [
        {
          studentId: 'student-two',
          admissionNumber: 'DHNT/J-7189/IC/26',
          fullName: 'Student Two',
        },
        {
          studentId: 'student-one',
          admissionNumber: 'DHNT/J-7021/IC/26',
          fullName: 'Student One',
        },
      ],
    });

    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');
  });
});

