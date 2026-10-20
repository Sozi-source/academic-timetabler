import { NextResponse } from 'next/server';

import { requireHodAccess } from '@/features/auth/authorization';
import { getAssessmentPopulationWorkspace } from '@/features/assessment/population-workspace';
import { readTrainerSpreadsheet, rowsToCsv } from '@/features/assessment/google-sheets';
import { matchAndValidateBulkMarks, parseBulkMarksSpreadsheet, type StudentRosterCandidate } from '@/features/assessment/marks/bulk-upload-parser';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const profile = await requireHodAccess();
  const { assessmentId } = await params;
  const body = await request.json().catch(() => null) as { url?: string } | null;
  if (!body || typeof body.url !== 'string') return NextResponse.json({ message: 'Enter a Google Sheets URL.' }, { status: 400 });

  try {
    if (!profile.activeDepartmentId) {
      return NextResponse.json({ message: 'Select an active department before syncing marks.' }, { status: 409 });
    }
    const population = await getAssessmentPopulationWorkspace(assessmentId);
    if (population.workflowStatus === 'finalised' || population.workflowStatus === 'archived') {
      return NextResponse.json({ message: 'This assessment is finalized and cannot accept marks.' }, { status: 409 });
    }
    const rows = await readTrainerSpreadsheet(body.url, profile.activeDepartmentId);
    const rawRows = await parseBulkMarksSpreadsheet(rowsToCsv(rows));
    const roster: StudentRosterCandidate[] = population.students.map((student) => ({
      studentId: student.studentId,
      admissionNumber: student.admissionNumber,
      fullName: student.fullName,
      attendanceStatus: student.attendanceStatus,
    }));
    const summary = matchAndValidateBulkMarks(rawRows, roster);
    if (summary.errorCount || summary.unmatchedCount || summary.matchedCount === 0) {
      return NextResponse.json({
        message: 'Resolve validation errors and unmatched rows in the Google Sheet before syncing.',
        summary,
      }, { status: 422 });
    }
    if (!summary.matched.some((mark) =>
      mark.assignment !== null || mark.presentation !== null || mark.rat !== null ||
      mark.cat !== null || mark.exam !== null || mark.attendanceStatus === 'absent'
    )) {
      return NextResponse.json({ message: 'No marks have been entered in the Google Sheet yet.' }, { status: 422 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('save_assessment_online_marks', {
      target_assessment_id: population.assessmentId,
      target_entries: summary.matched.map((mark) => ({
        student_id: mark.studentId,
        assignment: mark.assignment,
        presentation: mark.presentation,
        rat: mark.rat,
        cat: mark.cat,
        exam: mark.attendanceStatus === 'absent' ? null : mark.exam,
      })),
    });
    if (error) return NextResponse.json({ message: error.message }, { status: error.code === '42501' ? 403 : 409 });
    return NextResponse.json({ success: true, savedCount: summary.matchedCount, summary, draft: data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to sync marks from Google Sheets.' }, { status: 502 });
  }
}
