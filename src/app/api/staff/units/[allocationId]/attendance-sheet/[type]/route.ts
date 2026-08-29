import { NextResponse } from 'next/server';

import { getAttendanceSheetMetadata } from '@/features/assessment/attendance-sheet-data';
import { generateAttendanceSheetDocx } from '@/features/assessment/attendance-sheet-docx';
import { getAllocationPopulationWorkspace } from '@/features/assessment/population-workspace';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { requireStaffAllocation } from '@/features/staff-assessment/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const docxMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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
  _request: Request,
  { params }: RouteContext,
) {
  const { allocationId, type: requestedType } = await params;
  if (requestedType !== 'class' && requestedType !== 'cat' && requestedType !== 'exam') {
    return NextResponse.json(
      { message: 'Attendance-sheet type must be Class, CAT, or Exam.' },
      { status: 400 },
    );
  }

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

  const document = await generateAttendanceSheetDocx({
    type: requestedType,
    institutionName: metadata.institutionName,
    campusName: metadata.campusName,
    schoolName: metadata.schoolName,
    departmentName: metadata.departmentName,
    programmeName: metadata.programmeName,
    academicPeriodName: context.allocation.academicPeriodName,
    unitCode: context.allocation.unitCode,
    unitName: context.allocation.unitName,
    venueName: metadata.venueName,
    candidates: population.students.map((student) => ({
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
    })),
  });

  const typeLabel =
    requestedType === 'class'
      ? 'Class'
      : requestedType === 'exam'
        ? 'Exam'
        : 'CAT';

  const filename = `${safeFilenamePart(context.allocation.unitCode)} - ${safeFilenamePart(context.allocation.unitName)} - ${typeLabel} Attendance Sheet.docx`;
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '');

  return new NextResponse(new Uint8Array(document), {
    status: 200,
    headers: {
      'Content-Type': docxMimeType,
      'Content-Disposition':
        `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
