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

  for (const unit of units) {
    registerUnitCurriculum(unit);
  }

  revalidatePath('/staff/documents');
  return { ok: true, count: units.length };
}
