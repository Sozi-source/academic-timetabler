import { NextResponse } from 'next/server';

import { buildAssessmentMarksWorkbook } from '@/features/assessment/marks/workbook';
import { getAssessmentWorkbookData, refreshUnitMarkbookPopulation } from '@/features/assessment/marks/server-data';

export async function GET(_request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  let data = await getAssessmentWorkbookData(assessmentId);
  if (!data) return NextResponse.json({ message: 'Unit markbook not found.' }, { status: 404 });

  if (data.students.length === 0) {
    const refreshed = await refreshUnitMarkbookPopulation(assessmentId);
    if (!refreshed.ok) return NextResponse.json({ message: refreshed.message }, { status: 409 });
    data = await getAssessmentWorkbookData(assessmentId);
  }

  if (!data || data.students.length === 0) {
    return NextResponse.json(
      { message: 'The unit population could not be built. Verify student unit registrations for this academic period.' },
      { status: 409 },
    );
  }

  const workbook = await buildAssessmentMarksWorkbook(data.context, data.students);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${data.context.unitCode}-${data.context.unitName}-marks.xlsx`.replace(/[^A-Za-z0-9._-]+/g, '-');
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
