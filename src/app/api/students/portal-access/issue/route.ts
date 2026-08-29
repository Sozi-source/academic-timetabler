import { randomInt } from 'node:crypto';
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';

interface RegisterRow {
  student_id: string;
  admission_number: string;
  full_name: string;
  has_credential: boolean;
}

export async function POST(request: Request) {
  await requireHodAccess();

  const url = new URL(request.url);
  const forceAll = url.searchParams.get('forceAll') === 'true';

  const supabase = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await supabase.rpc(
    'get_student_portal_access_register',
  );

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: error.code === '42501' ? 403 : 500 },
    );
  }

  const students = (data ?? []) as RegisterRow[];
  const targetStudents = forceAll
    ? students
    : students.filter((student) => !student.has_credential);

  const rows: string[][] = [
    ['Admission Number', 'Student Name', 'Access PIN'],
  ];

  for (const student of targetStudents) {
    const pin = String(randomInt(100000, 1000000));

    const { error: pinError } = await supabase.rpc('set_student_portal_pin', {
      target_student_id: student.student_id,
      plain_pin: pin,
    });

    if (!pinError) {
      rows.push([student.admission_number, student.full_name, pin]);
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Student Access PINs');

  sheet.columns = [
    { width: 24 },
    { width: 36 },
    { width: 16 },
  ];

  sheet.addRows(rows);

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'C1' };

  if (rows.length === 1) {
    sheet.addRow(['', 'No students required PIN generation.', '']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = forceAll
    ? 'all-student-portal-access-pins.xlsx'
    : 'new-student-portal-access-pins.xlsx';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
