import { NextResponse } from 'next/server';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { trainerCanAccessAssessment } from '@/features/staff-assessment/authorization';
import { getAssessmentPopulationWorkspace } from '@/features/assessment/population-workspace';
import {
  parseBulkMarksSpreadsheet,
  matchAndValidateBulkMarks,
  type StudentRosterCandidate,
} from '@/features/assessment/marks/bulk-upload-parser';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    assessmentId: string;
  }>;
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  await requireTrainerAccess();

  const { assessmentId } = await params;

  if (!(await trainerCanAccessAssessment(assessmentId))) {
    return NextResponse.json(
      { message: 'This assessment is outside your Teaching Allocations.' },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { message: 'Invalid form data.' },
      { status: 400 },
    );
  }

  const file = formData.get('file') as File | null;
  const action = (formData.get('action') as string) || 'preview';

  if (!file) {
    return NextResponse.json(
      { message: 'A spreadsheet file (.xlsx or .csv) is required.' },
      { status: 400 },
    );
  }

  try {
    const population = await getAssessmentPopulationWorkspace(assessmentId);
    const roster: StudentRosterCandidate[] = population.students.map((s) => ({
      studentId: s.studentId,
      admissionNumber: s.admissionNumber,
      fullName: s.fullName,
      attendanceStatus: s.attendanceStatus,
    }));

    const arrayBuffer = await file.arrayBuffer();
    const rawRows = await parseBulkMarksSpreadsheet(arrayBuffer);
    const summary = matchAndValidateBulkMarks(rawRows, roster);

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        summary,
      });
    }

    if (action === 'commit') {
      if (summary.errorCount > 0) {
        return NextResponse.json(
          {
            message: 'Validation errors prevent saving marks. Review the errors below.',
            errors: summary.errors,
            summary,
          },
          { status: 400 },
        );
      }

      if (summary.matchedCount === 0) {
        return NextResponse.json(
          {
            message: 'No matching students were found in this spreadsheet.',
            summary,
          },
          { status: 400 },
        );
      }

      const entries = summary.matched.map((m) => ({
        student_id: m.studentId,
        assignment: m.assignment,
        presentation: m.presentation,
        rat: m.rat,
        cat: m.cat,
        exam: m.attendanceStatus === 'absent' ? null : m.exam,
      }));

      const supabase = await createClient();
      let targetAssessmentId = population.assessmentId;

      const { data, error } = await supabase.rpc('save_assessment_online_marks', {
        target_assessment_id: targetAssessmentId,
        target_entries: entries,
      });

      if (error) {
        return NextResponse.json(
          { message: error.message },
          { status: error.code === '42501' ? 403 : 409 },
        );
      }

      return NextResponse.json({
        success: true,
        savedCount: entries.length,
        summary,
        draft: data,
      });
    }

    return NextResponse.json(
      { message: `Unsupported action: ${action}` },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unable to parse spreadsheet.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
