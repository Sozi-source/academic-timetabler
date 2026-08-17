import { randomInt } from 'node:crypto';
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return NextResponse.json({ message: 'No active department.' }, { status: 400 });

  const admin = createAdminClient();
  const supabase = await createClient();
  const [{ data: students, error: studentError }, { data: credentials, error: credentialError }] = await Promise.all([
    admin.from('students').select('id, admission_number, full_name').eq('department_id', profile.activeDepartmentId).in('lifecycle_status', ['admitted', 'active']).order('full_name'),
    admin.from('student_portal_credentials').select('student_id'),
  ]);
  if (studentError || credentialError) return NextResponse.json({ message: 'Unable to prepare student access.' }, { status: 500 });

  const issued = new Set((credentials ?? []).map((row) => row.student_id));
  const rows: string[][] = [['Admission Number', 'Student Name', 'Access PIN']];
  for (const student of students ?? []) {
    if (issued.has(student.id)) continue;
    const pin = String(randomInt(100000, 1000000));
    const { error } = await supabase.rpc('set_student_portal_pin', { target_student_id: student.id, plain_pin: pin });
    if (!error) rows.push([student.admission_number, student.full_name, pin]);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Student Access');
  sheet.columns = [{ width: 24 }, { width: 34 }, { width: 16 }];
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F706B' } };
  if (rows.length === 1) sheet.addRow(['', 'All active students already have portal access.', '']);
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="student-portal-access-pins.xlsx"',
    'Cache-Control': 'no-store',
  }});
}
