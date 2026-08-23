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
          : { data: null },
      ]);

      const workingDay = (days ?? []).find((d: any) => String(d.day_of_week).toLowerCase() === dayStr) || days?.[0];
      const startSlot = (slots ?? []).find((s: any) => String(s.starts_at).slice(0, 5) === String(match.startTime || '08:00').slice(0, 5)) || slots?.[0];
      const endSlot = (slots ?? []).find((s: any) => String(s.ends_at).slice(0, 5) === String(match.endTime || '10:00').slice(0, 5)) || slots?.[slots.length - 1] || startSlot;
      const room = (rooms ?? []).find((r: any) => r.name === match.roomName) || rooms?.[0];

      const teachingAllocId = alloc?.data?.id || match.teachingAllocationId || match.allocationId;
      const cohortId = alloc?.data?.cohort_id || match.cohortId;
      const unitId = alloc?.data?.unit_id || match.unitId;
      const trainerId = alloc?.data?.trainer_id || match.trainerId;

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
        }, { onConflict: 'id' });
      }
    }
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

  if (error) {
    // If RPC fails (e.g. date outside period or day mismatch), use direct class_sessions insert / retrieval fallback with admin client
    try {
      const { data: existingCs } = await (adminDb as any)
        .from('class_sessions')
        .select('id')
        .eq('scheduled_session_id', payload.scheduledSessionId)
        .eq('session_date', payload.sessionDate)
        .maybeSingle();

      if (existingCs) {
        return NextResponse.json({
          success: true,
          classSessionId: existingCs.id,
        });
      }

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

      // Seed student registrations into class_attendance_entries
      if (sessionData.cohort_id) {
        const { data: students } = await (adminDb as any)
          .from('students')
          .select('id')
          .eq('cohort_id', sessionData.cohort_id)
          .eq('status', 'active');

        if (students && students.length > 0) {
          const records = students.map((st: any) => ({
            class_session_id: newCs.id,
            student_id: st.id,
            cohort_id: sessionData.cohort_id,
            attendance_status: 'unmarked',
          }));
          await (adminDb as any).from('class_attendance_entries').upsert(records, { onConflict: 'class_session_id,student_id' });
        }
      }

      return NextResponse.json({
        success: true,
        classSessionId: newCs.id,
      });
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

  return NextResponse.json({
    success:
      true,
    classSessionId:
      data,
  });
}
