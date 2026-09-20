import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  ClassAttendanceStatus,
  ClassSessionStatus,
} from './types';
import type {
  DepartmentAttendanceSession,
  DepartmentAttendanceWorkspace,
  HodClassAttendanceItem,
  HodClassAttendanceWorkspace,
} from './admin-types';

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

async function client():
Promise<SupabaseClient> {
  return (
    await createClient()
  ) as unknown as
    SupabaseClient;
}

export interface AttendanceFilters {
  academicPeriodName?: string;
  unitName?: string;
  cohortName?: string;
  trainerName?: string;
  sessionDate?: string;
  status?: ClassSessionStatus;
  limit?: number;
}

export async function getDepartmentAttendanceSessions(
  filters: AttendanceFilters = {}
): Promise<DepartmentAttendanceSession[]> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_class_attendance_overview',
      {
        target_limit:
          filters.limit ?? 100,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load department attendance: ${error.message}`,
    );
  }

  let results = (
    (
      data ??
      []
    ) as UnknownRow[]
  )
    .map(
      (
        row,
      ): DepartmentAttendanceSession | null => {
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

        const sessionStatus =
          asString(
            row.session_status,
          ) as
            | ClassSessionStatus
            | null;

        if (
          !classSessionId ||
          !teachingAllocationId ||
          !sessionDate ||
          !sessionStatus
        ) {
          return null;
        }

        return {
          classSessionId,
          teachingAllocationId,
          sessionDate,
          sessionStatus,
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
          cohortNames:
            asString(
              row.cohort_name ?? row.cohort_names,
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
          studentCount:
            asNumber(
              row.roster_count ?? row.student_count,
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
        };
      },
    )
    .filter(
      (
        row,
      ): row is
        DepartmentAttendanceSession =>
        Boolean(
          row,
        ),
    );

  if (filters.academicPeriodName) {
    const q = filters.academicPeriodName.toLowerCase();
    results = results.filter((r) => r.academicPeriodName.toLowerCase().includes(q));
  }

  if (filters.unitName) {
    const q = filters.unitName.toLowerCase();
    results = results.filter((r) => r.unitName.toLowerCase().includes(q));
  }

  if (filters.cohortName) {
    const q = filters.cohortName.toLowerCase();
    results = results.filter((r) => r.cohortNames.toLowerCase().includes(q));
  }

  if (filters.trainerName) {
    const q = filters.trainerName.toLowerCase();
    results = results.filter((r) => r.trainerName.toLowerCase().includes(q));
  }

  if (filters.sessionDate) {
    results = results.filter((r) => r.sessionDate === filters.sessionDate);
  }

  if (filters.status) {
    results = results.filter((r) => r.sessionStatus === filters.status);
  }

  return results;
}

export async function getDepartmentAttendanceWorkspace(
  classSessionId:
    string,
): Promise<DepartmentAttendanceWorkspace | null> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_department_class_attendance_workspace',
      {
        target_class_session_id:
          classSessionId,
      },
    );

  if (error) {
    if (
      error.code ===
        'P0002' ||
      error.code ===
        '42501'
    ) {
      return null;
    }

    throw new Error(
      `Unable to load attendance session: ${error.message}`,
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
    return null;
  }

  const first =
    rows[0];

  const sessionDate =
    asString(
      first.session_date,
    );

  const sessionStatus =
    asString(
      first.session_status,
    ) as
      | ClassSessionStatus
      | null;

  if (
    !sessionDate ||
    !sessionStatus
  ) {
    return null;
  }

  return {
    classSessionId,
    sessionDate,
    sessionStatus,
    academicPeriodName:
      asString(
        first.academic_period_name,
      ) ??
      'Academic Period',
    unitName:
      asString(
        first.unit_name,
      ) ??
      'Unit',
    cohortNames:
      asString(
        first.cohort_names,
      ) ??
      'Cohort',
    trainerName:
      asString(
        first.trainer_name,
      ) ??
      'Trainer',
    startsAt:
      asString(
        first.starts_at,
      ) ??
      '',
    endsAt:
      asString(
        first.ends_at,
      ) ??
      '',
    students:
      rows
        .map(
          (row) => {
            const studentId =
              asString(
                row.student_id,
              );

            if (!studentId) {
              return null;
            }

            return {
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
              cohortName:
                asString(
                  row.cohort_name,
                ) ??
                'Cohort',
              attendanceStatus:
                (
                  asString(
                    row.attendance_status,
                  ) ??
                  'unmarked'
                ) as
                  ClassAttendanceStatus,
              note:
                asString(
                  row.note,
                ),
            };
          },
        )
        .filter(
          (
            row,
          ): row is
            NonNullable<
              typeof row
            > =>
            Boolean(
              row,
            ),
        ),
  };
}

export async function getHodClassAttendanceOverview():
Promise<HodClassAttendanceItem[]> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_hod_class_attendance_overview',
      {
        target_start_date:
          null,
        target_end_date:
          null,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load department attendance: ${error.message}`,
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
      ): HodClassAttendanceItem | null => {
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
            row.status,
          ) as
            | ClassSessionStatus
            | null;

        if (
          !classSessionId ||
          !teachingAllocationId ||
          !sessionDate ||
          !status
        ) {
          return null;
        }

        return {
          classSessionId,
          teachingAllocationId,
          sessionDate,
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
          completedAt:
            asString(
              row.completed_at,
            ),
          reopenedAt:
            asString(
              row.reopened_at,
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        HodClassAttendanceItem =>
        Boolean(
          item,
        ),
    );
}

export async function getHodClassAttendanceWorkspace(
  classSessionId:
    string,
): Promise<HodClassAttendanceWorkspace | null> {
  const supabase =
    await client();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_hod_class_attendance_workspace',
      {
        target_class_session_id:
          classSessionId,
      },
    );

  if (error) {
    if (
      error.code ===
        '42501' ||
      error.code ===
        'P0002'
    ) {
      return null;
    }

    throw new Error(
      `Unable to load attendance session: ${error.message}`,
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
    return null;
  }

  const first =
    rows[0];

  const teachingAllocationId =
    asString(
      first.teaching_allocation_id,
    );

  const sessionDate =
    asString(
      first.session_date,
    );

  const sessionStatus =
    asString(
      first.session_status,
    ) as
      | ClassSessionStatus
      | null;

  if (
    !teachingAllocationId ||
    !sessionDate ||
    !sessionStatus
  ) {
    return null;
  }

  return {
    classSessionId,
    teachingAllocationId,
    sessionDate,
    sessionStatus,
    academicPeriodName:
      asString(
        first.academic_period_name,
      ) ??
      'Academic Period',
    unitName:
      asString(
        first.unit_name,
      ) ??
        'Unit',
    cohortName:
      asString(
        first.cohort_name,
      ) ??
      'Cohort',
    trainerName:
      asString(
        first.trainer_name,
      ) ??
      'Trainer',
    startsAt:
      asString(
        first.starts_at,
      ) ??
      '',
    endsAt:
      asString(
        first.ends_at,
      ) ??
      '',
    rosterCount:
      asNumber(
        first.roster_count,
      ),
    students:
      rows
        .map(
          (row) => {
            const studentId =
              asString(
                row.student_id,
              );

            if (!studentId) {
              return null;
            }

            return {
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
              attendanceStatus:
                (
                  asString(
                    row.attendance_status,
                  ) ??
                  'unmarked'
                ) as
                  ClassAttendanceStatus,
              note:
                asString(
                  row.note,
                ),
            };
          },
        )
        .filter(
          (
            student,
          ): student is
            NonNullable<
              typeof student
            > =>
            Boolean(
              student,
            ),
        ),
  };
}
