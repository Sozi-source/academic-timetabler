import { NextResponse } from 'next/server';

import {
  buildExamPaperDocx,
  getExportableExamPaper,
} from '@/features/exam-setting/export-docx';

export const runtime = 'nodejs';

function safeFilenameSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const { paperId } = await params;

  const paper = await getExportableExamPaper(paperId);
  if (!paper) {
    return NextResponse.json(
      { error: 'Examination paper not found in the active department.' },
      { status: 404 },
    );
  }

  const docxBuffer = await buildExamPaperDocx(paper);
  const filename = [
    safeFilenameSegment(paper.unitCode),
    safeFilenameSegment(paper.unitName),
    safeFilenameSegment(paper.periodName),
    paper.paperKind === 'supplementary' ? 'Supplementary_Exam' : 'Main_Exam',
  ]
    .filter(Boolean)
    .join('_') + '.docx';

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
