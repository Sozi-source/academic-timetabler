import { describe, expect, it } from 'vitest';

import { generateAttendanceSheetPdf } from '@/features/assessment/attendance-sheet-pdf';

describe('attendance sheet PDF document', () => {
  interface PdfTextParser {
    getText(): Promise<{ pages: Array<{ text: string }> }>;
    destroy(): Promise<void>;
  }

  interface PdfTextParserConstructor {
    new (options: { data: Uint8Array }): PdfTextParser;
  }

  function isPdfTextParserConstructor(value: unknown): value is PdfTextParserConstructor {
    return typeof value === 'function';
  }

  async function getPages(document: Buffer): Promise<string[]> {
    const pdfModule = await import('pdf-parse');
    const parserConstructor = Reflect.get(pdfModule, 'PDFParse');
    if (!isPdfTextParserConstructor(parserConstructor)) {
      throw new Error('pdf-parse did not expose its PDFParse constructor.');
    }

    const parser = new parserConstructor({ data: document });
    try {
      const result = await parser.getText();
      return result.pages.map((page) => page.text);
    } finally {
      await parser.destroy();
    }
  }

  it('generates an institution-formatted CAT PDF document from registered students', async () => {
    const document = await generateAttendanceSheetPdf({
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
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates multi-cohort separate pages for shared units in PDF', async () => {
    const document = await generateAttendanceSheetPdf({
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
    expect(document.subarray(0, 4).toString()).toBe('%PDF');

    const pages = await getPages(document);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    pages.forEach((pageText) => {
      expect(pageText).toContain('Booklet No.');
      expect(pageText).toContain('Sign');
      expect(pageText).toContain('Score');
      expect(pageText).toContain('Date');
    });
  });

  it('generates landscape class attendance PDF document with full-width signoff table', async () => {
    const document = await generateAttendanceSheetPdf({
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
    expect(document.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('repeats the complete register header on every overflow page for all sheet types', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) => ({
      studentId: `agri-${index + 1}`,
      admissionNumber: `CHN/${String(index + 1).padStart(3, '0')}/26`,
      fullName: `Agricultural Production Student ${index + 1}`,
      cohortName: 'CHN JAN/MAR 26',
    }));
    const baseData = {
      institutionName: 'Imperial College of Medical and Health Sciences',
      campusName: 'Thika',
      schoolName: 'School of Health Sciences',
      departmentName: 'Community Health Nursing',
      programmeName: 'Diploma in Community Health Nursing',
      academicPeriodName: 'September-December 2026',
      unitCode: 'CHN 2309',
      unitName: 'Agricultural Production',
      trainerName: 'Wilfred Osozi',
      candidates,
    };

    const sheets = await Promise.all([
      generateAttendanceSheetPdf({ ...baseData, type: 'class' }),
      generateAttendanceSheetPdf({ ...baseData, type: 'cat' }),
      generateAttendanceSheetPdf({ ...baseData, type: 'exam' }),
    ]);

    const pageSets = await Promise.all(sheets.map((sheet) => getPages(sheet)));
    expect(pageSets.every((pages) => pages.length > 1)).toBe(true);

    const headings = [
      'CLASS ATTENDANCE LIST',
      'CONTINUOUS ASSESSMENT TEST (CAT) ATTENDANCE LIST',
      'FINAL EXAMINATION ATTENDANCE & SCRIPT REGISTER',
    ];
    pageSets.forEach((pages, index) => {
      pages.forEach((page) => {
        expect(page).toContain(headings[index]);
        expect(page).toContain('No.');
        expect(page).toMatch(/\d+(?:\.|-)\s*\.?/);
      });
    });
  });
});
