import 'server-only';

import {
  createAdminClient,
} from '@/lib/supabase/admin';
import {
  createClient,
} from '@/lib/supabase/server';

import {
  attendanceRate,
} from './domain';
import type {
  DepartmentAttendanceAggregate,
  StudentAttendanceAggregate,
  StudentPortalAttendanceSession,
  StudentPortalAttendanceSnapshot,
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
): number {
  const parsed =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function nullableNumber(
  value: unknown,
): number | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null;
  }

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

export async function getDepartmentAttendanceAnalytics():
Promise<DepartmentAttendanceAggregate[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_attendance_analytics',
    );

  if (error) {
    throw new Error(
      `Unable to load attendance analytics: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as UnknownRow[]
  ).flatMap(
    (row) => {
      const academicPeriodId =
        asString(
          row.academic_period_id,
        );
      const cohortId =
        asString(
          row.cohort_id,
        );
      const unitId =
        asString(
          row.unit_id,
        );
      const trainerId =
        asString(
          row.trainer_id,
        );

      if (
        !academicPeriodId ||
        !cohortId ||
        !unitId ||
        !trainerId
      ) {
        return [];
      }

      return [
        {
          academicPeriodId,
          academicPeriodName:
            asString(
              row.academic_period_name,
            ) ??
            'Academic Period',
          cohortId,
          cohortName:
            asString(
              row.cohort_name,
            ) ??
            'Cohort',
          unitId,
          unitName:
            asString(
              row.unit_name,
            ) ??
            'Unit',
          trainerId,
          trainerName:
            asString(
              row.trainer_name,
            ) ??
            'Trainer',
          completedSessions:
            asNumber(
              row.completed_sessions,
            ),
          rosterOccurrences:
            asNumber(
              row.roster_occurrences,
            ),
          presentCount:
            asNumber(
              row.present_count,
            ),
          absentCount:
            asNumber(
              row.absent_count,
            ),
          attendanceRate:
            nullableNumber(
              row.attendance_rate,
            ),
        },
      ];
    },
  );
}

export async function getDepartmentStudentAttendanceAnalytics():
Promise<StudentAttendanceAggregate[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_student_attendance_analytics',
    );

  if (error) {
    throw new Error(
      `Unable to load student attendance analytics: ${error.message}`,
    );
  }

  return (
    (
      data ??
      []
    ) as UnknownRow[]
  ).flatMap(
    (row) => {
      const academicPeriodId =
        asString(
          row.academic_period_id,
        );
      const studentId =
        asString(
          row.student_id,
        );
      const cohortId =
        asString(
          row.cohort_id,
        );
      const unitId =
        asString(
          row.unit_id,
        );

      if (
        !academicPeriodId ||
        !studentId ||
        !cohortId ||
        !unitId
      ) {
        return [];
      }

      return [
        {
          academicPeriodId,
          academicPeriodName:
            asString(
              row.academic_period_name,
            ) ??
            'Academic Period',
          studentId,
          admissionNumber:
            asString(
              row.admission_number,
            ) ??
            '',
          fullName:
            asString(
              row.full_name,
            ) ??
            'Student',
          cohortId,
          cohortName:
            asString(
              row.cohort_name,
            ) ??
            'Cohort',
          unitId,
          unitName:
            asString(
              row.unit_name,
            ) ??
            'Unit',
          completedSessions:
            asNumber(
              row.completed_sessions,
            ),
          presentCount:
            asNumber(
              row.present_count,
            ),
          absentCount:
            asNumber(
              row.absent_count,
            ),
          attendanceRate:
            nullableNumber(
              row.attendance_rate,
            ),
        },
      ];
    },
  );
}

export async function getStudentPortalAttendance(
  studentId: string,
): Promise<StudentPortalAttendanceSnapshot> {
  const admin =
    createAdminClient();

  const {
    data: period,
    error: periodError,
  } =
    await admin
      .from(
        'academic_periods',
      )
      .select(
        'id, name',
      )
      .eq(
        'status',
        'active',
      )
      .order(
        'starts_on',
        {
          ascending:
            false,
        },
      )
      .limit(
        1,
      )
      .maybeSingle();

  if (periodError) {
    throw new Error(
      `Unable to load active academic period: ${periodError.message}`,
    );
  }

  if (!period) {
    return {
      periodName:
        null,
      completedSessions:
        0,
      presentCount:
        0,
      absentCount:
        0,
      attendanceRate:
        null,
      units:
        [],
      sessions:
        [],
    };
  }

  const {
    data: entries,
    error: entryError,
  } =
    await admin
      .from(
        'class_attendance_entries',
      )
      .select(
        'class_session_id, attendance_status',
      )
      .eq(
        'student_id',
        studentId,
      )
      .in(
        'attendance_status',
        [
          'present',
          'absent',
        ],
      );

  if (entryError) {
    throw new Error(
      `Unable to load student attendance: ${entryError.message}`,
    );
  }

  const entryRows =
    (
      entries ??
      []
    ) as UnknownRow[];

  const sessionIds =
    [
      ...new Set(
        entryRows
          .map(
            (row) =>
              asString(
                row.class_session_id,
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
    ];

  if (
    sessionIds.length ===
    0
  ) {
    return {
      periodName:
        period.name,
      completedSessions:
        0,
      presentCount:
        0,
      absentCount:
        0,
      attendanceRate:
        null,
      units:
        [],
      sessions:
        [],
    };
  }

  const {
    data: sessions,
    error: sessionError,
  } =
    await admin
      .from(
        'class_sessions',
      )
      .select(
        'id, academic_period_id, cohort_id, unit_id, session_date, starts_at, ends_at, status',
      )
      .in(
        'id',
        sessionIds,
      )
      .eq(
        'academic_period_id',
        period.id,
      )
      .in(
        'status',
        ['completed', 'open'],
      );

  if (sessionError) {
    throw new Error(
      `Unable to load completed attendance sessions: ${sessionError.message}`,
    );
  }

  const sessionRows =
    (
      sessions ??
      []
    ) as UnknownRow[];

  const completedIds =
    new Set(
      sessionRows
        .map(
          (row) =>
            asString(
              row.id,
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
    );

  const completedEntries =
    entryRows.filter(
      (entry) => {
        const id =
          asString(
            entry.class_session_id,
          );

        return Boolean(
          id &&
          completedIds.has(
            id,
          ),
        );
      },
    );

  const unitIds =
    [
      ...new Set(
        sessionRows
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
    ];

  const cohortIds =
    [
      ...new Set(
        sessionRows
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
    ];

  let unitRows:
    Array<{
      id:
        string;
      name:
        string;
    }> =
    [];

  if (
    unitIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          'units',
        )
        .select(
          'id, name',
        )
        .in(
          'id',
          unitIds,
        );

    if (error) {
      throw new Error(
        `Unable to resolve attendance units: ${error.message}`,
      );
    }

    unitRows =
      (
        data ??
        []
      ) as Array<{
        id:
          string;
        name:
          string;
      }>;
  }

  let cohortRows:
    Array<{
      id:
        string;
      name:
        string;
    }> =
    [];

  if (
    cohortIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          'cohorts',
        )
        .select(
          'id, name',
        )
        .in(
          'id',
          cohortIds,
        );

    if (error) {
      throw new Error(
        `Unable to resolve attendance cohorts: ${error.message}`,
      );
    }

    cohortRows =
      (
        data ??
        []
      ) as Array<{
        id:
          string;
        name:
          string;
      }>;
  }

  const unitById =
    new Map(
      unitRows.map(
        (row) => [
          row.id,
          row.name,
        ],
      ),
    );

  const cohortById =
    new Map(
      cohortRows.map(
        (row) => [
          row.id,
          row.name,
        ],
      ),
    );

  const entryBySession =
    new Map(
      completedEntries.map(
        (entry) => [
          asString(
            entry.class_session_id,
          ) ??
            '',
          asString(
            entry.attendance_status,
          ) as
            | 'present'
            | 'absent',
        ],
      ),
    );

  const mappedSessions:
    StudentPortalAttendanceSession[] =
    sessionRows.flatMap(
      (row) => {
        const id =
          asString(
            row.id,
          );
        const unitId =
          asString(
            row.unit_id,
          );
        const cohortId =
          asString(
            row.cohort_id,
          );
        const status =
          id
            ? entryBySession.get(
                id,
              )
            : undefined;

        if (
          !id ||
          !unitId ||
          !cohortId ||
          !status
        ) {
          return [];
        }

        return [
          {
            classSessionId:
              id,
            sessionDate:
              asString(
                row.session_date,
              ) ??
              '',
            unitId,
            unitName:
              unitById.get(
                unitId,
              ) ??
              'Unit',
            cohortName:
              cohortById.get(
                cohortId,
              ) ??
              'Cohort',
            academicPeriodName:
              period.name,
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
            status,
          },
        ];
      },
    )
      .sort(
        (
          left,
          right,
        ) =>
          right.sessionDate.localeCompare(
            left.sessionDate,
          ) ||
          left.unitName.localeCompare(
            right.unitName,
          ),
      );

  const unitMap =
    new Map<
      string,
      {
        unitId:
          string;
        unitName:
          string;
        completedSessions:
          number;
        presentCount:
          number;
        absentCount:
          number;
      }
    >();

  for (
    const session of
      mappedSessions
  ) {
    const current =
      unitMap.get(
        session.unitId,
      ) ??
      {
        unitId:
          session.unitId,
        unitName:
          session.unitName,
        completedSessions:
          0,
        presentCount:
          0,
        absentCount:
          0,
      };

    current.completedSessions +=
      1;

    if (
      session.status ===
      'present'
    ) {
      current.presentCount +=
        1;
    } else {
      current.absentCount +=
        1;
    }

    unitMap.set(
      session.unitId,
      current,
    );
  }

  const units =
    [
      ...unitMap.values(),
    ]
      .map(
        (unit) => ({
          ...unit,
          attendanceRate:
            attendanceRate({
              present:
                unit.presentCount,
              absent:
                unit.absentCount,
            }),
        }),
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.unitName.localeCompare(
            right.unitName,
          ),
      );

  const presentCount =
    mappedSessions.filter(
      (session) =>
        session.status ===
        'present',
    ).length;

  const absentCount =
    mappedSessions.length -
    presentCount;

  return {
    periodName:
      period.name,
    completedSessions:
      mappedSessions.length,
    presentCount,
    absentCount,
    attendanceRate:
      attendanceRate({
        present:
          presentCount,
        absent:
          absentCount,
      }),
    units,
    sessions:
      mappedSessions,
  };
}
