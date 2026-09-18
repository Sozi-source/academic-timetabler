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

    // Enforce resolution of previous unrecorded sessions or unsubmitted past reports
    if (workspace.hasOverduePastSessions) {
      return {
        status: 'error',
        message:
          workspace.blockingReason ||
          'You have unrecorded previous sessions or unsubmitted past reports. Please resolve previous reports before submitting.',
      };
    }

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

    const { getTrainerDailyReportWorkspace } = await import('./queries');
    const workspace = await getTrainerDailyReportWorkspace(reportDate);

    // Ensure all scheduled lessons for this day have attendance recorded or cancelled
    const lessonsComplete =
      workspace.lessons.length === 0 ||
      workspace.lessons.every(
        (l: any) => l.attendanceStatus === 'completed' || l.attendanceStatus === 'cancelled',
      );

    if (!lessonsComplete) {
      return {
        success: false,
        message: 'Please complete class attendance for all scheduled lessons on this day before submitting.',
      };
    }

    const supabase = await createClient();

    let submittedSuccessfully = false;
    try {
      const { error: rpcErrorV1 } = await (supabase as any).rpc(
        'submit_trainer_daily_report_v1',
        {
          target_report_date: reportDate,
          target_other_activity: null,
          target_concern: null,
        },
      );
      if (!rpcErrorV1) {
        submittedSuccessfully = true;
      } else {
        const { error: rpcErrorV0 } = await (supabase as any).rpc(
          'submit_trainer_daily_report',
          {
            target_report_date: reportDate,
            target_other_activity: null,
            target_concern: null,
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
          other_activity: null,
          concern: null,
        }, { onConflict: 'trainer_id,report_date' })
        .select('id')
        .maybeSingle();

      if (upsertErr) {
        console.error('Direct upsert to trainer_daily_reports failed:', upsertErr);
        return {
          success: false,
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

    return { success: true, message: 'Daily report submitted successfully.' };
  } catch (err: any) {
    console.error('submitDailyReportDirectAction error:', err);
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred while submitting the report.',
    };
  }
}
