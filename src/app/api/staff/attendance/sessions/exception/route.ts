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

  if (!sessionData) {
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

  const trainerId = sessionData.trainer_id || trainerRow?.id || profile.id;

  let startsAt = '08:00:00';
  let endsAt = '10:00:00';

  if (sessionData.start_time_slot_id) {
    const { data: slot } = await (adminDb as any)
      .from('time_slots')
      .select('start_time, end_time')
      .eq('id', sessionData.start_time_slot_id)
      .maybeSingle();
    if (slot?.start_time) startsAt = slot.start_time;
    if (slot?.end_time) endsAt = slot.end_time;
  }

  if (sessionData.end_time_slot_id) {
    const { data: endSlot } = await (adminDb as any)
      .from('time_slots')
      .select('end_time')
      .eq('id', sessionData.end_time_slot_id)
      .maybeSingle();
    if (endSlot?.end_time) endsAt = endSlot.end_time;
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
