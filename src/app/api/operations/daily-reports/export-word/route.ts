import { NextRequest, NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { normalizeDailyReportDate } from '@/features/trainer-daily-report/domain';
import { buildTrainerDailyReportDocx } from '@/features/trainer-daily-report/export-docx';
import { getDepartmentDailyReports } from '@/features/trainer-daily-report/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireHodAccess();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const reportDate = normalizeDailyReportDate(dateParam || undefined);

    const workspace = await getDepartmentDailyReports(reportDate);
    const docxBuffer = await buildTrainerDailyReportDocx(workspace);

    const deptCode = (workspace.departmentName || 'DEPT')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toUpperCase();
    const filename = `Trainers_Daily_Report_${deptCode}_${reportDate}.docx`;

    return new NextResponse(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('Word export error for trainer daily reports:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate Word document export' },
      { status: 500 },
    );
  }
}
