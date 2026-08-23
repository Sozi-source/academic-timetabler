'use server';

import { revalidatePath } from 'next/cache';
import { requireHodAccess } from '@/features/auth/authorization';
import { createClient } from '@/lib/supabase/server';
import {
  parseCurriculumContentWorkbook,
  type ParsedCurriculumContentWorkbook,
} from './workbook';
import type { CurriculumContentImportState } from './state';

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function cleanCodeKey(value: string) {
  return value
    .replace(/[\s\-_.]+/g, '')
    .toUpperCase();
}

export async function stageCurriculumContentImportAction(
  _previous: CurriculumContentImportState,
  formData: FormData,
): Promise<CurriculumContentImportState> {
  const profile = await requireHodAccess();

  if (!profile.activeDepartmentId) {
    return {
      status: 'error',
      message: 'No active department selected.',
    };
  }

  const file = formData.get('workbook');

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: 'error',
      message: 'Please select an Excel workbook.',
    };
  }

  if (file.size > 25 * 1024 * 1024) {
    return {
      status: 'error',
      message: 'Excel workbook exceeds the 25 MB limit.',
    };
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return {
      status: 'error',
      message:
        'Curriculum Content accepts only the official Academic Planner Excel (.xlsx) templates.',
    };
  }

  let parsed: ParsedCurriculumContentWorkbook;

  try {
    parsed = await parseCurriculumContentWorkbook(
      await file.arrayBuffer(),
    );
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Excel workbook could not be parsed.',
    };
  }

  if (parsed.errors.length > 0) {
    return {
      status: 'error',
      message: 'Validation failed.',
      details: parsed.errors.slice(0, 100),
    };
  }

  if (parsed.unitMappings.length === 0) {
    return {
      status: 'error',
      message:
        'No completed curriculum units were found in the workbook.',
    };
  }

  const supabase = await createClient();

  const { data: units, error: unitError } =
    await supabase
      .from('units')
      .select('id,code,name,department_id,is_active')
      .eq('is_active', true);

  if (unitError) {
    return {
      status: 'error',
      message: `Units could not be verified: ${unitError.message}`,
    };
  }

  const unitMap = new Map<
    string,
    { id: string; code: string; name: string }
  >();

  (units ?? []).forEach((unit) => {
    const code = String(unit.code);

    unitMap.set(
      normalizeCode(code),
      {
        id: unit.id,
        code,
        name: unit.name,
      },
    );

    unitMap.set(
      cleanCodeKey(code),
      {
        id: unit.id,
        code,
        name: unit.name,
      },
    );
  });

  const resolvedMappings = new Map<
    string,
    { id: string; code: string; name: string }
  >();

  const missingCodes: string[] = [];

  for (const mapping of parsed.unitMappings) {
    const rawCode = mapping.unit_code;
    const normalized = normalizeCode(rawCode);

    const matched =
      unitMap.get(normalized) ??
      unitMap.get(cleanCodeKey(rawCode));

    if (matched) {
      resolvedMappings.set(normalized, matched);
    } else {
      missingCodes.push(rawCode);
    }
  }

  const uniqueMissingCodes = [
    ...new Set(missingCodes),
  ];

  if (uniqueMissingCodes.length > 0) {
    return {
      status: 'error',
      message: `${uniqueMissingCodes.length} unit code(s) do not exist in the system registry.`,
      details: uniqueMissingCodes.map(
        (code) =>
          `Unknown unit code: "${code}". Register or correct this unit before importing curriculum.`,
      ),
    };
  }

  const metadataByFamily =
    new Map<string, Record<string, string>>(
      parsed.curriculum.map((row) => [
        row.content_family_key,
        row,
      ]),
    );

  const families = [
    ...metadataByFamily.entries(),
  ].map(([familyKey, metadata]) => {
    const familyMappings =
      parsed.unitMappings.filter(
        (row) =>
          row.content_family_key === familyKey,
      );

    return {
      documentType: parsed.documentType,
      familyKey,
      familyName:
        metadata.content_family_name ||
        familyKey,
      version: Number(
        metadata.curriculum_version || 1,
      ),
      unitDescription:
        metadata.unit_description || '',
      overallCompetency:
        metadata.overall_competency || '',
      teachingLearningApproaches:
        metadata.teaching_learning_approaches ||
        '',
      assessmentApproaches:
        metadata.assessment_approaches || '',
      learningOutcomes: parsed.outcomes
        .filter(
          (row) =>
            row.content_family_key === familyKey &&
            row.learning_outcome,
        )
        .map((row) => ({
          sequence: Number(row.sequence || 1),
          text: row.learning_outcome,
        })),
      weeks: parsed.weeks
        .filter(
          (row) =>
            row.content_family_key === familyKey,
        )
        .map((row) => ({
          unitCode: row.unit_code || '',
          weekNumber: Number(row.week_number),
          topic: row.topic,
          specificCoverage:
            row.specific_coverage || '',
          learningOutcomes:
            row.learning_outcomes || '',
          teachingLearningActivities:
            row.teaching_learning_activities ||
            '',
          assessmentLearningCheck:
            row.assessment_learning_check || '',
          resources: row.resources || '',
        }))
        .sort(
          (a, b) =>
            a.unitCode.localeCompare(
              b.unitCode,
            ) ||
            a.weekNumber - b.weekNumber,
        ),
      references: parsed.references
        .filter(
          (row) =>
            row.content_family_key === familyKey &&
            row.reference_resource,
        )
        .map((row) => ({
          sequence: Number(row.sequence || 1),
          text: row.reference_resource,
        })),
      unitMappings: familyMappings.map(
        (row, index) => {
          const matched =
            resolvedMappings.get(
              normalizeCode(row.unit_code),
            );

          if (!matched) {
            throw new Error(
              `Unit mapping could not be resolved for ${row.unit_code}.`,
            );
          }

          return {
            unitId: matched.id,
            unitCode: matched.code,
            isPrimary: index === 0,
          };
        },
      ),
    };
  });

  const { data: batch, error: batchError } =
    await supabase
      .from('curriculum_content_import_batches')
      .insert({
        department_id:
          profile.activeDepartmentId,
        original_file_name: file.name,
        template_version:
          parsed.templateVersion,
        status: 'validated',
        payload: {
          documentType: parsed.documentType,
          families,
        },
        validation_summary: {
          documentType: parsed.documentType,
          families: families.length,
          units: parsed.unitMappings.length,
          weeks: parsed.weeks.length,
          outcomes: parsed.outcomes.length,
          references: parsed.references.length,
          warnings: parsed.warnings,
        },
        created_by: profile.id,
      })
      .select('id')
      .single();

  if (batchError || !batch) {
    return {
      status: 'error',
      message:
        batchError?.message ??
        'Validation batch could not be created.',
    };
  }

  return {
    status: 'success',
    message:
      'Curriculum content validated successfully. Review before importing.',
    batchId: batch.id,
  };
}

export async function confirmCurriculumContentImportAction(
  formData: FormData,
) {
  await requireHodAccess();

  const batchId = String(
    formData.get('batchId') ?? '',
  ).trim();

  if (!batchId) {
    throw new Error(
      'Missing curriculum content import batch.',
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    'import_curriculum_content_batch',
    {
      target_batch_id: batchId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/teaching-documents');
  revalidatePath(
    '/teaching-documents/curriculum',
  );
  revalidatePath(
    '/teaching-documents/curriculum/import',
  );
  revalidatePath('/staff/documents');

  return data;
}
