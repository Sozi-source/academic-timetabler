import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { getUnitRegistrationContext } from '@/features/student-unit-registration/queries';
import type { RegistrationStudent } from '@/features/student-unit-registration/types';

const registrationStatuses = new Set([
  'all',
  'ineligible',
  'registered',
  'pending',
  'submitted',
  'verified',
  'returned',
]);

function getRegistrationStatusLabel(student: RegistrationStudent): string {
  if (student.academicPhase === 'attachment') return 'Not eligible - On attachment';
  if (student.status === 'verified') return 'Verified';
  if (student.status === 'submitted') return student.hasException ? 'Review' : 'Submitted';
  if (student.status === 'returned') return 'Returned';
  if (student.selectedUnits >= student.expectedUnits && student.expectedUnits > 0) return 'Registered';
  if (student.selectedUnits > 0) return `Partial (${student.selectedUnits}/${student.expectedUnits})`;
  return 'Pending';
}

function matchesStatus(student: RegistrationStudent, status: string): boolean {
  if (status === 'all') return true;
  if (status === 'ineligible') return student.academicPhase === 'attachment';
  if (student.academicPhase === 'attachment') return false;
  if (status === 'registered') {
    return student.selectedUnits >= student.expectedUnits && student.expectedUnits > 0;
  }
  if (status === 'pending') {
    return student.selectedUnits === 0 && student.status === 'not_submitted';
  }
  return student.status === status;
}

export async function GET(request: Request) {
  await requireHodAccess();

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim().toLocaleLowerCase() ?? '';
  const status = url.searchParams.get('status')?.trim() || 'all';
  const cohort = url.searchParams.get('cohort')?.trim() || 'all';

  if (!registrationStatuses.has(status)) {
    return NextResponse.json({ message: 'Invalid registration status filter.' }, { status: 400 });
  }

  const context = await getUnitRegistrationContext();
  if (!context.period) {
    return NextResponse.json({ message: 'There is no active academic period to export.' }, { status: 404 });
  }

  const students = context.students.filter((student) => {
    const matchesSearch = !search ||
      student.fullName.toLocaleLowerCase().includes(search) ||
      student.admissionNumber.toLocaleLowerCase().includes(search);
    const matchesCohort = cohort === 'all' || student.cohortName === cohort;
    return matchesSearch && matchesCohort && matchesStatus(student, status);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Planning System';
  workbook.subject = `Unit registration status for ${context.period.name}`;

  const sheet = workbook.addWorksheet('Unit Registration', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: 'Admission Number', key: 'admissionNumber', width: 24 },
    { header: 'Student Name', key: 'fullName', width: 34 },
    { header: 'Programme', key: 'programme', width: 16 },
    { header: 'Cohort', key: 'cohort', width: 28 },
    { header: 'Academic Phase', key: 'academicPhase', width: 20 },
    { header: 'Selected Units', key: 'selectedUnits', width: 16 },
    { header: 'Expected Units', key: 'expectedUnits', width: 16 },
    { header: 'Registration Status', key: 'registrationStatus', width: 22 },
    { header: 'Submission Status', key: 'submissionStatus', width: 20 },
    { header: 'Has Exception', key: 'hasException', width: 16 },
    { header: 'Exception Reason', key: 'exceptionReason', width: 42 },
    { header: 'Verification Note', key: 'verificationNote', width: 42 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F706B' },
  };
  sheet.autoFilter = { from: 'A1', to: 'L1' };

  for (const student of students) {
    sheet.addRow({
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      programme: student.programmeCode,
      cohort: student.cohortName ?? '',
      academicPhase: student.academicPhase.replaceAll('_', ' '),
      selectedUnits: student.academicPhase === 'attachment' ? 'Not applicable' : student.selectedUnits,
      expectedUnits: student.academicPhase === 'attachment' ? 'Not applicable' : student.expectedUnits,
      registrationStatus: getRegistrationStatusLabel(student),
      submissionStatus: student.academicPhase === 'attachment' ? 'Not applicable' : student.status.replaceAll('_', ' '),
      hasException: student.hasException ? 'Yes' : 'No',
      exceptionReason: student.exceptionReason ?? '',
      verificationNote: student.verificationNote ?? '',
    });
  }

  sheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7FAF9' },
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const periodSlug = context.period.code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `unit-registration-${periodSlug || 'active-period'}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
