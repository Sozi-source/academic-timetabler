import 'server-only';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  ClassAttendanceHistoryItem,
  ClassAttendanceScheduleItem,
  ClassAttendanceStatus,
  ClassAttendanceWorkspace,
  ClassSessionStatus,
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
  const result =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}

export async function getStaffClassAttendanceSchedule():
Promise<ClassAttendanceScheduleItem[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_staff_class_attendance_schedule',
    );

  if (error) {
    throw new Error(
      `Unable to load attendance schedule: ${error.message}`,
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
      ): ClassAttendanceScheduleItem | null => {
        const scheduledSessionId =
          asString(
            row.scheduled_session_id,
          );

        const teachingAllocationId =
          asString(
            row.teaching_allocation_id,
          );

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

        if (
          !scheduledSessionId ||
          !teachingAllocationId ||
          !academicPeriodId ||
          !cohortId ||
          !unitId
        ) {
          return null;
        }

        return {
          scheduledSessionId,
          teachingAllocationId,
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
          dayOfWeek:
            asString(
              row.day_of_week,
            ) ??
            '',
          daySequence:
            asNumber(
              row.day_sequence,
            ),
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
          sessionNumber:
            asNumber(
              row.session_number,
            ),
          teachingStartsOn:
            asString(
              row.teaching_starts_on,
            ) ??
            '',
          teachingEndsOn:
            asString(
              row.teaching_ends_on,
            ) ??
            '',
          latestClassSessionId:
            asString(
              row.latest_class_session_id,
            ),
          latestSessionDate:
            asString(
              row.latest_session_date,
            ),
          latestStatus:
            asString(
              row.latest_status,
            ) as
              | ClassSessionStatus
              | null,
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        ClassAttendanceScheduleItem =>
        Boolean(
          item,
        ),
    );
}

export async function getStaffClassAttendanceHistory(
  limit =
    30,
): Promise<ClassAttendanceHistoryItem[]> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_staff_class_attendance_history',
      {
        target_limit:
          limit,
      },
    );

  if (error) {
    throw new Error(
      `Unable to load attendance history: ${error.message}`,
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
      ): ClassAttendanceHistoryItem | null => {
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
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        ClassAttendanceHistoryItem =>
        Boolean(
          item,
        ),
    );
}

export async function getClassAttendanceWorkspace(
  classSessionId:
    string,
): Promise<ClassAttendanceWorkspace | null> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_class_attendance_workspace',
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
      `Unable to load class attendance: ${error.message}`,
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

  const scheduledSessionId =
    asString(
      first.scheduled_session_id,
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
    !scheduledSessionId ||
    !sessionDate ||
    !sessionStatus
  ) {
    return null;
  }

  return {
    classSessionId,
    teachingAllocationId,
    scheduledSessionId,
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
