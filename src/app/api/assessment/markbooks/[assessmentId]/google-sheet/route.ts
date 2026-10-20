import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { createTrainerSpreadsheet } from '@/features/assessment/google-sheets';
import { getAssessmentPopulationWorkspace } from '@/features/assessment/population-workspace';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  await requireHodAccess();
  const { assessmentId } = await params;
  const body = await request.json().catch(() => null) as { trainerEmail?: string } | null;
  if (!body || typeof body.trainerEmail !== 'string') {
    return NextResponse.json({ message: 'Enter the trainer email address.' }, { status: 400 });
  }

  try {
    const population = await getAssessmentPopulationWorkspace(assessmentId);
    if (!population.students.length) return NextResponse.json({ message: 'Generate the assessment roster before creating a trainer sheet.' }, { status: 409 });
    if (population.workflowStatus === 'finalised' || population.workflowStatus === 'archived') {
      return NextResponse.json({ message: 'This assessment is finalized and cannot accept marks.' }, { status: 409 });
    }

    const url = await createTrainerSpreadsheet({
      title: `${population.unit.code ?? 'Unit'} ${population.unit.name} · ${population.academicPeriod.name} Mark Entry`,
      trainerEmail: body.trainerEmail,
      rows: [
        ['Admission Number', 'Student Name', 'Assignment /5', 'Presentation /10', 'RAT /15', 'CAT /15', 'Exam /70'],
        ...population.students.map((student) => [
          student.admissionNumber,
          student.fullName,
          '', '', '', '',
          student.attendanceStatus === 'absent' ? 'AB' : '',
        ]),
      ],
    });
    return NextResponse.json({ success: true, url });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Could not create the Google Sheet.' }, { status: 502 });
  }
}
