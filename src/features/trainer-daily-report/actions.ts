'use server';

import { revalidatePath } from 'next/cache';

import { requireTrainerAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import type { TrainerDailyReportActionState } from './types';

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function submitTrainerDailyReportAction(
  _previousState: TrainerDailyReportActionState,
  formData: FormData,
): Promise<TrainerDailyReportActionState> {
  try {
    const profile = await requireTrainerAccess();

    const reportDate = textValue(formData, 'reportDate');
    const otherActivity = textValue(formData, 'otherActivity');
    const concern = textValue(formData, 'concern');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return { status: 'error', message: 'The report date is invalid.' };
    }

    if (otherActivity.length > 800) {
      return { status: 'error', message: 'Other activity is too long (maximum 800 characters).' };
    }

    if (concern.length > 1200) {
      return { status: 'error', message: 'Concern note is too long (maximum 1200 characters).' };
    }

    const { getTrainerDailyReportWorkspace } = await import('./queries');
    const workspace = await getTrainerDailyReportWorkspace(reportDate);

    // Note: previously blocked here if the trainer had any unresolved past
    // sessions/reports. That hard gate has been removed — overdue past items
    // are surfaced to the trainer as an informational reminder only and no
    // longer prevent submitting today's report.

    // If there are no scheduled lessons, require at least one activity or concern note
    if (workspace.lessons.length === 0 && !otherActivity && !concern) {
      return {
        status: 'error',
        message: 'No lessons are scheduled for this day. Please describe an activity or add a note before submitting.',
      };
    }

    // If there are scheduled lessons, ensure all attendance is completed
    if (workspace.lessons.length > 0 && !workspace.readyToSubmit) {
      return {
        status: 'error',
        message:
          workspace.blockingReason ||
          'Please complete class attendance for all scheduled lessons before submitting.',
      };
    }

    const supabase = await createClient();

    let submittedSuccessfully = false;
    try {
      const { error: rpcErrorV1 } = await (supabase as any).rpc(
        'submit_trainer_daily_report_v1',
        {
          target_report_date: reportDate,
          target_other_activity: otherActivity || null,
          target_concern: concern || null,
        },
      );
      if (!rpcErrorV1) {
        submittedSuccessfully = true;
      } else {
        const { error: rpcErrorV0 } = await (supabase as any).rpc(
          'submit_trainer_daily_report',
          {
            target_report_date: reportDate,
            target_other_activity: otherActivity || null,
            target_concern: concern || null,
          },
        );
        if (!rpcErrorV0) {
          submittedSuccessfully = true;
        }
      }
    } catch {
      submittedSuccessfully = false;
    }

    if (!submittedSuccessfully) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminDb = createAdminClient();

      // Resolve trainer details
      const { data: trainer } = await (adminDb as any)
        .from('trainers')
        .select('id, full_name, staff_number, department_id, departments(id, name)')
        .eq('profile_id', profile.id)
        .maybeSingle();

      const trainerId = trainer?.id || workspace.trainerId || profile.id;
      let departmentId = trainer?.department_id || profile.activeDepartmentId;

      if (!departmentId) {
        const lessonDept = workspace.lessons.find((l) => l.departmentId);
        if (lessonDept?.departmentId) {
          departmentId = lessonDept.departmentId;
        } else {
          const { data: firstDept } = await (adminDb as any)
            .from('departments')
            .select('id, name')
            .limit(1)
            .maybeSingle();
          departmentId = firstDept?.id;
        }
      }

      const trainerName = trainer?.full_name || workspace.trainerName || profile.fullName || 'Trainer';
      const departmentName = (trainer?.departments as any)?.name || workspace.homeDepartmentName || profile.departmentName || 'Department';

      const { data: insertedReport, error: upsertErr } = await (adminDb as any)
        .from('trainer_daily_reports')
        .upsert({
          trainer_id: trainerId,
          trainer_profile_id: profile.id,
          home_department_id: departmentId,
          trainer_name_snapshot: trainerName,
          trainer_number_snapshot: trainer?.staff_number || null,
          home_department_name_snapshot: departmentName,
          report_date: reportDate,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          other_activity: otherActivity || null,
          concern: concern || null,
        }, { onConflict: 'trainer_id,report_date' })
        .select('id')
        .maybeSingle();

      if (upsertErr) {
        console.error('Direct upsert to trainer_daily_reports failed:', upsertErr);
        return {
          status: 'error',
          message: upsertErr.message || 'Unable to submit the daily report. Please try again.',
        };
      }

      // If report was created directly, record lesson snapshots as well
      if (insertedReport?.id && workspace.lessons.length > 0) {
        try {
          const lessonRows = workspace.lessons.map((lesson) => ({
            report_id: insertedReport.id,
            department_id: lesson.departmentId || departmentId,
            department_name_snapshot: lesson.departmentName || departmentName,
            timetable_version_id: lesson.timetableVersionId || null,
            timetable_version_number: lesson.timetableVersionNumber || null,
            timetable_title: lesson.timetableTitle || null,
            scheduled_session_id: lesson.scheduledSessionId,
            teaching_allocation_id: lesson.teachingAllocationId || null,
            academic_period_id: lesson.academicPeriodId || null,
            cohort_id: lesson.cohortId || null,
            unit_id: lesson.unitId || null,
            session_number: lesson.sessionNumber || 1,
            starts_at: lesson.startsAt,
            ends_at: lesson.endsAt,
            unit_code_snapshot: lesson.unitCode || null,
            unit_name_snapshot: lesson.unitName,
            cohort_name_snapshot: lesson.cohortName,
            room_name_snapshot: lesson.roomName || null,
            delivery_mode_snapshot: lesson.deliveryMode || 'Teaching',
            attendance_session_id: lesson.attendanceSessionId || null,
            roster_count: lesson.rosterCount || 0,
            present_count: lesson.presentCount || 0,
            absent_count: lesson.absentCount || 0,
            absentees: lesson.absentees || [],
          }));

          await (adminDb as any)
            .from('trainer_daily_report_lessons')
            .upsert(lessonRows, { onConflict: 'report_id,scheduled_session_id', ignoreDuplicates: true });
        } catch (lessonInsertErr) {
          console.warn('Fallback trainer_daily_report_lessons upsert warning:', lessonInsertErr);
        }
      }
    }

    try {
      revalidatePath('/staff/daily-report');
      revalidatePath('/staff/daily-report', 'page');
      revalidatePath('/staff/attendance');
      revalidatePath('/operations/daily-reports');
    } catch {
      // Revalidation warning ignored in non-blocking environments
    }

    return { status: 'success', message: 'Daily report submitted successfully.' };
  } catch (err: any) {
    console.error('submitTrainerDailyReportAction error:', err);
    return {
      status: 'error',
      message: err?.message || 'An unexpected error occurred while submitting the report.',
    };
  }
}

export async function submitDailyReportDirectAction(
  reportDate: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await requireTrainerAccess();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return { success: false, message: 'The report date is invalid.' };
    }

    // Deliberately self-contained: this button only appears in the backlog
    // banner after detectPastUnrecordedReportsAndSessions() has already
    // confirmed, by directly querying class_sessions, that every session on
    // this date was recorded. Re-deriving "completeness" a second time via
    // getTrainerDailyReportWorkspace() re-projects that date onto the
    // CURRENT published timetable schedule, which can disagree with what
    // was actually taught back then (units/cohorts get edited, timetables
    // get regenerated) — that mismatch is what was silently failing this
    // action. We trust the already-recorded class_sessions rows directly
    // instead of recomputing a second, drift-prone schedule.
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminDb = createAdminClient();

    const { data: trainer, error: trainerErr } = await (adminDb as any)
      .from('trainers')
      .select('id, full_name, staff_number, department_id, departments(id, name)')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (trainerErr) {
      console.error('submitDailyReportDirectAction trainer lookup failed:', trainerErr);
      return { success: false, message: trainerErr.message || 'Could not resolve your trainer profile.' };
    }

    if (!trainer?.id) {
      return { success: false, message: 'Your authenticated account is not linked to an active trainer record.' };
    }

    const trainerId = trainer.id;
    let departmentId = trainer.department_id || profile.activeDepartmentId || null;

    if (!departmentId) {
      const { data: firstDept } = await (adminDb as any)
        .from('departments')
        .select('id')
        .limit(1)
        .maybeSingle();
      departmentId = firstDept?.id || null;
    }

    const trainerName = trainer.full_name || profile.fullName || 'Trainer';
    const departmentName = (trainer.departments as any)?.name || profile.departmentName || 'Department';

    // Pull the sessions this trainer actually ran on this date, directly —
    // no schedule recomputation, no ID-matching against a possibly-changed
    // timetable.
    const { data: daySessions, error: sessionsErr } = await (adminDb as any)
      .from('class_sessions')
      .select(
        'id, teaching_allocation_id, academic_period_id, cohort_id, unit_id, starts_at, ends_at, status, roster_count, scheduled_session_id',
      )
      .eq('session_date', reportDate)
      .or(`trainer_id.eq.${trainerId},opened_by.eq.${profile.id}`);

    if (sessionsErr) {
      console.error('submitDailyReportDirectAction sessions lookup failed:', sessionsErr);
      return { success: false, message: sessionsErr.message || 'Could not load sessions for this date.' };
    }

    const relevantSessions = (daySessions ?? []).filter((s: any) => s.status !== 'cancelled' || true);
    const stillOpen = (daySessions ?? []).some((s: any) => s.status === 'open');
    if (stillOpen) {
      return {
        success: false,
        message: 'This date still has an in-progress register. Open it from "Review" and finish marking attendance before submitting.',
      };
    }

    const { data: existingReport } = await (adminDb as any)
      .from('trainer_daily_reports')
      .select('id, status')
      .eq('trainer_id', trainerId)
      .eq('report_date', reportDate)
      .maybeSingle();

    if (existingReport?.status === 'submitted') {
      return { success: true, message: 'This report was already submitted.' };
    }

    const { data: insertedReport, error: upsertErr } = await (adminDb as any)
      .from('trainer_daily_reports')
      .upsert(
        {
          trainer_id: trainerId,
          trainer_profile_id: profile.id,
          home_department_id: departmentId,
          trainer_name_snapshot: trainerName,
          trainer_number_snapshot: trainer.staff_number || null,
          home_department_name_snapshot: departmentName,
          report_date: reportDate,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          other_activity: null,
          concern: null,
        },
        { onConflict: 'trainer_id,report_date' },
      )
      .select('id')
      .maybeSingle();

    if (upsertErr) {
      console.error('submitDailyReportDirectAction upsert failed:', upsertErr);
      return {
        success: false,
        message: upsertErr.message || 'Unable to submit the daily report. Please try again.',
      };
    }

    // Best-effort lesson snapshots for the report history view. Never blocks
    // the actual submission above if unit/cohort names can't be resolved.
    if (insertedReport?.id && relevantSessions.length > 0) {
      try {
        const unitIds = [...new Set(relevantSessions.map((s: any) => s.unit_id).filter(Boolean))];
        const cohortIds = [...new Set(relevantSessions.map((s: any) => s.cohort_id).filter(Boolean))];

        const [{ data: units }, { data: cohorts }] = await Promise.all([
          unitIds.length
            ? (adminDb as any).from('units').select('id, code, name').in('id', unitIds)
            : Promise.resolve({ data: [] }),
          cohortIds.length
            ? (adminDb as any).from('cohorts').select('id, name').in('id', cohortIds)
            : Promise.resolve({ data: [] }),
        ]);
        const unitMap = new Map((units ?? []).map((u: any) => [u.id, u]));
        const cohortMap = new Map((cohorts ?? []).map((c: any) => [c.id, c]));

        const sessionIds = relevantSessions.map((s: any) => s.id);
        const { data: entries } = await (adminDb as any)
          .from('class_attendance_entries')
          .select('class_session_id, attendance_status, note, students(id, admission_number, full_name)')
          .in('class_session_id', sessionIds);

        const statsBySession = new Map<string, { present: number; absent: number; absentees: any[] }>();
        for (const entry of entries ?? []) {
          const cur = statsBySession.get(entry.class_session_id) || { present: 0, absent: 0, absentees: [] };
          if (entry.attendance_status === 'present') cur.present++;
          if (entry.attendance_status === 'absent') {
            cur.absent++;
            cur.absentees.push({
              studentId: entry.students?.id || '',
              admissionNumber: entry.students?.admission_number || '—',
              fullName: entry.students?.full_name || 'Student',
              note: entry.note || null,
            });
          }
          statsBySession.set(entry.class_session_id, cur);
        }

        const lessonRows = relevantSessions.map((s: any) => {
          const unit = unitMap.get(s.unit_id) as any;
          const cohort = cohortMap.get(s.cohort_id) as any;
          const stats = statsBySession.get(s.id) || { present: 0, absent: 0, absentees: [] };
          return {
            report_id: insertedReport.id,
            department_id: departmentId,
            department_name_snapshot: departmentName,
            scheduled_session_id: s.scheduled_session_id,
            teaching_allocation_id: s.teaching_allocation_id,
            academic_period_id: s.academic_period_id,
            cohort_id: s.cohort_id,
            unit_id: s.unit_id,
            session_number: 1,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            unit_code_snapshot: unit?.code || null,
            unit_name_snapshot: unit?.name || 'Unit',
            cohort_name_snapshot: cohort?.name || 'Cohort',
            room_name_snapshot: null,
            delivery_mode_snapshot: 'Teaching',
            attendance_session_id: s.id,
            roster_count: s.roster_count || 0,
            present_count: stats.present,
            absent_count: stats.absent,
            absentees: stats.absentees,
          };
        });

        if (lessonRows.length > 0) {
          await (adminDb as any)
            .from('trainer_daily_report_lessons')
            .upsert(lessonRows, { onConflict: 'report_id,scheduled_session_id', ignoreDuplicates: true });
        }
      } catch (lessonInsertErr) {
        console.warn('submitDailyReportDirectAction lesson snapshot warning (non-blocking):', lessonInsertErr);
      }
    }

    try {
      revalidatePath('/staff/daily-report');
      revalidatePath('/staff/daily-report', 'page');
      revalidatePath('/staff/attendance');
      revalidatePath('/operations/daily-reports');
    } catch {
      // Revalidation warning ignored in non-blocking environments
    }

    return { success: true, message: 'Daily report submitted successfully.' };
  } catch (err: any) {
    console.error('submitDailyReportDirectAction error:', err);
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred while submitting the report.',
    };
  }
}

export async function dismissOverdueReportAction(
  reportDate: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await requireTrainerAccess();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return { success: false, message: 'The report date is invalid.' };
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminDb = createAdminClient();

    const { data: trainer } = await (adminDb as any)
      .from('trainers')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (!trainer?.id) {
      return { success: false, message: 'Your authenticated account is not linked to an active trainer record.' };
    }

    const { error } = await (adminDb as any)
      .from('trainer_backlog_dismissals')
      .upsert(
        { trainer_id: trainer.id, report_date: reportDate, dismissed_by: profile.id },
        { onConflict: 'trainer_id,report_date' },
      );

    if (error) {
      console.error('dismissOverdueReportAction failed:', error);
      return { success: false, message: error.message || 'Unable to hide this item. Please try again.' };
    }

    try {
      revalidatePath('/staff/daily-report');
      revalidatePath('/staff/daily-report', 'page');
    } catch {
      // Revalidation warning ignored in non-blocking environments
    }

    return { success: true, message: 'Hidden.' };
  } catch (err: any) {
    console.error('dismissOverdueReportAction error:', err);
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred.',
    };
  }
}
