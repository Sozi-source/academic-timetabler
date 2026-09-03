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
import { createAdminClient } from '@/lib/supabase/admin';

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

function timetableClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
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

  // The caller is already authenticated as a trainer and getStaffWorkspace()
  // has resolved that account to one trainer ID. The department-scoped RLS
  // policies intentionally do not expose timetable snapshots to trainers, so
  // this server-only query reads with the service role and filters by that ID.
  const supabase = timetableClient();

  const { data: publishedVersions, error: versionError } = await supabase
    .from('timetable_versions')
    .select('academic_period_id, snapshot, status')
    .eq('status', 'published')
    .order('version_number', { ascending: false });

  if (versionError) {
    throw new Error(`Unable to load published timetables: ${versionError.message}`);
  }

  // Trainers can see published schedules only. A live-session fallback below
  // is constrained to the same published academic periods.
  if (publishedVersions && publishedVersions.length > 0) {
    const periodIds = Array.from(
      new Set(publishedVersions.map((v) => String(v.academic_period_id))),
    );

    const { data: periods } = await supabase
      .from('academic_periods')
      .select('id, name, code')
      .in('id', periodIds);

    const periodMap = new Map<string, { name: string; code: string | null }>();
    if (periods) {
      for (const p of periods) {
        periodMap.set(String(p.id), {
          name: String(p.name),
          code: p.code ? String(p.code) : null,
        });
      }
    }

    const { data: slotsData } = await supabase
      .from('time_slots')
      .select('starts_at, sequence_number, academic_period_id')
      .in('academic_period_id', periodIds);

    const slotSequenceMap = new Map<string, number>();
    if (slotsData) {
      for (const slot of slotsData) {
        if (slot.starts_at && slot.academic_period_id) {
          slotSequenceMap.set(
            String(slot.academic_period_id) + '_' + String(slot.starts_at),
            asNumber(slot.sequence_number) ?? 999,
          );
        }
      }
    }

    const sessions: any[] = [];
    for (const version of publishedVersions) {
      if (Array.isArray(version.snapshot)) {
        for (const session of version.snapshot) {
          session.academicPeriodId = String(version.academic_period_id);
          sessions.push(session);
        }
      }
    }

    const trainerIdStr = String(workspace.trainerId);
    const trainerSessions = sessions.filter(
      (session) => String(session.trainerId) === trainerIdStr,
    );

    if (trainerSessions.length > 0) {
      const mapped: StaffTimetableSession[] = [];
      for (const row of trainerSessions) {
        const id = asString(row.id);
        const periodId = asString(row.academicPeriodId);
        if (!id || !periodId) continue;

        const period = periodMap.get(periodId);
        const startsAt = asString(row.startTime) ?? '';
        const startSequence =
          slotSequenceMap.get(periodId + '_' + startsAt) ?? 999;

        mapped.push({
          id,
          academicPeriodId: periodId,
          academicPeriodName: period?.name ?? 'Academic Period',
          academicPeriodCode: period?.code ?? null,
          dayName: asString(row.day) ?? 'Day',
          daySequence: asNumber(row.daySequence) ?? 999,
          startSequence,
          startsAt,
          endsAt: asString(row.endTime) ?? '',
          unitId: asString(row.unitId) ?? '',
          unitName: asString(row.unitName) ?? 'Unit',
          cohortNames: [asString(row.cohortName) ?? 'Cohort'],
          roomLabel:
            asString(row.roomName) ??
            asString(row.roomCode) ??
            'Unallocated',
          deliveryMode: asString(row.deliveryMode) ?? 'teaching',
          sessionNumbers: [asNumber(row.sessionNumber) ?? 1],
        });
      }

      return {
        trainerId: workspace.trainerId,
        trainerName: workspace.trainerName,
        sessions: mergeStaffTimetableSessions(mapped),
      };
    }
  }

  if (!publishedVersions || publishedVersions.length === 0) {
    return {
      trainerId: workspace.trainerId,
      trainerName: workspace.trainerName,
      sessions: [],
    };
  }

  const publishedPeriodIds = [
    ...new Set(publishedVersions.map((version) => String(version.academic_period_id))),
  ];

  // A published version can predate a legitimate timetable repair. Fall back
  // to the trainer's live sessions, but never expose an unpublished period.
  const { data: liveScheduled, error: liveScheduleError } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      academic_period_id,
      session_number,
      academic_periods ( id, name, code ),
      working_days ( day_of_week, sequence_number ),
      start_time_slot:time_slots!scheduled_sessions_start_time_slot_id_fkey ( starts_at, ends_at, sequence_number ),
      end_time_slot:time_slots!scheduled_sessions_end_time_slot_id_fkey ( ends_at ),
      cohorts ( code, name ),
      units ( id, code, name ),
      rooms ( code, name )
    `)
    .eq('trainer_id', workspace.trainerId)
    .in('academic_period_id', publishedPeriodIds)
    .in('status', ['draft', 'confirmed', 'locked']);

  if (liveScheduleError) {
    throw new Error(`Unable to load the trainer timetable: ${liveScheduleError.message}`);
  }

  if (liveScheduled && liveScheduled.length > 0) {
    const mapped: StaffTimetableSession[] = [];
    for (const row of liveScheduled as any[]) {
      const period = Array.isArray(row.academic_periods) ? row.academic_periods[0] : row.academic_periods;
      const day = Array.isArray(row.working_days) ? row.working_days[0] : row.working_days;
      const startSlot = Array.isArray(row.start_time_slot) ? row.start_time_slot[0] : row.start_time_slot;
      const endSlot = Array.isArray(row.end_time_slot) ? row.end_time_slot[0] : row.end_time_slot;
      const unit = Array.isArray(row.units) ? row.units[0] : row.units;
      const cohort = Array.isArray(row.cohorts) ? row.cohorts[0] : row.cohorts;
      const room = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;

      mapped.push({
        id: row.id,
        academicPeriodId: row.academic_period_id,
        academicPeriodName: period?.name ?? 'Academic Period',
        academicPeriodCode: period?.code ?? null,
        dayName: day?.day_of_week ?? 'Monday',
        daySequence: Number(day?.sequence_number ?? 1),
        startSequence: Number(startSlot?.sequence_number ?? 1),
        startsAt: startSlot?.starts_at ?? '',
        endsAt: endSlot?.ends_at ?? startSlot?.ends_at ?? '',
        unitId: unit?.id ?? '',
        unitName: unit?.name ?? 'Unit',
        cohortNames: [cohort?.name ?? 'Cohort'],
        roomLabel: room?.name ?? room?.code ?? 'Room',
        deliveryMode: 'teaching',
        sessionNumbers: [Number(row.session_number ?? 1)],
      });
    }

    return {
      trainerId: workspace.trainerId,
      trainerName: workspace.trainerName,
      sessions: mergeStaffTimetableSessions(mapped),
    };
  }

  return {
    trainerId: workspace.trainerId,
    trainerName: workspace.trainerName,
    sessions: [],
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
    attendanceResult,
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

      allocationIds.length >
      0
        ? supabase
            .from(
              'class_sessions',
            )
            .select(
              '*',
            )
            .in(
              'teaching_allocation_id',
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
    documentResult.error ??
    attendanceResult.error;

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


  for (
    const raw of
      (
        attendanceResult.data ??
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

    const status =
      asString(
        raw.status,
      ) ??
      'open';

    const rosterCount =
      asNumber(
        raw.roster_count,
      ) ??
      0;

    items.push({
      id:
        `attendance:${id}`,
      kind:
        'attendance',
      title:
        'Class attendance',
      detail:
        `${asString(
          raw.session_date,
        ) ?? 'Class date'} · ${rosterCount} students`,
      status:
        titleCase(
          status,
        ),
      occurredAt:
        asString(
          raw.completed_at,
        ) ??
        asString(
          raw.updated_at,
        ) ??
        asString(
          raw.opened_at,
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
