import { NextResponse } from 'next/server';
import { getDocumentHeaderContext } from '@/features/teaching-documents/record-of-work-actions';
import { getApprovedCurriculumForUnitCode } from '@/features/teaching-documents/curriculum-content/queries';
import { getAssessmentMilestones } from '@/features/teaching-documents/assessment-milestones';
import {
  generateTVETCourseOutline,
  generateTVETSchemeOfWork,
} from '@/features/teaching-documents/tvet-standards';
import { buildTVETDocumentDocx } from '@/features/teaching-documents/export-docx';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const allocationId = searchParams.get('allocationId');
    const type = (searchParams.get('type') || 'course_outline') as
      | 'course_outline'
      | 'scheme_of_work'
      | 'record_of_work';

    if (!allocationId) {
      return NextResponse.json({ error: 'Missing allocationId parameter' }, { status: 400 });
    }

    const header = await getDocumentHeaderContext(allocationId);
    if (!header) {
      return NextResponse.json({ error: 'Teaching allocation not found' }, { status: 404 });
    }

    const [curriculum, milestones] = await Promise.all([
      getApprovedCurriculumForUnitCode(header.unitCode, header.unitName),
      getAssessmentMilestones(),
    ]);

    if (!curriculum) {
      return NextResponse.json({ error: 'Curriculum content not found' }, { status: 404 });
    }

    let docxBuffer: Buffer;

    if (type === 'course_outline') {
      const courseOutline = generateTVETCourseOutline(header, curriculum);
      docxBuffer = await buildTVETDocumentDocx('course_outline', { courseOutline });
    } else if (type === 'scheme_of_work') {
      const schemeOfWork = generateTVETSchemeOfWork(header, curriculum, milestones);
      docxBuffer = await buildTVETDocumentDocx('scheme_of_work', { schemeOfWork });
    } else {
      return NextResponse.json({ error: 'Unsupported document type' }, { status: 400 });
    }

    const filename = `${header.unitCode.replace(/\s+/g, '_')}_${type}.docx`;

    return new NextResponse(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Error generating TVET Word export:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, courseOutline, schemeOfWork, recordOfWork } = body;

    if (!type || (!courseOutline && !schemeOfWork && !recordOfWork)) {
      return NextResponse.json({ error: 'Invalid document payload' }, { status: 400 });
    }

    const header = courseOutline?.header ?? schemeOfWork?.header ?? recordOfWork?.header;
    const docxBuffer = await buildTVETDocumentDocx(type, {
      courseOutline,
      schemeOfWork,
      recordOfWork,
    });

    const unitCode = header?.unitCode?.replace(/\s+/g, '_') || 'Curriculum';
    const filename = `${unitCode}_${type}.docx`;

    return new NextResponse(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Error generating TVET Word export from payload:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    );
  }
}
