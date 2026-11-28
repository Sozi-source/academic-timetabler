'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { requireHodAccess } from '@/features/auth/authorization';
import { createAdminClient } from '@/lib/supabase/admin';

import { normalizeKnecSeriesCode } from './domain';
import { applyHistoricalKnecProgressImport, parseHistoricalKnecProgressWorkbook } from './historical-import';
import { applyBulkKnecIndexNumbers, parseKnecIndexImportFile } from './index-import';
import type { KnecBookingStatus, KnecExamSeriesStatus, KnecModuleStatus, KnecPaperResultStatus } from './types';

export interface HodKnecActionState {
  status: 'idle' | 'success' | 'error';
  message: string | null;
}

const createSeriesSchema = z.object({
  seriesMonth: z.string().trim().min(3, 'Enter exam series month (e.g. March, July, November).').max(30),
  seriesYear: z.coerce.number().int().min(2020).max(2050),
  status: z.enum(['planned', 'booking_open', 'booking_closed', 'in_progress', 'results_released', 'archived']),
  bookingOpensOn: z.string().trim().optional().transform((v) => v || null),
  bookingClosesOn: z.string().trim().optional().transform((v) => v || null),
  notes: z.string().trim().max(300).optional().transform((v) => v || null),
});

export async function createKnecExamSeriesAction(formData: FormData): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const parsed = createSeriesSchema.safeParse({
    seriesMonth: formData.get('seriesMonth'),
    seriesYear: formData.get('seriesYear'),
    status: formData.get('status') ?? 'booking_open',
    bookingOpensOn: formData.get('bookingOpensOn') ?? undefined,
    bookingClosesOn: formData.get('bookingClosesOn') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid series details.' };
  }

  const { seriesMonth, seriesYear, status, bookingOpensOn, bookingClosesOn, notes } = parsed.data;
  const seriesCode = normalizeKnecSeriesCode(seriesMonth, seriesYear);
  const seriesName = `${seriesMonth} ${seriesYear}`;
  const admin = createAdminClient() as unknown as SupabaseClient;

  const { error } = await admin.from('knec_exam_series').upsert(
    {
      department_id: profile.activeDepartmentId,
      series_code: seriesCode,
      series_name: seriesName,
      series_month: seriesMonth,
      series_year: seriesYear,
      status,
      booking_opens_on: bookingOpensOn,
      booking_closes_on: bookingClosesOn,
      notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'department_id,series_year,series_month' },
  );

  if (error) {
    return { status: 'error', message: `Unable to save KNEC series: ${error.message}` };
  }

  revalidatePath('/assessment/knec');
  revalidatePath('/student/knec');
  return { status: 'success', message: `${seriesName} saved (${status.replace('_', ' ')}).` };
}

export async function updateKnecExamSeriesStatusAction(params: {
  seriesId: string;
  status: KnecExamSeriesStatus;
}): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const admin = createAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from('knec_exam_series')
    .update({ status: params.status, updated_at: new Date().toISOString() })
    .eq('id', params.seriesId)
    .eq('department_id', profile.activeDepartmentId);

  if (error) {
    return { status: 'error', message: `Failed updating series status: ${error.message}` };
  }

  revalidatePath('/assessment/knec');
  revalidatePath('/student/knec');
  return { status: 'success', message: 'Exam series status updated.' };
}

export async function updateStudentKnecDetailsAction(params: {
  studentId: string;
  knecIndexNumber: string | null;
  moduleUpdates: Array<{
    moduleId: string;
    status: KnecModuleStatus;
    resitPaperCodes?: string[];
    notes?: string | null;
  }>;
}): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const admin = createAdminClient() as unknown as SupabaseClient;
  const trimmedIndex = params.knecIndexNumber?.trim() || null;

  const { error: stuErr } = await admin
    .from('students')
    .update({ knec_index_number: trimmedIndex })
    .eq('id', params.studentId)
    .eq('department_id', profile.activeDepartmentId);

  if (stuErr) {
    return { status: 'error', message: `Failed updating student KNEC index: ${stuErr.message}` };
  }

  if (params.moduleUpdates.length > 0) {
    const payload = params.moduleUpdates.map((item) => ({
      student_id: params.studentId,
      module_id: item.moduleId,
      department_id: profile.activeDepartmentId,
      status: item.status,
      completion_source: 'manual_override',
      knec_index_number: trimmedIndex,
      resit_paper_codes: item.status === 'resit' ? (item.resitPaperCodes ?? []) : [],
      notes: item.notes ?? null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }));

    const { error: modErr } = await admin
      .from('student_knec_module_statuses')
      .upsert(payload, { onConflict: 'student_id,module_id' });

    if (modErr) {
      return { status: 'error', message: `Failed updating module statuses: ${modErr.message}` };
    }
  }

  revalidatePath('/assessment/knec');
  revalidatePath('/student/knec');
  return { status: 'success', message: 'Student KNEC details and module progression updated.' };
}

export async function updateKnecBookingStatusAction(params: {
  bookingId: string;
  bookingStatus: KnecBookingStatus;
  knecIndexNumber?: string | null;
}): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const admin = createAdminClient() as unknown as SupabaseClient;
  const trimmedIndex = params.knecIndexNumber?.trim() || null;

  const updatePayload: Record<string, unknown> = {
    booking_status: params.bookingStatus,
    updated_at: new Date().toISOString(),
  };
  if (trimmedIndex !== null) updatePayload.knec_index_number = trimmedIndex;
  if (params.bookingStatus === 'hod_cleared' || params.bookingStatus === 'registered_knec') {
    updatePayload.hod_cleared_at = new Date().toISOString();
    updatePayload.hod_cleared_by = profile.id;
  }

  const { data: booking, error } = await admin
    .from('student_knec_bookings')
    .update(updatePayload)
    .eq('id', params.bookingId)
    .eq('department_id', profile.activeDepartmentId)
    .select('id, student_id')
    .maybeSingle();

  if (error || !booking) {
    return { status: 'error', message: `Unable to update booking: ${error?.message ?? 'Not found'}` };
  }

  if (trimmedIndex) {
    await admin
      .from('students')
      .update({ knec_index_number: trimmedIndex })
      .eq('id', booking.student_id)
      .eq('department_id', profile.activeDepartmentId);
  }

  revalidatePath('/assessment/knec');
  revalidatePath('/student/knec');
  return { status: 'success', message: 'Booking status updated.' };
}

export async function recordKnecBookingPaperResultsAction(params: {
  bookingId: string;
  papers: Array<{
    paperRecordId: string;
    paperStatus: KnecPaperResultStatus;
    grade?: string | null;
  }>;
}): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const admin = createAdminClient() as unknown as SupabaseClient;
  const departmentId = profile.activeDepartmentId;

  const { data: booking } = await admin
    .from('student_knec_bookings')
    .select('id, student_id, series_id, knec_index_number')
    .eq('id', params.bookingId)
    .eq('department_id', departmentId)
    .maybeSingle();

  if (!booking) return { status: 'error', message: 'Booking record not found.' };

  for (const p of params.papers) {
    const { error } = await admin
      .from('student_knec_booking_papers')
      .update({
        paper_status: p.paperStatus,
        grade: p.grade?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.paperRecordId)
      .eq('booking_id', booking.id);

    if (error) {
      return { status: 'error', message: `Failed saving paper result: ${error.message}` };
    }
  }

  // Re-evaluate affected modules for this booking & series
  const [{ data: bookingPapers }, { data: allModPapers }] = await Promise.all([
    admin
      .from('student_knec_booking_papers')
      .select('module_id, paper_code, paper_status')
      .eq('booking_id', booking.id),
    admin
      .from('knec_papers')
      .select('module_id, paper_code')
      .eq('department_id', departmentId)
      .eq('is_active', true),
  ]);

  const byMod = new Map<string, Array<{ paper_code: string; paper_status: string }>>();
  for (const bp of bookingPapers ?? []) {
    byMod.set(bp.module_id, [...(byMod.get(bp.module_id) ?? []), bp]);
  }
  const catalogCodesByMod = new Map<string, string[]>();
  for (const cp of allModPapers ?? []) {
    catalogCodesByMod.set(cp.module_id, [...(catalogCodesByMod.get(cp.module_id) ?? []), cp.paper_code]);
  }

  const allCompletedOrRecorded = (bookingPapers ?? []).every((bp) =>
    ['passed', 'referred', 'absent', 'cancelled'].includes(bp.paper_status),
  );

  for (const [moduleId, items] of byMod) {
    const failed = items
      .filter((i) => i.paper_status === 'referred' || i.paper_status === 'absent')
      .map((i) => i.paper_code);
    const passedSet = new Set(items.filter((i) => i.paper_status === 'passed').map((i) => i.paper_code));
    const expectedCodes = catalogCodesByMod.get(moduleId) ?? items.map((i) => i.paper_code);

    if (failed.length > 0) {
      await admin.from('student_knec_module_statuses').upsert(
        {
          student_id: booking.student_id,
          module_id: moduleId,
          department_id: departmentId,
          status: 'resit',
          completion_source: 'booking_results',
          resit_paper_codes: failed,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,module_id' },
      );
    } else if (expectedCodes.every((code) => passedSet.has(code)) || (items.length > 0 && items.every((i) => i.paper_status === 'passed'))) {
      await admin.from('student_knec_module_statuses').upsert(
        {
          student_id: booking.student_id,
          module_id: moduleId,
          department_id: departmentId,
          status: 'completed',
          completion_source: 'booking_results',
          completed_series_id: booking.series_id,
          resit_paper_codes: [],
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,module_id' },
      );
    }
  }

  if (allCompletedOrRecorded) {
    await admin
      .from('student_knec_bookings')
      .update({ booking_status: 'results_recorded', updated_at: new Date().toISOString() })
      .eq('id', booking.id);
  }

  revalidatePath('/assessment/knec');
  revalidatePath('/student/knec');
  return { status: 'success', message: 'KNEC paper results saved and module progress updated.' };
}

export async function importHistoricalKnecExcelAction(
  _prevState: HodKnecActionState,
  formData: FormData,
): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Upload an .xlsx KNEC Progress workbook first.' };
  }

  try {
    const buffer = await file.arrayBuffer();
    const rows = await parseHistoricalKnecProgressWorkbook(buffer);
    if (rows.length === 0) {
      return { status: 'error', message: 'No student rows were found in the uploaded spreadsheet.' };
    }

    const admin = createAdminClient() as unknown as SupabaseClient;
    const summary = await applyHistoricalKnecProgressImport({
      admin,
      departmentId: profile.activeDepartmentId,
      rows,
      initializeOmittedCompletedStudents: formData.get('initializeOmittedCompleted') === 'true',
      actorId: profile.id,
    });

    revalidatePath('/assessment/knec');
    revalidatePath('/student/knec');

    return {
      status: 'success',
      message: `Imported ${summary.matchedStudents}/${summary.totalRows} students (${summary.moduleStatusRecordsUpserted} module statuses, ${summary.nov2026BookingsUpserted} Nov 2026 bookings, ${summary.nov2026PaperRecordsUpserted} papers).${
        summary.unmatchedAdmissionNumbers.length > 0
          ? ` Unmatched: ${summary.unmatchedAdmissionNumbers.slice(0, 5).join(', ')}`
          : ''
      }`,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to import KNEC progress workbook.',
    };
  }
}

const batchIndexEntrySchema = z.object({
  admissionNumber: z.string().trim().min(2).max(60),
  knecIndexNumber: z.string().trim().min(3, 'KNEC index number is too short.').max(40),
});

export async function batchUpdateSeriesKnecIndexNumbersAction(input: {
  seriesId?: string | null;
  markBookingsRegistered?: boolean;
  entries: Array<{ admissionNumber: string; knecIndexNumber: string }>;
}): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const cleaned = input.entries
    .map((entry) => ({
      admissionNumber: entry.admissionNumber.trim(),
      knecIndexNumber: entry.knecIndexNumber.trim(),
    }))
    .filter((entry) => entry.admissionNumber.length > 0 && entry.knecIndexNumber.length > 0);

  if (cleaned.length === 0) {
    return { status: 'error', message: 'Enter at least one KNEC index number before saving.' };
  }

  const parsed = z.array(batchIndexEntrySchema).safeParse(cleaned);
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid KNEC index entry values.',
    };
  }

  const admin = createAdminClient() as unknown as SupabaseClient;
  const summary = await applyBulkKnecIndexNumbers({
    admin,
    departmentId: profile.activeDepartmentId,
    entries: parsed.data,
    seriesId: input.seriesId && input.seriesId !== 'all' ? input.seriesId : null,
    markBookingsRegistered: Boolean(input.markBookingsRegistered),
    actorId: profile.id,
  });

  revalidatePath('/assessment/knec');
  revalidatePath('/student/knec');

  return {
    status: 'success',
    message: `Updated KNEC index numbers for ${summary.matchedStudents} student(s) (${summary.updatedBookings} booking record(s) synced).${
      summary.unmatchedAdmissionNumbers.length > 0
        ? ` Unmatched: ${summary.unmatchedAdmissionNumbers.slice(0, 5).join(', ')}`
        : ''
    }`,
  };
}

export async function importBulkKnecIndexNumbersAction(
  _prevState: HodKnecActionState,
  formData: FormData,
): Promise<HodKnecActionState> {
  const profile = await requireHodAccess();
  if (!profile.activeDepartmentId) return { status: 'error', message: 'No active department selected.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Select an .xlsx or .csv file containing Admission No. and KNEC Index Number.' };
  }

  const seriesIdRaw = String(formData.get('seriesId') ?? '').trim();
  const seriesId = seriesIdRaw && seriesIdRaw !== 'all' ? seriesIdRaw : null;
  const markBookingsRegistered = formData.get('markBookingsRegistered') === 'true';

  try {
    const buffer = await file.arrayBuffer();
    const entries = await parseKnecIndexImportFile(buffer, file.name);
    if (entries.length === 0) {
      return {
        status: 'error',
        message: 'No valid rows found. Ensure columns include Admission No. and KNEC Index Number.',
      };
    }

    const admin = createAdminClient() as unknown as SupabaseClient;
    const summary = await applyBulkKnecIndexNumbers({
      admin,
      departmentId: profile.activeDepartmentId,
      entries,
      seriesId,
      markBookingsRegistered,
      actorId: profile.id,
    });

    revalidatePath('/assessment/knec');
    revalidatePath('/student/knec');

    return {
      status: 'success',
      message: `Applied KNEC index numbers for ${summary.matchedStudents}/${summary.totalRows} rows (${summary.updatedBookings} booking record(s) synced).${
        summary.unmatchedAdmissionNumbers.length > 0
          ? ` Unmatched admission numbers: ${summary.unmatchedAdmissionNumbers.slice(0, 8).join(', ')}`
          : ''
      }`,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to parse uploaded KNEC index sheet.',
    };
  }
}
