import { NextResponse } from 'next/server';

import { buildCatAnalysisDocx } from '@/features/assessment/reports/docx';
import { getActiveAssessmentPeriodReportData } from '@/features/assessment/reports/queries';
import { getAssessmentReportReadiness } from '@/features/assessment/reports/readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getActiveAssessmentPeriodReportData();
  if (!data) return NextResponse.json({ error: 'No active academic period.' }, { status: 404 });

  const readiness = getAssessmentReportReadiness(data);
  if (!readiness.catReady) {
    return NextResponse.json(
      { error: 'CAT analysis is not ready. Commit CAT marks for at least one Unit Markbook first.' },
      { status: 409 },
    );
  }

  const buffer = await buildCatAnalysisDocx(data);
  const name = `${data.periodName.replace(/[^a-z0-9]+/gi, '-')}-CAT-ANALYSIS.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}
