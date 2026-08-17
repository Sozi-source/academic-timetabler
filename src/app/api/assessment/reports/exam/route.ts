import { NextResponse } from 'next/server';

import { buildExamAnalysisDocx } from '@/features/assessment/reports/docx';
import { getActiveAssessmentPeriodReportData } from '@/features/assessment/reports/queries';
import { getAssessmentReportReadiness } from '@/features/assessment/reports/readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getActiveAssessmentPeriodReportData();
  if (!data) return NextResponse.json({ error: 'No active academic period.' }, { status: 404 });

  const readiness = getAssessmentReportReadiness(data);
  if (!readiness.examReady) {
    return NextResponse.json(
      {
        error:
          'Exam analysis is not ready. Finalize exam attendance and commit final marks for the Unit Markbooks first.',
      },
      { status: 409 },
    );
  }

  const buffer = await buildExamAnalysisDocx(data);
  const name = `${data.periodName.replace(/[^a-z0-9]+/gi, '-')}-EXAM-ANALYSIS.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}
