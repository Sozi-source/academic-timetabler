'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import {
  fetchGoogleSheetRows,
  parseCsvText,
  parsePastedText,
  parseWorkbookBuffer,
} from './parsers';
import { reconcileReportingRows } from './reconciliation';
import type {
  RawReportingRow,
  ReportingSyncCommitResult,
  ReportingSyncPreviewResult,
  ReportingSyncSourceType,
} from './types';

/**
 * Generates an interactive reconciliation preview from Google Sheets, Excel/CSV, or Pasted text.
 */
export async function previewReportingSyncAction(
  formData: FormData,
): Promise<ReportingSyncPreviewResult> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return {
      success: false,
      academicPeriod: null,
      summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
      items: [],
      error: 'No active department selected. Please ensure you are signed into an academic department.',
    };
  }

  const sourceType = (formData.get('sourceType') as ReportingSyncSourceType) || 'google_sheet';
  let rawRows: RawReportingRow[] = [];

  try {
    if (sourceType === 'google_sheet') {
      const url = String(formData.get('googleSheetUrl') || '').trim();
      if (!url) {
        return {
          success: false,
          academicPeriod: null,
          summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
          items: [],
          error: 'Please provide a Google Sheets URL.',
        };
      }
      rawRows = await fetchGoogleSheetRows(url);
    } else if (sourceType === 'file') {
      const file = formData.get('file') as File | null;
      if (!file || file.size === 0) {
        return {
          success: false,
          academicPeriod: null,
          summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
          items: [],
          error: 'Please select an Excel (.xlsx) or CSV (.csv) file to upload.',
        };
      }

      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        rawRows = await parseWorkbookBuffer(buffer);
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        const text = await file.text();
        rawRows = parseCsvText(text);
      } else {
        return {
          success: false,
          academicPeriod: null,
          summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
          items: [],
          error: 'Unsupported file format. Please upload a .xlsx or .csv spreadsheet.',
        };
      }
    } else if (sourceType === 'paste') {
      const text = String(formData.get('pastedText') || '').trim();
      if (!text) {
        return {
          success: false,
          academicPeriod: null,
          summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
          items: [],
          error: 'Please paste student admission numbers or spreadsheet rows.',
        };
      }
      rawRows = parsePastedText(text);
    }

    if (rawRows.length === 0) {
      return {
        success: false,
        academicPeriod: null,
        summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
        items: [],
        error:
          'No admission numbers could be identified in the provided data. Ensure your spreadsheet contains a column with admission numbers (e.g., "CHN/S-4184/IC/24").',
      };
    }

    return await reconcileReportingRows(rawRows, profile.activeDepartmentId);
  } catch (err) {
    return {
      success: false,
      academicPeriod: null,
      summary: { totalRows: 0, readyCount: 0, alreadyReportedCount: 0, unmatchedCount: 0 },
      items: [],
      error: err instanceof Error ? err.message : 'An unexpected error occurred during reconciliation.',
    };
  }
}

/**
 * Commits reporting confirmation for selected students.
 * Sets status to 'active', updates reporting sync, and logs audit events.
 */
export async function commitReportingSyncAction(
  studentIds: string[],
  effectiveDate?: string,
): Promise<ReportingSyncCommitResult> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return {
      success: false,
      activatedCount: 0,
      alreadyActiveCount: 0,
      message: 'Active department is required.',
      error: 'No active department selected.',
    };
  }

  if (!studentIds || studentIds.length === 0) {
    return {
      success: false,
      activatedCount: 0,
      alreadyActiveCount: 0,
      message: 'No students selected for confirmation.',
      error: 'Please select at least one student to confirm.',
    };
  }

  const supabase = await createClient();
  const effDate = effectiveDate || new Date().toISOString().split('T')[0];

  // Attempt RPC first
  const { data: rpcResult, error: rpcError } = await supabase.rpc('batch_update_student_status', {
    target_student_ids: studentIds,
    target_status: 'active',
    effective_date: effDate,
    reason: 'Reporting confirmed via Registrar Live Sync',
  });

  if (!rpcError && rpcResult) {
    revalidatePath('/students');
    revalidatePath('/students/registry');
    revalidatePath('/students/unit-registration');
    revalidatePath('/students/reports');

    const updated = typeof rpcResult === 'object' && rpcResult !== null && 'updated_count' in rpcResult
      ? Number(rpcResult.updated_count)
      : studentIds.length;

    return {
      success: true,
      activatedCount: updated,
      alreadyActiveCount: 0,
      message: `Successfully confirmed ${updated} student${updated === 1 ? '' : 's'} as active and reported.`,
    };
  }

  // Fallback to direct client updates if RPC has temporary connection issue
  try {
    const { data: activePeriod } = await supabase
      .from('academic_periods')
      .select('id')
      .eq('status', 'active')
      .maybeSingle();

    // 1. Update students table
    const { error: updateErr } = await supabase
      .from('students')
      .update({
        lifecycle_status: 'active',
        academic_phase: 'in_class',
        updated_at: new Date().toISOString(),
      })
      .in('id', studentIds)
      .eq('department_id', profile.activeDepartmentId);

    if (updateErr) {
      throw new Error(`Failed to update student statuses: ${updateErr.message}`);
    }

    // 2. Upsert period reporting records
    if (activePeriod) {
      const reportingRows = studentIds.map((id) => ({
        department_id: profile.activeDepartmentId,
        student_id: id,
        academic_period_id: activePeriod.id,
        reporting_status: 'reported',
        reported_on: effDate,
        confirmed_at: new Date().toISOString(),
        confirmed_by: profile.id,
        notes: 'Confirmed via Registrar Live Sync',
      }));

      await supabase
        .from('student_period_reporting')
        .upsert(reportingRows, { onConflict: 'student_id, academic_period_id' });
    }

    // 3. Insert audit events
    const eventRows = studentIds.map((id) => ({
      student_id: id,
      event_type: 'resumption',
      effective_date: effDate,
      reason: 'Reporting confirmed via Registrar Live Sync',
      created_by: profile.id,
    }));

    await supabase.from('student_lifecycle_events').insert(eventRows);

    revalidatePath('/students');
    revalidatePath('/students/registry');
    revalidatePath('/students/unit-registration');
    revalidatePath('/students/reports');

    return {
      success: true,
      activatedCount: studentIds.length,
      alreadyActiveCount: 0,
      message: `Successfully confirmed ${studentIds.length} student${studentIds.length === 1 ? '' : 's'} as active and reported.`,
    };
  } catch (err) {
    return {
      success: false,
      activatedCount: 0,
      alreadyActiveCount: 0,
      message: err instanceof Error ? err.message : 'Database error during confirmation.',
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
  }
}
