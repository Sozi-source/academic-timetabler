import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  AttendanceOversightItem,
  DepartmentAttendanceOverview,
  OperationsAuditItem,
  OperationsReadiness,
  OperationsSnapshot,
} from './types';

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
): number {
  const number =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}

function objectValue(
  value:
    unknown,
): Record<string, unknown> {
  return value &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value,
    )
    ? value as
        Record<string, unknown>
    : {};
}


async function client():
Promise<SupabaseClient> {
  return (
    await createClient()
  ) as unknown as
    SupabaseClient;
}

export async function getOperationsSnapshot():
Promise<OperationsSnapshot> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_operations_snapshot',
    );

  if (error) {
    throw new Error(
      `Unable to load operations snapshot: ${error.message}`,
    );
  }

  const root =
    objectValue(
      data,
    );

  const students =
    objectValue(
      root.students,
    );

  const timetable =
    objectValue(
      root.timetable,
    );

  const assessment =
    objectValue(
      root.assessment,
    );

  const documents =
    objectValue(
      root.documents,
    );

  const attendance =
    objectValue(
      root.attendance,
    );

  return {
    activePeriodId:
      asString(
        root.activePeriodId,
      ),
    activePeriodName:
      asString(
        root.activePeriodName,
      ),

    students: {
      eligible:
        asNumber(
          students.eligible,
        ),
      portalIssued:
        asNumber(
          students.portalIssued,
        ),
      portalActive:
        asNumber(
          students.portalActive,
        ),
      registered:
        asNumber(
          students.registered,
        ),
      unregistered:
        asNumber(
          students.unregistered,
        ),
    },

    timetable: {
      activeAllocations:
        asNumber(
          timetable.activeAllocations,
        ),
      publishedSessions:
        asNumber(
          timetable.publishedSessions,
        ),
    },

    assessment: {
      total:
        asNumber(
          assessment.total,
        ),
      submitted:
        asNumber(
          assessment.submitted,
        ),
      finalised:
        asNumber(
          assessment.finalised,
        ),
      published:
        asNumber(
          assessment.published,
        ),
    },

    documents: {
      activeTemplates:
        asNumber(
          documents.activeTemplates,
        ),
      inProgress:
        asNumber(
          documents.inProgress,
        ),
      submitted:
        asNumber(
          documents.submitted,
        ),
      returned:
        asNumber(
          documents.returned,
        ),
      approved:
        asNumber(
          documents.approved,
        ),
    },

    attendance: {
      open:
        asNumber(
          attendance.open,
        ),
      completed:
        asNumber(
          attendance.completed,
        ),
    },
  };
}

export async function getDepartmentAttendanceOverview(
  limit =
    100,
): Promise<DepartmentAttendanceOverview[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_class_attendance_overview',
      {
        target_limit:
          limit,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load class attendance oversight: ${error.message}`,
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
      ): DepartmentAttendanceOverview | null => {
        const classSessionId =
          asString(
            row.class_session_id,
          );

        const teachingAllocationId =
          asString(
            row.teaching_allocation_id,
          );

        const sessionDate =
          asString(
            row.session_date,
          );

        const status =
          asString(
            row.session_status,
          );

        if (
          !classSessionId ||
          !teachingAllocationId ||
          !sessionDate ||
          (
            status !==
              'open' &&
            status !==
              'completed'
          )
        ) {
          return null;
        }

        return {
          classSessionId,
          teachingAllocationId,
          sessionDate,
          sessionStatus:
            status,
          academicPeriodName:
            asString(
              row.academic_period_name,
            ) ??
            'Academic Period',
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
          trainerName:
            asString(
              row.trainer_name,
            ) ??
            'Trainer',
          startsAt:
            asString(
              row.starts_at,
            ) ??
            '',
          endsAt:
            asString(
              row.ends_at,
            ) ??
            '',
          rosterCount:
            asNumber(
              row.roster_count,
            ),
          presentCount:
            asNumber(
              row.present_count,
            ),
          absentCount:
            asNumber(
              row.absent_count,
            ),
          unmarkedCount:
            asNumber(
              row.unmarked_count,
            ),
          openedAt:
            asString(
              row.opened_at,
            ) ??
            '',
          completedAt:
            asString(
              row.completed_at,
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        DepartmentAttendanceOverview =>
        Boolean(
          item,
        ),
    );
}

export async function getOperationsAudit(
  limit =
    100,
): Promise<OperationsAuditItem[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_operations_audit',
      {
        target_limit:
          limit,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load operations audit: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as UnknownRow[]
  ).map(
    (row) => ({
      occurredAt:
        asString(
          row.occurred_at,
        ) ??
        '',
      area:
        asString(
          row.area,
        ) ??
        'Operations',
      eventType:
        asString(
          row.event_type,
        ) ??
        'event',
      subject:
        asString(
          row.subject,
        ) ??
        '',
      actorName:
        asString(
          row.actor_name,
        ) ??
        'System',
      detail:
        asString(
          row.detail,
        ),
    }),
  );
}

export async function getOperationsReadiness():
Promise<OperationsReadiness> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_release_readiness',
    );

  if (error) {
    throw new Error(
      `Unable to load operations readiness: ${error.message}`,
    );
  }

  const row =
    (
      data ??
      {}
    ) as Record<
      string,
      unknown
    >;

  const students =
    (
      row.students ??
      {}
    ) as Record<
      string,
      unknown
    >;

  const attendance =
    (
      row.attendance ??
      {}
    ) as Record<
      string,
      unknown
    >;

  const documents =
    (
      row.documents ??
      {}
    ) as Record<
      string,
      unknown
    >;

  const assessments =
    (
      row.assessments ??
      {}
    ) as Record<
      string,
      unknown
    >;

  return {
    activePeriodId:
      asString(
        row.activePeriodId,
      ),
    students: {
      eligible:
        asNumber(
          students.eligible,
        ),
      accessIssued:
        asNumber(
          students.accessIssued,
        ),
      accessActive:
        asNumber(
          students.accessActive,
        ),
      accessMissing:
        asNumber(
          students.accessMissing,
        ),
    },
    attendance: {
      open:
        asNumber(
          attendance.open,
        ),
      completed:
        asNumber(
          attendance.completed,
        ),
      incomplete:
        asNumber(
          attendance.incomplete,
        ),
    },
    documents: {
      awaitingReview:
        asNumber(
          documents.awaitingReview,
        ),
      returned:
        asNumber(
          documents.returned,
        ),
      approvedUnpublished:
        asNumber(
          documents.approvedUnpublished,
        ),
      studentPublished:
        asNumber(
          documents.studentPublished,
        ),
    },
    assessments: {
      total:
        asNumber(
          assessments.total,
        ),
      submitted:
        asNumber(
          assessments.submitted,
        ),
      finalised:
        asNumber(
          assessments.finalised,
        ),
      finalisedUnpublished:
        asNumber(
          assessments.finalisedUnpublished,
        ),
    },
  };
}

export async function getAttendanceOversight(
  limit =
    100,
): Promise<AttendanceOversightItem[]> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_class_attendance_oversight',
      {
        target_limit:
          limit,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load attendance oversight: ${error.message}`,
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
      ): AttendanceOversightItem | null => {
        const classSessionId =
          asString(
            row.class_session_id,
          );

        const sessionDate =
          asString(
            row.session_date,
          );

        const sessionStatus =
          asString(
            row.session_status,
          ) as
            | 'open'
            | 'completed'
            | null;

        if (
          !classSessionId ||
          !sessionDate ||
          !sessionStatus
        ) {
          return null;
        }

        return {
          classSessionId,
          sessionDate,
          sessionStatus,
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
          trainerName:
            asString(
              row.trainer_name,
            ) ??
            'Trainer',
          startsAt:
            asString(
              row.starts_at,
            ) ??
            '',
          endsAt:
            asString(
              row.ends_at,
            ) ??
            '',
          rosterCount:
            asNumber(
              row.roster_count,
            ),
          presentCount:
            asNumber(
              row.present_count,
            ),
          absentCount:
            asNumber(
              row.absent_count,
            ),
          unmarkedCount:
            asNumber(
              row.unmarked_count,
            ),
          completedAt:
            asString(
              row.completed_at,
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        AttendanceOversightItem =>
        Boolean(
          item,
        ),
    );
}
