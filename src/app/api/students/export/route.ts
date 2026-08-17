import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const profile = await requireHodAccess();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('students')
    .select(`
      admission_number,full_name,lifecycle_status,academic_phase,kcse_index_number,national_id_number,
      phone_number,email,admission_date,projected_completion_date,completion_date,graduation_date,
      details_verified_at,notes,
      programme:programmes!students_programme_id_fkey(code,name),
      admission_cohort:cohorts!students_admission_cohort_id_fkey(code,name),
      current_cohort:cohorts!students_current_cohort_id_fkey(code,name)
    `)
    .eq('department_id', profile.activeDepartmentId)
    .order('full_name');

  if (error) return NextResponse.json({ message: 'Unable to export students.' }, { status: 500 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Academic Management System';
  const sheet = workbook.addWorksheet('Students', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Admission Number', width: 24 },
    { header: 'Full Name', width: 34 },
    { header: 'Programme', width: 18 },
    { header: 'Admission Cohort', width: 24 },
    { header: 'Current Cohort', width: 24 },
    { header: 'Lifecycle Status', width: 18 },
    { header: 'Academic Phase', width: 20 },
    { header: 'KCSE Index Number', width: 22 },
    { header: 'National ID Number', width: 20 },
    { header: 'Phone Number', width: 18 },
    { header: 'Email', width: 30 },
    { header: 'Admission Date', width: 16 },
    { header: 'Projected Completion', width: 20 },
    { header: 'Completion Date', width: 16 },
    { header: 'Graduation Date', width: 16 },
    { header: 'Details Verified', width: 18 },
    { header: 'Notes', width: 36 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
  sheet.autoFilter = { from: 'A1', to: 'Q1' };

  for (const row of data ?? []) {
    const programme = Array.isArray(row.programme) ? row.programme[0] : row.programme;
    const admissionCohort = Array.isArray(row.admission_cohort) ? row.admission_cohort[0] : row.admission_cohort;
    const currentCohort = Array.isArray(row.current_cohort) ? row.current_cohort[0] : row.current_cohort;
    sheet.addRow([
      row.admission_number,row.full_name,programme?.code ?? '',admissionCohort?.name ?? '',currentCohort?.name ?? '',
      row.lifecycle_status,row.academic_phase,row.kcse_index_number ?? '',row.national_id_number ?? '',row.phone_number ?? '',row.email ?? '',
      row.admission_date ?? '',row.projected_completion_date ?? '',row.completion_date ?? '',row.graduation_date ?? '',
      row.details_verified_at ? 'Yes' : 'No',row.notes ?? '',
    ]);
  }
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (index > 1 && index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF9' } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="department-students.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  });
}
