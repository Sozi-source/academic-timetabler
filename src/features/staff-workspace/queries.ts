import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  getStaffWorkspace,
} from '@/features/staff-assessment/queries';
import {
  teachingDocumentLabel,
  type TeachingDocumentType,
} from '@/features/teaching-documents/domain';
import {
  createClient,
} from '@/lib/supabase/server';

import {
  historyTimestamp,
  mergeStaffTimetableSessions,
} from './domain';
import type {
  StaffHistoryItem,
  StaffPublishedTimetable,
  StaffTimetableSession,
} from './types';

type UnknownRow =
  Record<string, unknown>;

function asString(
  value: unknown,
): string | null {
  return typeof value ===
    'string'
    ? value
    : null;
}

function asNumber(
  value: unknown,
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
  ) {
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

  return null;
}

async function untypedClient():
Promise<SupabaseClient> {
  return (
    await createClient()
  ) as unknown as
    SupabaseClient;
}

async function lookupRows(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
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
  } = await supabase
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

function mapById(
  rows: UnknownRow[],
): Map<string, UnknownRow> {
  const output =
    new Map<
      string,
      UnknownRow
    >();

  for (
    const row of
      rows
  ) {
    const id =
      asString(
        row.id,
      );

    if (id) {
      output.set(
        id,
        row,
      );
    }
  }

  return output;
}

function labelFrom(
  row: UnknownRow | undefined,
  fallback: string,
): string {
  if (!row) {
    return fallback;
  }

  return (
    asString(
      row.name,
    ) ??
    asString(
      row.code,
    ) ??
    fallback
  );
}

export async function getStaffPublishedTimetable(
  profileId: string,
): Promise<StaffPublishedTimetable> {
  const workspace =
    await getStaffWorkspace(
      profileId,
    );

  const supabase =
    await untypedClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      'scheduled_sessions',
    )
    .select(
      '*',
    )
    .eq(
      'trainer_id',
      workspace.trainerId,
    )
    .eq(
      'status',
      'locked',
    );

  if (error) {
    throw new Error(
      `Unable to load your published timetable: ${error.message}`,
    );
  }

  const rows =
    (
      data ??
      []
    ) as UnknownRow[];

  if (
    rows.length ===
    0
  ) {
    return {
      trainerId:
        workspace.trainerId,
      trainerName:
        workspace.trainerName,
      sessions:
        [],
    };
  }

  const periodIds =
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
      );

  const dayIds =
    rows
      .map(
        (row) =>
          asString(
            row.working_day_id,
          ),
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      );

  const slotIds =
    rows
      .flatMap(
        (row) => [
          asString(
            row.start_time_slot_id,
          ),
          asString(
            row.end_time_slot_id,
          ),
        ],
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      );

  const unitIds =
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
      );

  const cohortIds =
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
      );

  const roomIds =
    rows
      .map(
        (row) =>
          asString(
            row.room_id,
          ),
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      );

  const [
    periods,
    days,
    slots,
    units,
    cohorts,
    rooms,
  ] =
    await Promise.all([
      lookupRows(
        supabase,
        'academic_periods',
        periodIds,
      ),
      lookupRows(
        supabase,
        'working_days',
        dayIds,
      ),
      lookupRows(
        supabase,
        'time_slots',
        slotIds,
      ),
      lookupRows(
        supabase,
        'units',
        unitIds,
      ),
      lookupRows(
        supabase,
        'cohorts',
        cohortIds,
      ),
      lookupRows(
        supabase,
        'rooms',
        roomIds,
      ),
    ]);

  const periodById =
    mapById(
      periods,
    );

  const dayById =
    mapById(
      days,
    );

  const slotById =
    mapById(
      slots,
    );

  const unitById =
    mapById(
      units,
    );

  const cohortById =
    mapById(
      cohorts,
    );

  const roomById =
    mapById(
      rooms,
    );

  const mapped:
    StaffTimetableSession[] =
      [];

  for (
    const row of
      rows
  ) {
    const id =
      asString(
        row.id,
      );

    const periodId =
      asString(
        row.academic_period_id,
      );

    const dayId =
      asString(
        row.working_day_id,
      );

    const startSlotId =
      asString(
        row.start_time_slot_id,
      );

    const endSlotId =
      asString(
        row.end_time_slot_id,
      );

    const unitId =
      asString(
        row.unit_id,
      );

    const cohortId =
      asString(
        row.cohort_id,
      );

    if (
      !id ||
      !periodId ||
      !dayId ||
      !startSlotId ||
      !endSlotId ||
      !unitId ||
      !cohortId
    ) {
      continue;
    }

    const period =
      periodById.get(
        periodId,
      );

    const day =
      dayById.get(
        dayId,
      );

    const startSlot =
      slotById.get(
        startSlotId,
      );

    const endSlot =
      slotById.get(
        endSlotId,
      );

    const unit =
      unitById.get(
        unitId,
      );

    const cohort =
      cohortById.get(
        cohortId,
      );

    const roomId =
      asString(
        row.room_id,
      );

    const room =
      roomId
        ? roomById.get(
            roomId,
          )
        : undefined;

    mapped.push({
      id,
      academicPeriodId:
        periodId,
      academicPeriodName:
        labelFrom(
          period,
          'Academic Period',
        ),
      academicPeriodCode:
        period
          ? asString(
              period.code,
            )
          : null,
      dayName:
        day
          ? asString(
              day.day_of_week,
            ) ??
            labelFrom(
              day,
              'Day',
            )
          : 'Day',
      daySequence:
        asNumber(
          day
            ?.sequence_number,
        ) ??
        999,
      startSequence:
        asNumber(
          startSlot
            ?.sequence_number,
        ) ??
        999,
      startsAt:
        asString(
          startSlot
            ?.starts_at,
        ) ??
        '',
      endsAt:
        asString(
          endSlot
            ?.ends_at,
        ) ??
        asString(
          startSlot
            ?.ends_at,
        ) ??
        '',
      unitId,
      unitName:
        labelFrom(
          unit,
          'Unit',
        ),
      cohortNames: [
        labelFrom(
          cohort,
          'Cohort',
        ),
      ],
      roomLabel:
        room
          ? labelFrom(
              room,
              'Room',
            )
          : 'Unallocated',
      deliveryMode:
        asString(
          row.delivery_mode,
        ) ??
        'teaching',
      sessionNumbers: [
        asNumber(
          row.session_number,
        ) ??
        1,
      ],
    });
  }

  return {
    trainerId:
      workspace.trainerId,
    trainerName:
      workspace.trainerName,
    sessions:
      mergeStaffTimetableSessions(
        mapped,
      ),
  };
}

function titleCase(
  value: string,
): string {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export async function getStaffHistory(
  profileId: string,
): Promise<StaffHistoryItem[]> {
  const workspace =
    await getStaffWorkspace(
      profileId,
    );

  const supabase =
    await untypedClient();

  const allocationIds =
    workspace.allocations.map(
      (allocation) =>
        allocation.allocationId,
    );

  const [
    generationResult,
    importResult,
    documentResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'assessment_markbook_generations',
        )
        .select(
          '*',
        )
        .limit(
          100,
        ),

      supabase
        .from(
          'assessment_markbook_import_batches',
        )
        .select(
          '*',
        )
        .limit(
          100,
        ),

      allocationIds.length >
      0
        ? supabase
            .from(
              'teaching_documents',
            )
            .select(
              '*',
            )
            .in(
              'allocation_id',
              allocationIds,
            )
            .limit(
              100,
            )
        : Promise.resolve({
            data:
              [],
            error:
              null,
          }),
    ]);

  const error =
    generationResult.error ??
    importResult.error ??
    documentResult.error;

  if (error) {
    throw new Error(
      `Unable to load staff history: ${error.message}`,
    );
  }

  const items:
    StaffHistoryItem[] =
      [];

  for (
    const raw of
      (
        generationResult.data ??
        []
      ) as UnknownRow[]
  ) {
    const id =
      asString(
        raw.id,
      );

    if (!id) {
      continue;
    }

    const type =
      asString(
        raw.assessment_type,
      ) ??
      'assessment';

    items.push({
      id:
        `markbook:${id}`,
      kind:
        'markbook',
      title:
        `${type.toUpperCase()} markbook`,
      detail:
        asString(
          raw.filename,
        ) ??
        'Markbook',
      status:
        'Generated',
      occurredAt:
        asString(
          raw.generated_at,
        ) ??
        asString(
          raw.created_at,
        ),
    });
  }

  for (
    const raw of
      (
        importResult.data ??
        []
      ) as UnknownRow[]
  ) {
    const id =
      asString(
        raw.id,
      );

    if (!id) {
      continue;
    }

    const type =
      asString(
        raw.assessment_type,
      ) ??
      'assessment';

    const status =
      asString(
        raw.status,
      ) ??
      'ready';

    items.push({
      id:
        `import:${id}`,
      kind:
        'marks_import',
      title:
        `${type.toUpperCase()} marks`,
      detail:
        asString(
          raw.source_filename,
        ) ??
        'Workbook import',
      status:
        titleCase(
          status,
        ),
      occurredAt:
        asString(
          raw.committed_at,
        ) ??
        asString(
          raw.created_at,
        ) ??
        asString(
          raw.updated_at,
        ),
    });
  }

  for (
    const raw of
      (
        documentResult.data ??
        []
      ) as UnknownRow[]
  ) {
    const id =
      asString(
        raw.id,
      );

    const documentType =
      asString(
        raw.document_type,
      );

    if (
      !id ||
      !documentType
    ) {
      continue;
    }

    const version =
      asNumber(
        raw.version_number,
      ) ??
      1;

    const status =
      asString(
        raw.status,
      ) ??
      'draft';

    items.push({
      id:
        `document:${id}`,
      kind:
        'teaching_document',
      title:
        teachingDocumentLabel(
          documentType as
            TeachingDocumentType,
        ),
      detail:
        `Version ${version}`,
      status:
        titleCase(
          status,
        ),
      occurredAt:
        asString(
          raw.updated_at,
        ) ??
        asString(
          raw.created_at,
        ),
    });
  }

  return items.sort(
    (
      left,
      right,
    ) =>
      historyTimestamp(
        right.occurredAt,
      ) -
      historyTimestamp(
        left.occurredAt,
      ),
  );
}
