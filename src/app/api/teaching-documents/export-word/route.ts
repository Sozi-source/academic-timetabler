import { NextResponse } from 'next/server';
import {
  getDocumentHeaderContext,
  getRecordOfWorkContext,
} from '@/features/teaching-documents/record-of-work-actions';
import { getApprovedCurriculumForUnitCode } from '@/features/teaching-documents/curriculum-content/queries';
import { getAssessmentMilestones } from '@/features/teaching-documents/assessment-milestones';
import {
  computeRecordOfWorkSummary,
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

    let docxBuffer: Buffer;

    if (type === 'record_of_work') {
      const rowContext = await getRecordOfWorkContext(allocationId);
      const recordOfWork = computeRecordOfWorkSummary(
        header,
        rowContext?.entries ?? [],
      );
      docxBuffer = await buildTVETDocumentDocx('record_of_work', { recordOfWork });
    } else {
      const docType = type === 'scheme_of_work' ? 'scheme_of_work' : 'course_outline';
      const [curriculum, milestones] = await Promise.all([
        getApprovedCurriculumForUnitCode(header.unitCode, header.unitName, docType),
        getAssessmentMilestones(header.academicPeriodId ?? undefined),
      ]);

      if (!curriculum || curriculum.isAvailable === false || (!curriculum.weeklySchedule || curriculum.weeklySchedule.length === 0)) {
        return NextResponse.json(
          {
            error:
              curriculum?.notReadyMessage ||
              'Curriculum content for this unit is not yet ready. The verified syllabus has not been uploaded by the department.',
          },
          { status: 400 }
        );
      }

      if (type === 'course_outline') {
        const courseOutline = generateTVETCourseOutline(header, curriculum, milestones);
        docxBuffer = await buildTVETDocumentDocx('course_outline', { courseOutline });
      } else if (type === 'scheme_of_work') {
        const schemeOfWork = generateTVETSchemeOfWork(header, curriculum, milestones);
        docxBuffer = await buildTVETDocumentDocx('scheme_of_work', { schemeOfWork });
      } else {
        return NextResponse.json({ error: 'Unsupported document type' }, { status: 400 });
      }
    }

    const docTypeLabel =
      type === 'scheme_of_work'
        ? 'Scheme_of_Work'
        : type === 'record_of_work'
          ? 'Record_of_Work'
          : 'Course_Outline';
    const cleanUnitName = header.unitName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanUnitName}_${docTypeLabel}.docx`;

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

    const docTypeLabel =
      type === 'scheme_of_work'
        ? 'Scheme_of_Work'
        : type === 'record_of_work'
          ? 'Record_of_Work'
          : 'Course_Outline';
    const cleanUnitName = (header?.unitName || 'Unit').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanUnitName}_${docTypeLabel}.docx`;

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
