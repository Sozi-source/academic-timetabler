import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireTrainerAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

interface ExceptionPayload {
  scheduledSessionId?: unknown;
  sessionDate?: unknown;
  reason?: unknown;
  notes?: unknown;
}

export async function POST(request: Request) {
  const profile = await requireTrainerAccess();

  const payload = await request.json().catch(() => null) as ExceptionPayload | null;

  if (
    !payload ||
    typeof payload.scheduledSessionId !== 'string' ||
    typeof payload.sessionDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.sessionDate) ||
    typeof payload.reason !== 'string' ||
    !payload.reason.trim()
  ) {
    return NextResponse.json(
      { message: 'Valid scheduled class, date, and reason are required.' },
      { status: 400 }
    );
  }

  const adminDb = createAdminClient();

  // 1. Check if class_session already exists
  const { data: existingCs } = await (adminDb as any)
    .from('class_sessions')
    .select('id, status')
    .eq('scheduled_session_id', payload.scheduledSessionId)
    .eq('session_date', payload.sessionDate)
    .maybeSingle();

  const formattedNotes = payload.notes && typeof payload.notes === 'string' && payload.notes.trim()
    ? `${payload.reason.trim()}: ${payload.notes.trim()}`
    : payload.reason.trim();

  if (existingCs) {
    const { error: updateError } = await (adminDb as any)
      .from('class_sessions')
      .update({
        status: 'cancelled',
        notes: formattedNotes.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingCs.id);

    if (updateError) {
      return NextResponse.json(
        { message: updateError.message || 'Could not record exception.' },
        { status: 500 }
      );
    }

    try {
      revalidatePath('/staff/daily-report');
      revalidatePath('/staff/attendance');
    } catch {
      // Revalidation warning ignored in non-blocking environments
    }

    return NextResponse.json({ success: true, classSessionId: existingCs.id });
  }

  // 2. Lookup scheduled session details to create cancelled class_session
  const { data: sessionData } = await (adminDb as any)
    .from('scheduled_sessions')
    .select('id, academic_period_id, teaching_allocation_id, cohort_id, unit_id, trainer_id, start_time_slot_id, end_time_slot_id')
    .eq('id', payload.scheduledSessionId)
    .maybeSingle();

  let resolvedSession = sessionData;

  if (!resolvedSession) {
    const { data: versions } = await (adminDb as any)
      .from('timetable_versions')
      .select('academic_period_id, snapshot')
      .eq('status', 'published')
      .order('version_number', { ascending: false });

    for (const v of versions ?? []) {
      const snapshot = Array.isArray(v.snapshot) ? v.snapshot : [];
      const match = snapshot.find((item: any) => String(item.id) === payload.scheduledSessionId);
      if (match) {
        let allocId = match.teachingAllocationId || match.allocationId;
        if (!allocId) {
          const { data: ta } = await (adminDb as any)
            .from('teaching_allocations')
            .select('id')
            .eq('academic_period_id', v.academic_period_id)
            .eq('unit_id', match.unitId)
            .limit(1)
            .maybeSingle();
          allocId = ta?.id;
        }

        resolvedSession = {
          id: payload.scheduledSessionId,
          academic_period_id: v.academic_period_id,
          teaching_allocation_id: allocId,
          cohort_id: match.cohortId,
          unit_id: match.unitId,
          trainer_id: match.trainerId,
          startTime: match.startTime,
          endTime: match.endTime,
        };
        break;
      }
    }
  }

  if (!resolvedSession) {
    return NextResponse.json(
      { message: 'Scheduled session was not found.' },
      { status: 404 }
    );
  }

  // Resolve trainer ID to ensure valid foreign key reference
  const { data: trainerRow } = await (adminDb as any)
    .from('trainers')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();

  const trainerId = resolvedSession.trainer_id || trainerRow?.id || profile.id;

  let startsAt = '08:00:00';
  let endsAt = '10:00:00';

  if (sessionData.start_time_slot_id) {
    const { data: slot } = await (adminDb as any)
      .from('time_slots')
      .select('starts_at, ends_at')
      .eq('id', sessionData.start_time_slot_id)
      .maybeSingle();
    if (slot?.starts_at) startsAt = slot.starts_at;
    if (slot?.ends_at) endsAt = slot.ends_at;
  }

  if (sessionData.end_time_slot_id) {
    const { data: endSlot } = await (adminDb as any)
      .from('time_slots')
      .select('ends_at')
      .eq('id', sessionData.end_time_slot_id)
      .maybeSingle();
    if (endSlot?.ends_at) endsAt = endSlot.ends_at;
  }

  // Fallback to published timetable snapshot
  if (startsAt === '08:00:00' && endsAt === '10:00:00') {
    const { data: versions } = await (adminDb as any)
      .from('timetable_versions')
      .select('snapshot')
      .eq('status', 'published')
      .order('version_number', { ascending: false })
      .limit(3);

    for (const v of versions ?? []) {
      const snapshot = Array.isArray(v.snapshot) ? v.snapshot : [];
      const snapshotMatch = snapshot.find((item: any) => String(item.id) === payload.scheduledSessionId);
      if (snapshotMatch?.startTime && snapshotMatch?.endTime) {
        startsAt = snapshotMatch.startTime;
        endsAt = snapshotMatch.endTime;
        break;
      }
    }
  }

  const { data: newCs, error: insertError } = await (adminDb as any)
    .from('class_sessions')
    .insert({
      academic_period_id: sessionData.academic_period_id,
      teaching_allocation_id: sessionData.teaching_allocation_id,
      scheduled_session_id: payload.scheduledSessionId,
      cohort_id: sessionData.cohort_id,
      unit_id: sessionData.unit_id,
      trainer_id: trainerId,
      session_date: payload.sessionDate,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'cancelled',
      notes: formattedNotes.slice(0, 1000),
      opened_by: profile.id,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json(
      { message: insertError.message || 'Could not log session exception.' },
      { status: 500 }
    );
  }

  try {
    revalidatePath('/staff/daily-report');
    revalidatePath('/staff/attendance');
  } catch {
    // Revalidation warning ignored in non-blocking environments
  }

  return NextResponse.json({ success: true, classSessionId: newCs.id });
}
