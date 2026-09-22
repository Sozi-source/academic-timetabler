import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  departmentAttendanceSummary,
  formatAttendanceRate,
} from '@/features/class-attendance/admin-domain';
import type {
  DepartmentAttendanceSession,
} from '@/features/class-attendance/admin-types';

function row(
  overrides:
    Partial<DepartmentAttendanceSession> = {},
): DepartmentAttendanceSession {
  return {
    classSessionId:
      'session-1',
    teachingAllocationId:
      'allocation-1',
    sessionDate:
      '2026-08-21',
    sessionStatus:
      'completed',
    academicPeriodName:
      'SEP-DEC 2026',
    unitName:
      'Nutrition Education',
    cohortNames:
      'DND SEP 26',
    trainerName:
      'Trainer One',
    startsAt:
      '08:00:00',
    endsAt:
      '10:00:00',
    studentCount:
      10,
    presentCount:
      8,
    absentCount:
      2,
    unmarkedCount:
      0,
    ...overrides,
  };
}

describe('department class attendance overview', () => {
  it('calculates attendance from marked present and absent records only', () => {
    const summary =
      departmentAttendanceSummary([
        row(),
        row({
          classSessionId:
            'session-2',
          sessionStatus:
            'open',
          presentCount:
            5,
          absentCount:
            0,
          unmarkedCount:
            5,
        }),
      ]);

    expect(
      summary,
    ).toMatchObject({
      sessions:
        2,
      completed:
        1,
      open:
        1,
      present:
        13,
      absent:
        2,
      unmarked:
        5,
    });

    expect(
      summary.attendanceRate,
    ).toBeCloseTo(
      86.6666667,
      5,
    );
  });

  it('does not invent an attendance rate when nothing has been marked', () => {
    const summary =
      departmentAttendanceSummary([
        row({
          presentCount:
            0,
          absentCount:
            0,
          unmarkedCount:
            10,
        }),
      ]);

    expect(
      summary.attendanceRate,
    ).toBeNull();

    expect(
      formatAttendanceRate(
        summary.attendanceRate,
      ),
    ).toBe(
      '—',
    );
  });

  it('formats department attendance rate consistently', () => {
    expect(
      formatAttendanceRate(
        92.347,
      ),
    ).toBe(
      '92.3%',
    );
  });
});
