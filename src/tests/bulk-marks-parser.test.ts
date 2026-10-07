import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseBulkMarksSpreadsheet,
  matchAndValidateBulkMarks,
  type StudentRosterCandidate,
} from '@/features/assessment/marks/bulk-upload-parser';

describe('Bulk Marks Spreadsheet Parser', () => {
  it('parses an Excel workbook with component marks and matches roster', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Class A');

    sheet.getRow(7).values = [
      'No.',
      'Admission Number',
      'Student Name',
      'Attendance',
      'Assignment /5',
      'Presentation /10',
      'RAT /15',
      'CAT /15',
      'Exam /70',
      'RAT/CAT /15',
      'Final /100',
    ];

    sheet.getRow(8).values = [
      1,
      'ADM-001',
      'Alice Doe',
      'Expected',
      4.5,
      9.0,
      13.5,
      14.0,
      60,
      13.75,
      87.25,
    ];

    sheet.getRow(9).values = [
      2,
      'ADM-002',
      'Bob Smith',
      'Absent',
      3.0,
      7.0,
      10.0,
      12.0,
      'AB',
      11.0,
      null,
    ];

    sheet.getRow(10).values = [
      3,
      'UNKNOWN-999',
      'Charlie Brown',
      'Expected',
      5,
      10,
      15,
      15,
      70,
      15,
      100,
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const rawRows = await parseBulkMarksSpreadsheet(buffer);

    expect(rawRows).toHaveLength(3);
    expect(rawRows[0].admissionNumber).toBe('ADM-001');
    expect(rawRows[0].assignment).toBe(4.5);
    expect(rawRows[0].exam).toBe(60);

    expect(rawRows[1].admissionNumber).toBe('ADM-002');
    expect(rawRows[1].isAbsent).toBe(true);
    expect(rawRows[1].exam).toBeNull();

    const roster: StudentRosterCandidate[] = [
      { studentId: 'uuid-1', admissionNumber: 'ADM-001', fullName: 'Alice Doe' },
      { studentId: 'uuid-2', admissionNumber: 'ADM-002', fullName: 'Bob Smith' },
      { studentId: 'uuid-3', admissionNumber: 'ADM-003', fullName: 'David Evans' },
    ];

    const result = matchAndValidateBulkMarks(rawRows, roster);

    expect(result.matchedCount).toBe(2);
    expect(result.unmatchedCount).toBe(1);
    expect(result.unmatched[0].admissionNumber).toBe('UNKNOWN-999');
    expect(result.missingCount).toBe(1);
    expect(result.missing[0].admissionNumber).toBe('ADM-003');
    expect(result.errorCount).toBe(0);

    const alice = result.matched.find((m) => m.admissionNumber === 'ADM-001');
    expect(alice).toBeDefined();
    expect(alice?.assignment).toBe(4.5);
    expect(alice?.presentation).toBe(9.0);
    expect(alice?.ratCatAverage).toBe(13.75);
    expect(alice?.finalTotal).toBe(87.25);

    const bob = result.matched.find((m) => m.admissionNumber === 'ADM-002');
    expect(bob).toBeDefined();
    expect(bob?.attendanceStatus).toBe('absent');
    expect(bob?.exam).toBeNull();
  });

  it('detects out-of-range marks and records errors', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Class');

    sheet.getRow(1).values = ['Adm No', 'Student', 'Assignment', 'Exam'];
    sheet.getRow(2).values = ['ADM-001', 'Alice', 10, 85]; // Exceeds assignment max 5 and exam max 70

    const buffer = await workbook.xlsx.writeBuffer();
    const rawRows = await parseBulkMarksSpreadsheet(buffer);

    const roster: StudentRosterCandidate[] = [
      { studentId: 'uuid-1', admissionNumber: 'ADM-001', fullName: 'Alice' },
    ];

    const result = matchAndValidateBulkMarks(rawRows, roster);

    expect(result.matchedCount).toBe(1);
    expect(result.errorCount).toBe(2);
    expect(result.errors.some((e) => e.includes('Assignment mark (10)'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Exam mark (85)'))).toBe(true);
  });
});
