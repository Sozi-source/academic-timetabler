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
  TeachingDocumentPublicationItem,
} from './publication-types';

type UnknownRow =
  Record<string, unknown>;

async function client():
Promise<SupabaseClient> {
  return (
    await createClient()
  ) as unknown as
    SupabaseClient;
}

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
  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

async function rowsByIds(
  supabase:
    SupabaseClient,
  table:
    string,
  ids:
    string[],
): Promise<UnknownRow[]> {
  const uniqueIds =
    [
      ...new Set(
        ids.filter(
          Boolean,
        ),
      ),
    ];

  if (
    uniqueIds.length ===
    0
  ) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        table,
      )
      .select(
        '*',
      )
      .in(
        'id',
        uniqueIds,
      );

  if (error) {
    throw new Error(
      `Unable to load ${table}: ${error.message}`,
    );
  }

  return (
    data ??
    []
  ) as UnknownRow[];
}

function byId(
  rows:
    UnknownRow[],
) {
  return new Map(
    rows
      .map(
        (row) => [
          asString(
            row.id,
          ),
          row,
        ] as const,
      )
      .filter(
        (
          entry,
        ): entry is
          readonly [
            string,
            UnknownRow,
          ] =>
          Boolean(
            entry[0],
          ),
      ),
  );
}

export async function getApprovedTeachingDocuments():
Promise<TeachingDocumentPublicationItem[]> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'teaching_documents',
      )
      .select(
        'id, document_type, version_number, approved_revision_number, student_visible, approved_at, unit_id, cohort_id, academic_period_id, trainer_id',
      )
      .eq(
        'status',
        'approved',
      )
      .order(
        'approved_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw new Error(
      `Unable to load approved teaching documents: ${error.message}`,
    );
  }

  const rows =
    (
      data ??
      []
    ) as UnknownRow[];

  const [
    units,
    cohorts,
    periods,
    trainers,
  ] =
    await Promise.all([
      rowsByIds(
        supabase,
        'units',
        rows
          .map(
            (row) =>
              asString(
                row.unit_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),

      rowsByIds(
        supabase,
        'cohorts',
        rows
          .map(
            (row) =>
              asString(
                row.cohort_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),

      rowsByIds(
        supabase,
        'academic_periods',
        rows
          .map(
            (row) =>
              asString(
                row.academic_period_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),

      rowsByIds(
        supabase,
        'trainers',
        rows
          .map(
            (row) =>
              asString(
                row.trainer_id,
              ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          ),
      ),
    ]);

  const unitById =
    byId(
      units,
    );

  const cohortById =
    byId(
      cohorts,
    );

  const periodById =
    byId(
      periods,
    );

  const trainerById =
    byId(
      trainers,
    );

  return rows
    .map(
      (
        row,
      ): TeachingDocumentPublicationItem | null => {
        const id =
          asString(
            row.id,
          );

        const documentType =
          asString(
            row.document_type,
          ) as
            | TeachingDocumentType
            | null;

        const approvedRevisionNumber =
          asNumber(
            row.approved_revision_number,
          );

        const unitId =
          asString(
            row.unit_id,
          );

        const cohortId =
          asString(
            row.cohort_id,
          );

        const academicPeriodId =
          asString(
            row.academic_period_id,
          );

        const trainerId =
          asString(
            row.trainer_id,
          );

        if (
          !id ||
          !documentType ||
          approvedRevisionNumber ===
            null ||
          !unitId ||
          !cohortId ||
          !academicPeriodId ||
          !trainerId
        ) {
          return null;
        }

        return {
          id,
          documentType,
          versionNumber:
            asNumber(
              row.version_number,
            ) ??
            1,
          approvedRevisionNumber,
          studentVisible:
            row.student_visible ===
            true,
          approvedAt:
            asString(
              row.approved_at,
            ),
          unitName:
            asString(
              unitById.get(
                unitId,
              )?.name,
            ) ??
            'Unit',
          cohortName:
            asString(
              cohortById.get(
                cohortId,
              )?.name,
            ) ??
            'Cohort',
          academicPeriodName:
            asString(
              periodById.get(
                academicPeriodId,
              )?.name,
            ) ??
            'Academic Period',
          trainerName:
            asString(
              trainerById.get(
                trainerId,
              )?.full_name,
            ) ??
            'Trainer',
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        TeachingDocumentPublicationItem =>
        Boolean(
          item,
        ),
    );
}
