'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getStudentPortalSession } from '@/features/student-portal/session';
import { createAdminClient } from '@/lib/supabase/admin';

import { getStudentKnecPortalData } from './queries';

export interface StudentKnecBookingActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  bookingId?: string;
}

const submitBookingSchema = z.object({
  seriesId: z.string().uuid('Select a valid KNEC exam series.'),
  knecIndexNumber: z
    .string()
    .trim()
    .max(40, 'KNEC Index Number must be at most 40 characters.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  paperCodes: z.array(z.string().trim().min(3)).min(1, 'Select at least one KNEC paper or module to book.'),
  notes: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function submitStudentKnecBookingAction(
  _prevState: StudentKnecBookingActionState,
  formData: FormData,
): Promise<StudentKnecBookingActionState> {
  const session = await getStudentPortalSession();
  if (!session) {
    return { status: 'error', message: 'Your student session has expired. Please sign in again.' };
  }

  const rawPaperCodes = formData
    .getAll('paperCodes')
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const parsed = submitBookingSchema.safeParse({
    seriesId: formData.get('seriesId'),
    knecIndexNumber: formData.get('knecIndexNumber') ?? undefined,
    paperCodes: Array.from(new Set(rawPaperCodes)),
    notes: formData.get('notes') ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid KNEC booking request.',
    };
  }

  const portalData = await getStudentKnecPortalData(session.studentId);
  if (!portalData) {
    return { status: 'error', message: 'Unable to load your KNEC student record.' };
  }

  const targetSeries = portalData.series.find((s) => s.id === parsed.data.seriesId);
  if (!targetSeries || targetSeries.status !== 'booking_open') {
    return {
      status: 'error',
      message: 'This KNEC examination series is not open for student booking.',
    };
  }

  const admin = createAdminClient() as unknown as SupabaseClient;
  const { summary, departmentId } = portalData;

  // Map allowable papers strictly from modules in student's KNEC track that are not completed/exempt
  const paperLookup = new Map<
    string,
    {
      moduleId: string;
      moduleCode: string;
      moduleNumber: number;
      moduleTotalPapers: number;
      paperId: string;
      paperCode: string;
      paperName: string;
      moduleStatus: string;
      isKnownResitPaper: boolean;
    }
  >();

  for (const modProgress of summary.modules) {
    if (modProgress.status === 'completed' || modProgress.status === 'exempt') continue;
    for (const paper of modProgress.module.papers) {
      paperLookup.set(paper.paperCode, {
        moduleId: modProgress.module.id,
        moduleCode: modProgress.module.moduleCode,
        moduleNumber: modProgress.module.moduleNumber,
        moduleTotalPapers: modProgress.module.papers.length,
        paperId: paper.id,
        paperCode: paper.paperCode,
        paperName: paper.paperName,
        moduleStatus: modProgress.status,
        isKnownResitPaper: modProgress.resitPaperCodes.includes(paper.paperCode),
      });
    }
  }

  const selectedPapers = parsed.data.paperCodes
    .map((code) => paperLookup.get(code))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (selectedPapers.length === 0) {
    return {
      status: 'error',
      message: 'None of the selected papers belong to pending or resit modules in your course track.',
    };
  }

  const includesModuleOne = selectedPapers.some((item) => item.moduleNumber === 1);
  const missingFields = summary.missingProfileFields ?? [];
  if (includesModuleOne && missingFields.length > 0) {
    return {
      status: 'error',
      message: `Complete your Student Profile before booking Module I (${missingFields.join(', ')}). Go to Profile to fill these details first.`,
    };
  }

  // Group counts per module to detect partial resit selections
  const countByModule = new Map<string, number>();
  for (const item of selectedPapers) {
    countByModule.set(item.moduleId, (countByModule.get(item.moduleId) ?? 0) + 1);
  }

  let anyResit = false;
  let anyNormal = false;
  const papersWithFlags = selectedPapers.map((item) => {
    const selectedCount = countByModule.get(item.moduleId) ?? 0;
    const isResit =
      item.moduleStatus === 'resit' ||
      item.isKnownResitPaper ||
      (item.moduleTotalPapers > 0 && selectedCount < item.moduleTotalPapers);
    if (isResit) anyResit = true;
    else anyNormal = true;
    return { ...item, isResit };
  });

  const existingBooking = summary.bookings.find((b) => b.seriesId === targetSeries.id);
  if (
    existingBooking &&
    ['hod_cleared', 'registered_knec', 'sat', 'results_recorded'].includes(existingBooking.bookingStatus)
  ) {
    return {
      status: 'error',
      message: `Your ${targetSeries.seriesName} booking has already been cleared/registered and cannot be altered online.`,
    };
  }

  const effectiveIndexNumber = summary.knecIndexNumber ?? parsed.data.knecIndexNumber;
  const bookingType = anyResit && anyNormal ? 'mixed' : anyResit ? 'resit' : 'normal';
  const admSuffix = summary.admissionNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
  const clearanceRef = `ICMHS/KNEC/${targetSeries.seriesCode}/${admSuffix}`;

  const { data: upsertedBooking, error: bookingErr } = await admin
    .from('student_knec_bookings')
    .upsert(
      {
        department_id: departmentId,
        student_id: session.studentId,
        series_id: targetSeries.id,
        knec_index_number: effectiveIndexNumber,
        booking_type: bookingType,
        booking_status: 'submitted',
        clearance_ref: clearanceRef,
        submitted_at: new Date().toISOString(),
        notes: parsed.data.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,series_id' },
    )
    .select('id')
    .single();

  if (bookingErr || !upsertedBooking) {
    return { status: 'error', message: `Unable to save KNEC booking: ${bookingErr?.message ?? 'Unknown error'}` };
  }

  const bookingId = String(upsertedBooking.id);

  // Replace paper lines cleanly for this un-cleared booking
  await admin.from('student_knec_booking_papers').delete().eq('booking_id', bookingId);

  const paperInserts = papersWithFlags.map((p) => ({
    booking_id: bookingId,
    department_id: departmentId,
    student_id: session.studentId,
    series_id: targetSeries.id,
    module_id: p.moduleId,
    paper_id: p.paperId,
    paper_code: p.paperCode,
    paper_name: p.paperName,
    is_resit: p.isResit,
    paper_status: 'booked',
  }));

  const { error: paperErr } = await admin.from('student_knec_booking_papers').insert(paperInserts);
  if (paperErr) {
    return { status: 'error', message: `Booking saved, but failed adding papers: ${paperErr.message}` };
  }

  if (effectiveIndexNumber) {
    await admin
      .from('students')
      .update({ knec_index_number: effectiveIndexNumber })
      .eq('id', session.studentId);
  }

  // Update module statuses for newly booked modules (unless already completed/exempt)
  const bookedModuleIds = Array.from(new Set(papersWithFlags.map((p) => p.moduleId)));
  const statusRows = bookedModuleIds.map((moduleId) => ({
    student_id: session.studentId,
    module_id: moduleId,
    department_id: departmentId,
    status: 'booked',
    completion_source: 'derived',
    knec_index_number: effectiveIndexNumber,
    updated_at: new Date().toISOString(),
  }));

  await admin
    .from('student_knec_module_statuses')
    .upsert(statusRows, { onConflict: 'student_id,module_id' });

  revalidatePath('/student/knec');
  revalidatePath('/assessment/knec');

  return {
    status: 'success',
    message: `KNEC booking saved for ${targetSeries.seriesName} (${papersWithFlags.length} paper${papersWithFlags.length === 1 ? '' : 's'}). Download your clearance PDF below to complete sign-off.`,
    bookingId,
  };
}
