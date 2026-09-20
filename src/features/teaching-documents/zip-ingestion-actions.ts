'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import {
  registerUnitCurriculum,
  type UnitCurriculumDefinition,
} from './curriculum-registry';
import { ingestCurriculumZipArchive } from './zip-ingestion';

export interface IngestionPreviewResult {
  ok: boolean;
  error?: string;
  totalFilesProcessed?: number;
  extractedUnits?: UnitCurriculumDefinition[];
  /** Files whose document type (scheme_of_work vs course_outline) couldn't be
   *  detected — these are excluded from extractedUnits and must be resolved
   *  manually (rename with a clear keyword, or re-upload individually via
   *  the template manager) before anything from them can be committed. */
  unresolvedFiles?: string[];
}

export async function previewCurriculumZipAction(
  formData: FormData
): Promise<IngestionPreviewResult> {
  await requireHodAccess();

  const file = formData.get('zipFile') as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: 'Please select a valid .zip archive file.' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await ingestCurriculumZipArchive(buffer);

    if (result.extractedUnits.length === 0) {
      return {
        ok: false,
        error:
          'No valid course outlines or schemes of work could be extracted from the uploaded archive. Ensure files are .docx, .xlsx, or .txt.',
      };
    }

    return {
      ok: true,
      totalFilesProcessed: result.totalFilesProcessed,
      extractedUnits: result.extractedUnits,
      unresolvedFiles: result.unresolvedFiles,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ZIP parsing error';
    return { ok: false, error: `Failed to process ZIP archive: ${message}` };
  }
}

export async function commitIngestedCurriculumAction(
  units: UnitCurriculumDefinition[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  await requireHodAccess();

  if (!units || units.length === 0) {
    return { ok: false, count: 0, error: 'No units to commit.' };
  }

  // Refuse to commit anything without an explicit document type — this is
  // exactly the check that was missing before, letting scheme_of_work
  // content silently save under course_outline.
  const untagged = units.filter((u) => !u.documentType);
  if (untagged.length > 0) {
    return {
      ok: false,
      count: 0,
      error: `${untagged.length} unit(s) have no confirmed document type (e.g. ${untagged[0].unitCode}). Assign scheme_of_work or course_outline to each before committing.`,
    };
  }

  const { normalizeUnitCodeKey } = await import('./curriculum-registry');

  // Schemes of work are built FROM course outlines, so a scheme should never
  // be committed for a unit that has no course outline yet — otherwise a
  // trainer can end up viewing a scheme of work with nothing behind it.
  // A unit satisfies this either because its course outline is already
  // active in the database, or because its course outline is included in
  // this very same batch.
  const schemeUnits = units.filter((u) => u.documentType === 'scheme_of_work');

  if (schemeUnits.length > 0) {
    const codeKeysInThisBatch = new Set(
      units
        .filter((u) => u.documentType === 'course_outline')
        .map((u) => normalizeUnitCodeKey(u.unitCode))
    );

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const candidateIds = schemeUnits.map(
      (u) => `tpl-tvet-${normalizeUnitCodeKey(u.unitCode)}-course_outline`
    );

    const { data: existingOutlines, error: lookupError } = await admin
      .from('teaching_document_templates')
      .select('id')
      .in('id', candidateIds)
      .eq('status', 'active');

    if (lookupError) {
      return {
        ok: false,
        count: 0,
        error: `Could not verify existing course outlines before committing: ${lookupError.message}`,
      };
    }

    const existingIds = new Set((existingOutlines ?? []).map((row) => row.id));

    const missingOutline = schemeUnits.filter((u) => {
      const codeKey = normalizeUnitCodeKey(u.unitCode);
      const hasExisting = existingIds.has(`tpl-tvet-${codeKey}-course_outline`);
      const hasInBatch = codeKeysInThisBatch.has(codeKey);
      return !hasExisting && !hasInBatch;
    });

    if (missingOutline.length > 0) {
      const list = missingOutline.map((u) => u.unitCode).join(', ');
      return {
        ok: false,
        count: 0,
        error: `${missingOutline.length} scheme(s) of work have no course outline to build on yet (${list}). Import the course outline for these units first, or include it in this same batch.`,
      };
    }
  }

  const { persistUnitCurriculumToDatabase } = await import('./curriculum-registry');

  for (const unit of units) {
    await persistUnitCurriculumToDatabase(unit);
  }

  revalidatePath('/staff/documents');
  return { ok: true, count: units.length };
}