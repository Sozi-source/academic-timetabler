import 'server-only';

import type {
  SupabaseClient,
} from '@supabase/supabase-js';

import {
  createClient,
} from '@/lib/supabase/server';

import type {
  TestingSnapshot,
} from './types';

function numberValue(
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

function objectValue(
  value:
    unknown,
): Record<string, unknown> {
  return (
    value &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value,
    )
  )
    ? value as
        Record<string, unknown>
    : {};
}

export async function getDepartmentTestingSnapshot():
Promise<TestingSnapshot> {
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
      'get_department_testing_snapshot',
    );

  if (error) {
    throw new Error(
      `Unable to load testing snapshot: ${error.message}`,
    );
  }

  const root =
    objectValue(
      data,
    );

  const activePeriod =
    root.activePeriod &&
    typeof root.activePeriod ===
      'object' &&
    !Array.isArray(
      root.activePeriod,
    )
      ? root.activePeriod as
          Record<
            string,
            unknown
          >
      : null;

  const students =
    objectValue(
      root.students,
    );

  const studentPortal =
    objectValue(
      root.studentPortal,
    );

  const timetable =
    objectValue(
      root.timetable,
    );

  const assessments =
    objectValue(
      root.assessments,
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
    departmentId:
      typeof root.departmentId ===
        'string'
        ? root.departmentId
        : '',
    activePeriod:
      activePeriod &&
      typeof activePeriod.id ===
        'string' &&
      typeof activePeriod.name ===
        'string'
        ? {
            id:
              activePeriod.id,
            name:
              activePeriod.name,
          }
        : null,
    students: {
      total:
        numberValue(
          students.total,
        ),
      active:
        numberValue(
          students.active,
        ),
    },
    studentPortal: {
      issued:
        numberValue(
          studentPortal.issued,
        ),
      active:
        numberValue(
          studentPortal.active,
        ),
    },
    timetable: {
      allocations:
        numberValue(
          timetable.allocations,
        ),
      publishedSessions:
        numberValue(
          timetable.publishedSessions,
        ),
    },
    assessments: {
      total:
        numberValue(
          assessments.total,
        ),
      published:
        numberValue(
          assessments.published,
        ),
    },
    documents: {
      activeTemplates:
        numberValue(
          documents.activeTemplates,
        ),
      total:
        numberValue(
          documents.total,
        ),
      submitted:
        numberValue(
          documents.submitted,
        ),
      approved:
        numberValue(
          documents.approved,
        ),
      studentVisible:
        numberValue(
          documents.studentVisible,
        ),
      studentDownloads:
        numberValue(
          documents.studentDownloads,
        ),
    },
    attendance: {
      sessions:
        numberValue(
          attendance.sessions,
        ),
      open:
        numberValue(
          attendance.open,
        ),
      completed:
        numberValue(
          attendance.completed,
        ),
    },
  };
}
