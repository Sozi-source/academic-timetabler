import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

type ExportStudent = {
  admission_number: string;
  full_name: string;
  lifecycle_status: string;
  academic_phase: string;
  details_verified_at: string | null;
  programme: { code: string; name: string } | { code: string; name: string }[] | null;
  admission_cohort: { code: string; name: string } | { code: string; name: string }[] | null;
  current_cohort: { code: string; name: string } | { code: string; name: string }[] | null;
};

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
  row.alignment = { vertical: 'middle' };
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (index > 1 && index % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF9' } };
    }
  });
}

export async function GET() {
  const profile = await requireHodAccess();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('students')
    .select(`
      admission_number,full_name,lifecycle_status,academic_phase,details_verified_at,
      programme:programmes!students_programme_id_fkey(code,name),
      admission_cohort:cohorts!students_admission_cohort_id_fkey(code,name),
      current_cohort:cohorts!students_current_cohort_id_fkey(code,name)
    `)
    .eq('department_id', profile.activeDepartmentId)
    .order('full_name');

  if (error) return NextResponse.json({ message: 'Unable to export student report.' }, { status: 500 });

  const students = (data ?? []) as unknown as ExportStudent[];
  const lifecycle = new Map<string, number>();
  const programmes = new Map<string, { total: number; active: number; attachment: number; deferred: number; completed: number; graduated: number }>();
  const cohorts = new Map<string, { total: number; active: number; attachment: number; deferred: number }>();

  for (const student of students) {
    lifecycle.set(student.lifecycle_status, (lifecycle.get(student.lifecycle_status) ?? 0) + 1);

    const programme = relation(student.programme)?.code ?? 'Unassigned';
    const p = programmes.get(programme) ?? { total: 0, active: 0, attachment: 0, deferred: 0, completed: 0, graduated: 0 };
    p.total += 1;
    if (student.lifecycle_status === 'active') p.active += 1;
    if (student.lifecycle_status === 'deferred') p.deferred += 1;
    if (student.lifecycle_status === 'completed') p.completed += 1;
    if (student.lifecycle_status === 'graduated') p.graduated += 1;
    if (student.lifecycle_status === 'active' && student.academic_phase === 'attachment') p.attachment += 1;
    programmes.set(programme, p);

    const current = relation(student.current_cohort)?.name ?? relation(student.admission_cohort)?.name ?? 'Unassigned';
    const c = cohorts.get(current) ?? { total: 0, active: 0, attachment: 0, deferred: 0 };
    c.total += 1;
    if (student.lifecycle_status === 'active') c.active += 1;
    if (student.lifecycle_status === 'deferred') c.deferred += 1;
    if (student.lifecycle_status === 'active' && student.academic_phase === 'attachment') c.attachment += 1;
    cohorts.set(current, c);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Management System';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ header: 'Category', width: 28 }, { header: 'Students', width: 16 }];
  styleHeader(summary.getRow(1));
  for (const key of ['active', 'deferred', 'dropped_out', 'completed', 'graduated']) {
    summary.addRow([key.replaceAll('_', ' '), lifecycle.get(key) ?? 0]);
  }
  summary.addRow(['attachment', students.filter((student) => student.lifecycle_status === 'active' && student.academic_phase === 'attachment').length]);
  summary.addRow(['total', students.length]);
  styleSheet(summary);

  const programmeSheet = workbook.addWorksheet('By Programme');
  programmeSheet.columns = [
    { header: 'Programme', width: 20 }, { header: 'Total', width: 12 }, { header: 'Active', width: 12 },
    { header: 'Attachment', width: 14 }, { header: 'Deferred', width: 12 }, { header: 'Completed', width: 12 }, { header: 'Graduated', width: 12 },
  ];
  styleHeader(programmeSheet.getRow(1));
  for (const [programme, counts] of [...programmes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    programmeSheet.addRow([programme, counts.total, counts.active, counts.attachment, counts.deferred, counts.completed, counts.graduated]);
  }
  styleSheet(programmeSheet);

  const cohortSheet = workbook.addWorksheet('By Cohort');
  cohortSheet.columns = [
    { header: 'Cohort', width: 34 }, { header: 'Total', width: 12 }, { header: 'Active', width: 12 },
    { header: 'Attachment', width: 14 }, { header: 'Deferred', width: 12 },
  ];
  styleHeader(cohortSheet.getRow(1));
  for (const [cohort, counts] of [...cohorts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    cohortSheet.addRow([cohort, counts.total, counts.active, counts.attachment, counts.deferred]);
  }
  styleSheet(cohortSheet);

  const studentSheet = workbook.addWorksheet('Student Register');
  studentSheet.columns = [
    { header: 'Admission Number', width: 24 }, { header: 'Full Name', width: 34 }, { header: 'Programme', width: 18 },
    { header: 'Admission Cohort', width: 28 }, { header: 'Current Cohort', width: 28 }, { header: 'Lifecycle Status', width: 18 },
    { header: 'Academic Phase', width: 20 }, { header: 'Details Verified', width: 18 },
  ];
  styleHeader(studentSheet.getRow(1));
  for (const student of students) {
    studentSheet.addRow([
      student.admission_number,
      student.full_name,
      relation(student.programme)?.code ?? '',
      relation(student.admission_cohort)?.name ?? '',
      relation(student.current_cohort)?.name ?? '',
      student.lifecycle_status.replaceAll('_', ' '),
      student.academic_phase.replaceAll('_', ' '),
      student.details_verified_at ? 'Yes' : 'No',
    ]);
  }
  styleSheet(studentSheet);
  studentSheet.autoFilter = { from: 'A1', to: 'H1' };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="student-census-report.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  });
}
