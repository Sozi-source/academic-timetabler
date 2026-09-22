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

  it('generates multi-cohort separate sections for shared units', async () => {
    const document = await generateAttendanceSheetDocx({
      type: 'exam',
      institutionName: 'Imperial College of Medical and Health Sciences',
      campusName: 'Thika',
      schoolName: 'Imperial',
      departmentName: 'Nutrition and Dietetics',
      programmeName: 'Department of Nutrition and Dietetics',
      academicPeriodName: 'September-December 2026',
      unitCode: 'DND 1106 / CND 1106',
      unitName: 'Introduction to Nutrition',
      candidates: [
        {
          studentId: 'student-dnd-1',
          admissionNumber: 'DND/001/26',
          fullName: 'Alice DND',
          cohortName: 'DND SEPT 26',
        },
        {
          studentId: 'student-cnd-1',
          admissionNumber: 'CND/001/26',
          fullName: 'Bob CND',
          cohortName: 'CND SEPT 26',
        },
        {
          studentId: 'student-cnd-2',
          admissionNumber: 'CND/002/26',
          fullName: 'Charlie CND',
          cohortName: 'CND SEPT 26',
        },
      ],
    });

    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');
  });

  it('generates landscape class attendance document with full-width signoff table', async () => {
    const document = await generateAttendanceSheetDocx({
      type: 'class',
      institutionName: 'Imperial College of Medical and Health Sciences',
      campusName: 'Thika',
      schoolName: 'Imperial',
      departmentName: 'Applied Science',
      programmeName: 'Diploma in Science Laboratory Technology',
      academicPeriodName: 'September-December 2026',
      unitCode: 'DND 1104',
      unitName: 'Clinical Nutrition',
      trainerName: 'Wilfred Osozi',
      candidates: [
        {
          studentId: 'student-1',
          admissionNumber: 'DND/001/26',
          fullName: 'Alice DND',
          cohortName: 'DND SEPT 26',
        },
      ],
    });

    expect(document.byteLength).toBeGreaterThan(10_000);
    expect(document.subarray(0, 2).toString()).toBe('PK');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(document);
    const xml = await zip.file('word/document.xml')?.async('string');
    expect(xml).toBeDefined();

    // Verify keepLines is applied so text in sign-off labels remains unbroken
    expect(xml).toContain('<w:keepLines/>');

    // Verify table borders are set to none (no box borders around signoff cells)
    expect(xml).toContain('<w:tblBorders><w:top w:val="none"');

    // Verify underline border is applied to signature/writing lines
    expect(xml).toContain('w:bottom w:val="single" w:color="1F2937"');
  });
});



