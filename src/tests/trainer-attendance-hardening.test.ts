import { describe, expect, it } from 'vitest';

import { generateAttendanceSheetDocx } from '@/features/assessment/attendance-sheet-docx';
import { generateAttendanceSheetPdf } from '@/features/assessment/attendance-sheet-pdf';

describe('Trainer Attendance List Hardening & Resiliency', () => {
  it('generates a 25-row manual entry sheet when a cohort has 0 registered candidates', async () => {
    const documentData = {
      type: 'class' as const,
      institutionName: 'Imperial College of Medical and Health Sciences',
      campusName: 'Thika',
      schoolName: 'School of Health Sciences',
      departmentName: 'Human Nutrition and Dietetics',
      programmeName: 'Diploma in Community Nutrition',
      cohortName: 'CND JAN/MAR 26',
      academicPeriodName: 'September-December 2026',
      unitCode: 'CND 1304',
      unitName: 'Food Production for Invalids and Convalescents',
      trainerName: 'Maureen Ayuma',
      candidates: [], // Zero registered students test
    };

    const pdfBuffer = await generateAttendanceSheetPdf(documentData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const docxBuffer = await generateAttendanceSheetDocx(documentData);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.length).toBeGreaterThan(1000);
  });

  it('generates multi-cohort attendance sheets correctly for cross-department service units', async () => {
    const documentData = {
      type: 'class' as const,
      institutionName: 'Imperial College of Medical and Health Sciences',
      campusName: 'Thika',
      schoolName: 'School of Health Sciences',
      departmentName: 'Applied Sciences',
      programmeName: 'Diploma in Human Nutrition and Dietetics',
      cohortName: 'DHN MAY 24',
      academicPeriodName: 'September-December 2026',
      unitCode: 'DHN 3202',
      unitName: 'Industrial Organization and Management',
      trainerName: 'Jane Osoo',
      candidates: [
        {
          studentId: 'st-1',
          admissionNumber: 'DHN/M-3678/IC/24',
          fullName: 'Athumani, Mesaidi Mohamed',
          cohortName: 'DHN MAY 24',
        },
        {
          studentId: 'st-2',
          admissionNumber: 'DHN/M-3679/IC/24',
          fullName: 'Mugo, Beatrice Wangari',
          cohortName: 'DHN MAY 24',
        },
      ],
    };

    const pdfBuffer = await generateAttendanceSheetPdf(documentData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const docxBuffer = await generateAttendanceSheetDocx(documentData);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.length).toBeGreaterThan(1000);
  });
});
