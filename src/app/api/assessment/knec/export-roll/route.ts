import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Relation<T> = T | T[] | null;
function one<T>(v: Relation<T>): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

export async function GET(request: Request) {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) {
    return NextResponse.json({ message: 'No active department.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const seriesId = searchParams.get('seriesId')?.trim() || '';
  const admin = createAdminClient() as unknown as SupabaseClient;
  const departmentId = profile.activeDepartmentId;

  let targetSeriesName = 'ALL-SERIES';
  let bookingQuery = admin
    .from('student_knec_bookings')
    .select(`
      id,series_id,knec_index_number,booking_type,booking_status,
      series:knec_exam_series(series_code,series_name),
      student:students(
        id,admission_number,full_name,kcse_index_number,national_id_number,
        phone_number,birth_certificate_entry_number,knec_index_number,
        programme:programmes(code,name),
        current_cohort:cohorts!students_current_cohort_id_fkey(name)
      )
    `)
    .eq('department_id', departmentId)
    .neq('booking_status', 'cancelled')
    .order('created_at', { ascending: true });

  if (seriesId && seriesId !== 'all') {
    bookingQuery = bookingQuery.eq('series_id', seriesId);
    const { data: s } = await admin
      .from('knec_exam_series')
      .select('series_code,series_name')
      .eq('id', seriesId)
      .maybeSingle();
    if (s?.series_code) targetSeriesName = String(s.series_code);
  }

  const { data: bookings, error } = await bookingQuery;
  if (error) {
    return NextResponse.json({ message: `Unable to export roll: ${error.message}` }, { status: 500 });
  }

  const bookingIds = (bookings ?? []).map((b) => String(b.id));
  const { data: papers } = bookingIds.length
    ? await admin
        .from('student_knec_booking_papers')
        .select('booking_id,paper_code,module:knec_modules(module_code)')
        .in('booking_id', bookingIds)
        .neq('paper_status', 'cancelled')
    : { data: [] };

  const papersByBooking = new Map<string, Array<{ moduleCode: string; paperCode: string }>>();
  for (const p of papers ?? []) {
    const mod = one(p.module as Relation<{ module_code: string }>);
    const list = papersByBooking.get(String(p.booking_id)) ?? [];
    list.push({
      moduleCode: mod?.module_code ?? String(p.paper_code).split('/')[0] ?? '',
      paperCode: String(p.paper_code),
    });
    papersByBooking.set(String(p.booking_id), list);
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('KNEC Portal Registration Roll');

  ws.columns = [
    { header: 'S/N', key: 'sn', width: 6 },
    { header: 'Admission No.', key: 'adm', width: 20 },
    { header: 'Student Name', key: 'name', width: 28 },
    { header: 'Course', key: 'course', width: 10 },
    { header: 'Cohort', key: 'cohort', width: 16 },
    { header: 'Series', key: 'series', width: 15 },
    { header: 'KCSE Index No.', key: 'kcse', width: 16 },
    { header: 'National ID No.', key: 'natid', width: 14 },
    { header: 'Phone No.', key: 'phone', width: 15 },
    { header: 'Birth Cert Entry No.', key: 'birthcert', width: 18 },
    { header: 'Booked Modules', key: 'modules', width: 18 },
    { header: 'Booked Papers', key: 'papers', width: 32 },
    { header: 'Booking Status', key: 'status', width: 18 },
    { header: 'KNEC Index Number', key: 'knecIndex', width: 20 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  (bookings ?? []).forEach((b, idx) => {
    const stu = one(
      b.student as Relation<{
        admission_number: string;
        full_name: string;
        kcse_index_number: string | null;
        national_id_number: string | null;
        phone_number: string | null;
        birth_certificate_entry_number: string | null;
        knec_index_number: string | null;
        programme: Relation<{ code: string; name: string }>;
        current_cohort: Relation<{ name: string }>;
      }>,
    );
    const series = one(b.series as Relation<{ series_code: string; series_name: string }>);
    const prog = stu ? one(stu.programme) : null;
    const cohort = stu ? one(stu.current_cohort) : null;
    const bookedPapers = (papersByBooking.get(String(b.id)) ?? []).sort((x, y) =>
      x.paperCode.localeCompare(y.paperCode, 'en', { numeric: true }),
    );
    const bookedMods = Array.from(new Set(bookedPapers.map((p) => p.moduleCode))).join('; ');

    ws.addRow({
      sn: idx + 1,
      adm: stu?.admission_number ?? '',
      name: stu?.full_name ?? '',
      course: prog?.code ?? '',
      cohort: cohort?.name ?? '',
      series: series?.series_name ?? '',
      kcse: stu?.kcse_index_number ?? '',
      natid: stu?.national_id_number ?? '',
      phone: stu?.phone_number ?? '',
      birthcert: stu?.birth_certificate_entry_number ?? '',
      modules: bookedMods,
      papers: bookedPapers.map((p) => p.paperCode).join(', '),
      status: String(b.booking_status),
      knecIndex: (b.knec_index_number as string | null) ?? stu?.knec_index_number ?? '',
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `KNEC-Registration-Roll-${targetSeriesName}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
