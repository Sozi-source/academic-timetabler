import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  studentPortalAccessStatus,
  studentPortalAccessStatusLabel,
  studentPortalAccessSummary,
} from '@/features/student-access/domain';
import type {
  StudentPortalAccessRow,
} from '@/features/student-access/types';

function row(
  overrides:
    Partial<StudentPortalAccessRow> = {},
): StudentPortalAccessRow {
  return {
    studentId:
      'student-1',
    admissionNumber:
      'ADM/001',
    fullName:
      'Student One',
    programmeCode:
      'DND',
    cohortName:
      'DND SEP 26',
    lifecycleStatus:
      'active',
    hasCredential:
      true,
    isActive:
      true,
    issuedAt:
      '2026-08-21T10:00:00.000Z',
    lastLoginAt:
      null,
    failedLoginAttempts:
      0,
    lockedUntil:
      null,
    ...overrides,
  };
}

describe('student portal access domain', () => {
  it('keeps unissued, disabled and active states distinct', () => {
    expect(
      studentPortalAccessStatus(
        row({
          hasCredential:
            false,
          isActive:
            false,
        }),
      ),
    ).toBe(
      'not_issued',
    );

    expect(
      studentPortalAccessStatus(
        row({
          isActive:
            false,
        }),
      ),
    ).toBe(
      'disabled',
    );

    expect(
      studentPortalAccessStatus(
        row(),
      ),
    ).toBe(
      'active',
    );
  });

  it('shows a future temporary login lock separately from disabled access', () => {
    const now =
      new Date(
        '2026-08-21T12:00:00.000Z',
      );

    expect(
      studentPortalAccessStatus(
        row({
          lockedUntil:
            '2026-08-21T12:15:00.000Z',
        }),
        now,
      ),
    ).toBe(
      'locked',
    );

    expect(
      studentPortalAccessStatusLabel(
        'locked',
      ),
    ).toBe(
      'Locked',
    );
  });

  it('does not keep an expired temporary lock visible', () => {
    expect(
      studentPortalAccessStatus(
        row({
          lockedUntil:
            '2026-08-21T11:45:00.000Z',
        }),
        new Date(
          '2026-08-21T12:00:00.000Z',
        ),
      ),
    ).toBe(
      'active',
    );
  });

  it('summarises access coverage without exposing PIN values', () => {
    const summary =
      studentPortalAccessSummary(
        [
          row(),
          row({
            studentId:
              'student-2',
            hasCredential:
              false,
            isActive:
              false,
          }),
          row({
            studentId:
              'student-3',
            isActive:
              false,
          }),
        ],
        new Date(
          '2026-08-21T12:00:00.000Z',
        ),
      );

    expect(
      summary,
    ).toMatchObject({
      eligible:
        3,
      issued:
        2,
      active:
        1,
      notIssued:
        1,
      disabled:
        1,
      neverSignedIn:
        2,
    });
  });
});
