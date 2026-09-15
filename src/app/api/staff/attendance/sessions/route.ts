import {
  NextResponse,
} from 'next/server';

import {
  requireTrainerAccess,
} from '@/features/auth/authorization';
import {
  createAdminClient,
} from '@/lib/supabase/admin';
import {
  createClient,
} from '@/lib/supabase/server';
import { getUnifiedUnitRoster } from '@/features/academic-roster/unified-roster';

interface CreatePayload {
  scheduledSessionId?:
    unknown;
  sessionDate?:
    unknown;
}

export async function POST(
  request:
    Request,
) {
  await requireTrainerAccess();

  const payload =
    await request
      .json()
      .catch(
        () => null,
      ) as
        | CreatePayload
        | null;

  if (
    !payload ||
    typeof payload.scheduledSessionId !==
      'string' ||
    typeof payload.sessionDate !==
      'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      payload.sessionDate,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Choose a valid scheduled class and date.',
      },
      {
        status:
          400,
      },
    );
  }

  const supabase =
    await createClient();
  const adminDb =
    createAdminClient();

  // Enforce resolution of earlier unrecorded sessions before opening attendance for a later date
  try {
    const { getStaffClassAttendanceSchedule } = await import('@/features/class-attendance/queries');
    const schedule = await getStaffClassAttendanceSchedule().catch(() => []);
    const { detectPastUnrecordedSessions } = await import('@/features/trainer-daily-report/queries');
    const pastUnrecorded = await detectPastUnrecordedSessions({
      supabase,
      schedule,
      reportDate: payload.sessionDate,
    });

    const earlierUnrecorded = pastUnrecorded.filter((p) => p.sessionDate < payload.sessionDate);
    if (earlierUnrecorded.length > 0) {
      const oldest = earlierUnrecorded[earlierUnrecorded.length - 1];
      return NextResponse.json(
        {
          message: `Please record attendance or log an exception for your earlier session on ${oldest.sessionDate} (${oldest.unitName}) before recording new sessions.`,
        },
        { status: 400 },
      );
    }
  } catch (checkErr) {
    console.warn('Attendance session overdue pre-check warning:', checkErr);
  }

  // 1. Ensure session exists in scheduled_sessions table with all required foreign keys
  const { data: existingSession } = await (adminDb as any)
    .from('scheduled_sessions')
    .select('id, teaching_allocation_id, status')
    .eq('id', payload.scheduledSessionId)
    .maybeSingle();

  if (!existingSession || existingSession.status !== 'locked') {
    // Lookup from published timetable snapshot
    const { data: versions } = await (adminDb as any)
      .from('timetable_versions')
      .select('id, academic_period_id, snapshot')
      .eq('status', 'published')
      .order('version_number', { ascending: false });

    let match: any = null;
    let periodId: string | null = null;

    for (const v of versions ?? []) {
      const snapshot = Array.isArray(v.snapshot) ? v.snapshot : [];
      match = snapshot.find((item: any) => String(item.id) === payload.scheduledSessionId);
      if (match) {
        periodId = v.academic_period_id;
        break;
      }
    }

    if (match && periodId) {
      // Lookup working_day, time_slots, and rooms to satisfy FK constraints
      const dayStr = String(match.day || match.dayOfWeek || 'friday').toLowerCase();
      const [
        { data: days },
        { data: slots },
        { data: rooms },
        { data: alloc },
      ] = await Promise.all([
        (adminDb as any).from('working_days').select('id, day_of_week'),
        (adminDb as any).from('time_slots').select('id, starts_at, ends_at').order('starts_at', { ascending: true }),
        (adminDb as any).from('rooms').select('id, name').limit(1),
        match.teachingAllocationId || match.allocationId
          ? (adminDb as any).from('teaching_allocations').select('*').eq('id', match.teachingAllocationId || match.allocationId).maybeSingle()
          : (adminDb as any).from('teaching_allocations').select('*')
              .eq('academic_period_id', periodId)
              .eq('unit_id', match.unitId)
              .eq('cohort_id', match.cohortId)
              .maybeSingle(),
      ]);

      const workingDay = (days ?? []).find((d: any) => String(d.day_of_week).toLowerCase() === dayStr) || days?.[0];
      const startSlot = (slots ?? []).find((s: any) => String(s.starts_at).slice(0, 5) === String(match.startTime || '08:00').slice(0, 5)) || slots?.[0];
      const endSlot = (slots ?? []).find((s: any) => String(s.ends_at).slice(0, 5) === String(match.endTime || '10:00').slice(0, 5)) || slots?.[slots.length - 1] || startSlot;
      const room = (rooms ?? []).find((r: any) => r.name === match.roomName) || rooms?.[0];

      let teachingAllocId = alloc?.id || alloc?.data?.id || match.teachingAllocationId || match.allocationId;
      if (!teachingAllocId) {
        const { data: fallbackAlloc } = await (adminDb as any)
          .from('teaching_allocations')
          .select('id')
          .eq('academic_period_id', periodId)
          .eq('unit_id', match.unitId)
          .limit(1)
          .maybeSingle();
        teachingAllocId = fallbackAlloc?.id;
      }

      const cohortId = match.cohortId || alloc?.cohort_id || alloc?.data?.cohort_id;
      const unitId = match.unitId || alloc?.unit_id || alloc?.data?.unit_id;
      const trainerId = match.trainerId || alloc?.trainer_id || alloc?.data?.trainer_id;

      if (workingDay && startSlot && endSlot && room && teachingAllocId && cohortId && unitId && trainerId) {
        await (adminDb as any).from('scheduled_sessions').upsert({
          id: payload.scheduledSessionId,
          academic_period_id: periodId,
          teaching_allocation_id: teachingAllocId,
          cohort_id: cohortId,
          unit_id: unitId,
          trainer_id: trainerId,
          working_day_id: workingDay.id,
          start_time_slot_id: startSlot.id,
          end_time_slot_id: endSlot.id,
          room_id: room.id,
          session_number: Number(match.sessionNumber || 1),
          delivery_mode: 'lecture',
          status: 'locked',
          is_locked: true,
          participant_cohort_ids: Array.isArray(match.participantCohortIds) && match.participantCohortIds.length > 0
            ? match.participantCohortIds
            : [cohortId],
        }, { onConflict: 'id' });
      }
    }
  }

  // Ensure scheduled session is locked if it was previously draft
  if (existingSession && existingSession.status !== 'locked') {
    await (adminDb as any)
      .from('scheduled_sessions')
      .update({ status: 'locked', is_locked: true, updated_at: new Date().toISOString() })
      .eq('id', payload.scheduledSessionId);
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'open_class_attendance_session',
      {
        target_scheduled_session_id:
          payload.scheduledSessionId,
        target_session_date:
          payload.sessionDate,
      },
    );

  let classSessionId = data;

  if (error) {
    // If RPC fails (e.g. date outside period or day mismatch), use direct class_sessions insert / retrieval fallback with admin client
    try {
      const { data: existingCs } = await (adminDb as any)
        .from('class_sessions')
        .select('id, academic_period_id, unit_id, cohort_id, teaching_allocation_id')
        .eq('scheduled_session_id', payload.scheduledSessionId)
        .eq('session_date', payload.sessionDate)
        .maybeSingle();

      if (existingCs) {
        classSessionId = existingCs.id;
      } else {
        const { data: sessionData } = await (adminDb as any)
          .from('scheduled_sessions')
          .select('*')
          .eq('id', payload.scheduledSessionId)
          .maybeSingle();

        if (!sessionData) {
          throw new Error('Scheduled session record could not be found.');
        }

        const { data: newCs, error: insertError } = await (adminDb as any)
          .from('class_sessions')
          .insert({
            academic_period_id: sessionData.academic_period_id,
            teaching_allocation_id: sessionData.teaching_allocation_id,
            scheduled_session_id: payload.scheduledSessionId,
            cohort_id: sessionData.cohort_id,
            unit_id: sessionData.unit_id,
            trainer_id: sessionData.trainer_id,
            session_date: payload.sessionDate,
            starts_at: '08:00:00',
            ends_at: '10:00:00',
            status: 'open',
          })
          .select('id')
          .single();

        if (insertError || !newCs) {
          throw insertError || new Error('Failed to create class session');
        }

        classSessionId = newCs.id;
      }
    } catch (fallbackErr: any) {
      return NextResponse.json(
        {
          message:
            fallbackErr?.message || error.message,
        },
        {
          status: 409,
        },
      );
    }
  }

  // Ensure all registered cohorts and students for this unit & academic period are present in class_attendance_entries
  if (classSessionId) {
    try {
      const { data: cs } = await (adminDb as any)
        .from('class_sessions')
        .select('id, academic_period_id, unit_id, cohort_id, teaching_allocation_id')
        .eq('id', classSessionId)
        .maybeSingle();

      if (cs?.unit_id && cs?.academic_period_id) {
        const roster = await getUnifiedUnitRoster({
          supabase: adminDb,
          unitId: cs.unit_id,
          academicPeriodId: cs.academic_period_id,
          allocationId: cs.teaching_allocation_id,
        });

        if (roster.students.length > 0) {
          const validStudentIdSet = new Set(roster.students.map((st) => st.studentId));
          const { data: currentEntries } = await (adminDb as any)
            .from('class_attendance_entries')
            .select('student_id')
            .eq('class_session_id', cs.id);

          const orphanedIds = (currentEntries ?? [])
            .map((e: any) => String(e.student_id))
            .filter((sId: string) => !validStudentIdSet.has(sId));

          if (orphanedIds.length > 0) {
            await (adminDb as any)
              .from('class_attendance_entries')
              .delete()
              .eq('class_session_id', cs.id)
              .in('student_id', orphanedIds);
          }

          const records = roster.students.map((st) => ({
            class_session_id: cs.id,
            student_id: st.studentId,
            cohort_id: st.cohortId || cs.cohort_id,
            attendance_status: st.reportingStatus === 'reported' ? 'unmarked' : 'not_reported',
          }));

          await (adminDb as any)
            .from('class_attendance_entries')
            .upsert(records, { onConflict: 'class_session_id,student_id', ignoreDuplicates: true });

          await (adminDb as any)
            .from('class_sessions')
            .update({ roster_count: roster.totalCount, updated_at: new Date().toISOString() })
            .eq('id', cs.id);

          if (roster.cohortIds.length > 0) {
            await (adminDb as any)
              .from('scheduled_sessions')
              .update({ participant_cohort_ids: roster.cohortIds })
              .eq('id', payload.scheduledSessionId);
          }
        }
      }
    } catch (reconcileErr) {
      console.warn('Class attendance session roster auto-reconcile warning:', reconcileErr);
    }
  }

  return NextResponse.json({
    success: true,
    classSessionId,
  });
}
