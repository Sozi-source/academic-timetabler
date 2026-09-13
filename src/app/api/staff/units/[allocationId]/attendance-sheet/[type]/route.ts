import { NextResponse } from 'next/server';

import { getAttendanceSheetMetadata } from '@/features/assessment/attendance-sheet-data';
import {
  generateAttendanceSheetDocx,
  type AttendanceSheetDocumentData,
} from '@/features/assessment/attendance-sheet-docx';
import { generateAttendanceSheetPdf } from '@/features/assessment/attendance-sheet-pdf';
import { getAllocationPopulationWorkspace } from '@/features/assessment/population-workspace';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const docxMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const pdfMimeType = 'application/pdf';

interface RouteContext {
  params: Promise<{
    allocationId: string;
    type: string;
  }>;
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '') || 'Unit';
}

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const { allocationId, type: requestedType } = await params;
  if (requestedType !== 'class' && requestedType !== 'cat' && requestedType !== 'exam') {
    return NextResponse.json(
      { message: 'Attendance-sheet type must be Class, CAT, or Exam.' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format')?.toLowerCase();
  const isPdf = format === 'pdf';

  const profile = await requireTrainerAccess();
  const [context, population, metadata] = await Promise.all([
    requireStaffAllocation({ profileId: profile.id, allocationId }),
    getAllocationPopulationWorkspace(allocationId),
    getAttendanceSheetMetadata(allocationId),
  ]);

  if (!context) {
    return NextResponse.json(
      { message: 'Teaching allocation was not found.' },
      { status: 404 },
    );
  }

  const documentData: AttendanceSheetDocumentData = {
    type: requestedType,
    institutionName: metadata.institutionName,
    campusName: metadata.campusName,
    schoolName: metadata.schoolName,
    departmentName: metadata.departmentName,
    programmeName: metadata.programmeName,
    cohortName: population.cohort?.name || context.allocation.cohortName,
    academicPeriodName: context.allocation.academicPeriodName,
    unitCode: context.allocation.unitCode,
    unitName: context.allocation.unitName,
    trainerName: context.workspace.trainerName || profile.fullName,
    venueName: metadata.venueName,
    candidates: population.students.map((student) => ({
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      cohortName: student.cohortName,
    })),
  };

  const typeLabel =
    requestedType === 'class'
      ? 'Class'
      : requestedType === 'exam'
        ? 'Exam'
        : 'CAT';

  const document = isPdf
    ? await generateAttendanceSheetPdf(documentData)
    : await generateAttendanceSheetDocx(documentData);

  const extension = isPdf ? 'pdf' : 'docx';
  const mimeType = isPdf ? pdfMimeType : docxMimeType;

  const filename = `${safeFilenamePart(context.allocation.unitCode)} - ${safeFilenamePart(context.allocation.unitName)} - ${typeLabel} Attendance Sheet.${extension}`;
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '');

  return new NextResponse(new Uint8Array(document), {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition':
        `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
