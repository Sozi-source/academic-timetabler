import { describe, expect, it } from 'vitest';

import type { Cohort } from '@/features/cohorts/types';
import {
  generateCohortExportWorkbook,
  getCohortStatusLabel,
  type CohortExportStudent,
} from '@/features/cohorts/workbook';

describe('Cohort Excel Export', () => {
  const sampleCohorts: Cohort[] = [
    {
      id: 'cohort-1',
      programmeId: 'prog-1',
      code: 'DHN-SEP-2026',
      name: 'Diploma in Human Nutrition Sep 2026',
      intakeDate: '2026-09-01',
      expectedCompletionDate: '2028-08-31',
      currentAcademicPeriodNumber: 1,
      plannedSize: 40,
      actualSize: 38,
      status: 'active',
      isTimetableAvailable: true,
      notes: 'Morning intake group A',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: '2026-08-15T08:00:00Z',
      updatedAt: '2026-08-15T08:00:00Z',
      programme: {
        id: 'prog-1',
        code: 'DHN',
        name: 'Diploma in Human Nutrition',
        totalAcademicPeriods: 6,
        maximumCohortSize: 50,
        isActive: true,
        isTimetableAvailable: true,
      },
    },
    {
      id: 'cohort-2',
      programmeId: 'prog-1',
      code: 'DHN-JAN-2027',
      name: 'Diploma in Human Nutrition Jan 2027',
      intakeDate: '2027-01-10',
      expectedCompletionDate: '2029-01-09',
      currentAcademicPeriodNumber: 1,
      plannedSize: 30,
      actualSize: 0,
      status: 'planned',
      isTimetableAvailable: true,
      notes: null,
      createdBy: 'user-1',
      updatedBy: 'user-1',
      createdAt: '2026-08-20T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z',
      programme: {
        id: 'prog-1',
        code: 'DHN',
        name: 'Diploma in Human Nutrition',
        totalAcademicPeriods: 6,
        maximumCohortSize: 50,
        isActive: true,
        isTimetableAvailable: true,
      },
    },
    {
      id: 'cohort-3',
      programmeId: 'prog-2',
      code: 'DCN-MAY-2025',
      name: 'Diploma in Community Nutrition May 2025',
      intakeDate: '2025-05-01',
      expectedCompletionDate: '2027-04-30',
      currentAcademicPeriodNumber: 4,
      plannedSize: null, // Null planned size test
      actualSize: 22,
      status: 'active',
      isTimetableAvailable: false,
      notes: 'Clinical field rotation',
      createdBy: 'user-2',
      updatedBy: 'user-2',
      createdAt: '2025-04-10T09:00:00Z',
      updatedAt: '2025-04-10T09:00:00Z',
      programme: {
        id: 'prog-2',
        code: 'DCN',
        name: 'Diploma in Community Nutrition',
        totalAcademicPeriods: 6,
        maximumCohortSize: 40,
        isActive: true,
        isTimetableAvailable: true,
      },
    },
    {
      id: 'cohort-4',
      programmeId: 'prog-2',
      code: 'DCN-SEP-2024',
      name: 'Diploma in Community Nutrition Sep 2024',
      intakeDate: '2024-09-01',
      expectedCompletionDate: '2026-08-31',
      currentAcademicPeriodNumber: 6,
      plannedSize: 25,
      actualSize: 24,
      status: 'completed',
      isTimetableAvailable: false,
      notes: 'Awaiting graduation',
      createdBy: 'user-2',
      updatedBy: 'user-2',
      createdAt: '2024-08-10T09:00:00Z',
      updatedAt: '2024-08-10T09:00:00Z',
      programme: {
        id: 'prog-2',
        code: 'DCN',
        name: 'Diploma in Community Nutrition',
        totalAcademicPeriods: 6,
        maximumCohortSize: 40,
        isActive: true,
        isTimetableAvailable: true,
      },
    },
  ];

  const sampleStudents: CohortExportStudent[] = [
    {
      admissionNumber: 'DHN/2026/001',
      fullName: 'Amina Mohamed',
      cohortId: 'cohort-1',
      cohortCode: 'DHN-SEP-2026',
      cohortName: 'Diploma in Human Nutrition Sep 2026',
      programmeCode: 'DHN',
      programmeName: 'Diploma in Human Nutrition',
      currentStage: 'Y1S1',
      lifecycleStatus: 'active',
      academicPhase: 'in_class',
      phoneNumber: '+254711000111',
      email: 'amina.mohamed@example.ac.ke',
      detailsVerifiedAt: '2026-09-05T10:00:00Z',
    },
    {
      admissionNumber: 'DHN/2026/002',
      fullName: 'Brian Kipchoge',
      cohortId: 'cohort-1',
      cohortCode: 'DHN-SEP-2026',
      cohortName: 'Diploma in Human Nutrition Sep 2026',
      programmeCode: 'DHN',
      programmeName: 'Diploma in Human Nutrition',
      currentStage: 'Y1S1',
      lifecycleStatus: 'active',
      academicPhase: 'in_class',
      phoneNumber: null,
      email: null,
      detailsVerifiedAt: null,
    },
  ];

  it('correctly maps cohort status labels', () => {
    expect(getCohortStatusLabel('planned')).toBe('Planned');
    expect(getCohortStatusLabel('active')).toBe('Active');
    expect(getCohortStatusLabel('completed')).toBe('Completed');
    expect(getCohortStatusLabel('suspended')).toBe('Suspended');
    expect(getCohortStatusLabel('archived')).toBe('Archived');
    expect(getCohortStatusLabel('custom')).toBe('Custom');
  });

  it('generates a workbook with Cohorts and Summary sheets', async () => {
    const workbook = await generateCohortExportWorkbook({
      cohorts: sampleCohorts,
      students: sampleStudents,
      departmentName: 'Department of Nutrition & Dietetics',
    });

    const cohortsSheet = workbook.getWorksheet('Cohorts');
    const summarySheet = workbook.getWorksheet('Summary & Census');
    const studentsSheet = workbook.getWorksheet('Enrolled Students');

    expect(cohortsSheet).toBeDefined();
    expect(summarySheet).toBeDefined();
    expect(studentsSheet).toBeDefined();

    // Verify Cohorts Sheet content
    expect(cohortsSheet?.rowCount).toBe(5); // 1 header + 4 cohorts

    const row1 = cohortsSheet?.getRow(2);
    expect(row1?.getCell(1).value).toBe('DHN-SEP-2026');
    expect(row1?.getCell(2).value).toBe('Diploma in Human Nutrition Sep 2026');
    expect(row1?.getCell(3).value).toBe('DHN');
    expect(row1?.getCell(4).value).toBe('Diploma in Human Nutrition');
    expect(row1?.getCell(5).value).toBe('Y1S1');
    expect(row1?.getCell(6).value).toBe('Active');
    expect(row1?.getCell(7).value).toBe('Available');
    expect(row1?.getCell(8).value).toBe(38);
    expect(row1?.getCell(9).value).toBe(40);
    expect(row1?.getCell(10).value).toBe('95%'); // 38 / 40 = 95%
    expect(row1?.getCell(11).value).toBe('2026-09-01');
    expect(row1?.getCell(12).value).toBe('2028-08-31');
    expect(row1?.getCell(13).value).toBe('Morning intake group A');

    // Cohort with null planned size
    const row3 = cohortsSheet?.getRow(4);
    expect(row3?.getCell(1).value).toBe('DCN-MAY-2025');
    expect(row3?.getCell(5).value).toBe('Y2S1'); // period 4 -> Y2S1
    expect(row3?.getCell(9).value).toBe('—');
    expect(row3?.getCell(10).value).toBe('—');
    expect(row3?.getCell(7).value).toBe('Unavailable');
  });

  it('computes summary and census metrics accurately', async () => {
    const workbook = await generateCohortExportWorkbook({
      cohorts: sampleCohorts,
      departmentName: 'Department of Nutrition & Dietetics',
      filters: {
        programmeName: 'Diploma in Human Nutrition',
        status: 'active',
      },
    });

    const summarySheet = workbook.getWorksheet('Summary & Census');
    expect(summarySheet).toBeDefined();

    const textValues: string[] = [];
    summarySheet?.eachRow((row) => {
      row.eachCell((cell) => {
        textValues.push(String(cell.value));
      });
    });

    expect(textValues).toContain('Department of Nutrition & Dietetics');
    expect(textValues).toContain('Total Cohorts Registered');
    expect(textValues).toContain('Active Cohorts');
    expect(textValues).toContain('Planned Future Cohorts');
    expect(textValues).toContain('Filter: Programme');
    expect(textValues).toContain('Filter: Status');
  });

  it('generates the Enrolled Students sheet when students are present', async () => {
    const workbook = await generateCohortExportWorkbook({
      cohorts: sampleCohorts,
      students: sampleStudents,
    });

    const studentsSheet = workbook.getWorksheet('Enrolled Students');
    expect(studentsSheet).toBeDefined();
    expect(studentsSheet?.rowCount).toBe(3); // 1 header + 2 students

    const studentRow1 = studentsSheet?.getRow(2);
    expect(studentRow1?.getCell(1).value).toBe('DHN/2026/001');
    expect(studentRow1?.getCell(2).value).toBe('Amina Mohamed');
    expect(studentRow1?.getCell(3).value).toBe('DHN-SEP-2026');
    expect(studentRow1?.getCell(7).value).toBe('Y1S1');
    expect(studentRow1?.getCell(12).value).toBe('Yes');

    const studentRow2 = studentsSheet?.getRow(3);
    expect(studentRow2?.getCell(1).value).toBe('DHN/2026/002');
    expect(studentRow2?.getCell(10).value).toBe('—');
    expect(studentRow2?.getCell(12).value).toBe('No');
  });

  it('omits Enrolled Students sheet when no students are provided', async () => {
    const workbook = await generateCohortExportWorkbook({
      cohorts: sampleCohorts,
      students: [],
    });

    expect(workbook.getWorksheet('Cohorts')).toBeDefined();
    expect(workbook.getWorksheet('Summary & Census')).toBeDefined();
    expect(workbook.getWorksheet('Enrolled Students')).toBeUndefined();
  });

  it('handles empty cohorts collection gracefully', async () => {
    const workbook = await generateCohortExportWorkbook({
      cohorts: [],
    });

    const cohortsSheet = workbook.getWorksheet('Cohorts');
    const summarySheet = workbook.getWorksheet('Summary & Census');

    expect(cohortsSheet).toBeDefined();
    expect(summarySheet).toBeDefined();
    expect(cohortsSheet?.rowCount).toBe(1); // Header only
  });

  it('exports valid xlsx buffer without throwing', async () => {
    const workbook = await generateCohortExportWorkbook({
      cohorts: sampleCohorts,
      students: sampleStudents,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
