import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TeachingDocumentType,
} from './domain';
import type {
  TeachingDocumentStudentReleaseItem,
} from './student-release-types';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value:
    unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function asNumber(
  value:
    unknown,
): number | null {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

export async function getTeachingDocumentStudentReleaseQueue():
Promise<TeachingDocumentStudentReleaseItem[]> {
  const supabase =
    (
      await createClient()
    ) as unknown as
      SupabaseClient;

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_teaching_document_student_release_queue',
    );

  if (error) {
    throw new Error(
      `Unable to load student document releases: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as UnknownRow[]
  )
    .map(
      (
        row,
      ): TeachingDocumentStudentReleaseItem | null => {
        const id =
          asString(
            row.document_id,
          );

        const documentType =
          asString(
            row.document_type,
          ) as
            | TeachingDocumentType
            | null;

        const versionNumber =
          asNumber(
            row.version_number,
          );

        const approvedRevisionNumber =
          asNumber(
            row.approved_revision_number,
          );

        if (
          !id ||
          !documentType ||
          versionNumber ===
            null ||
          approvedRevisionNumber ===
            null
        ) {
          return null;
        }

        return {
          id,
          documentType,
          versionNumber,
          approvedRevisionNumber,
          approvedAt:
            asString(
              row.approved_at,
            ),
          studentPublishedAt:
            asString(
              row.student_published_at,
            ),
          originalFilename:
            asString(
              row.original_filename,
            ),
          unitName:
            asString(
              row.unit_name,
            ) ??
            'Unit',
          cohortName:
            asString(
              row.cohort_name,
            ) ??
            'Cohort',
          academicPeriodName:
            asString(
              row.academic_period_name,
            ) ??
            'Academic Period',
          trainerName:
            asString(
              row.trainer_name,
            ) ??
            'Trainer',
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        TeachingDocumentStudentReleaseItem =>
        Boolean(
          item,
        ),
    );
}
