import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  deriveStudentRegistrationState,
  formatPortalClock,
  studentRegistrationLabel,
  studentResultDisplay,
  studentStageLabel,
} from '@/features/student-portal/domain';
import type {
  StudentPortalUnit,
} from '@/features/student-portal/types';

function unit(
  registrationStatus:
    string,
): StudentPortalUnit {
  return {
    registrationId:
      'registration-1',
    unitId:
      'unit-1',
    unitCode:
      'NUT101',
    unitName:
      'Nutrition',
    registrationStatus,
    source:
      'department',
    registeredAt:
      '2026-08-21T00:00:00.000Z',
  };
}

describe('student portal domain', () => {
  it('treats department-created active units as pre-registered', () => {
    expect(
      deriveStudentRegistrationState(
        [
          unit(
            'registered',
          ),
        ],
        null,
      ),
    ).toBe(
      'pre_registered',
    );
  });

  it('shows verified legacy records as confirmed without restoring self-selection', () => {
    expect(
      deriveStudentRegistrationState(
        [
          unit(
            'registered',
          ),
        ],
        'verified',
      ),
    ).toBe(
      'confirmed',
    );

    expect(
      studentRegistrationLabel(
        'confirmed',
      ),
    ).toBe(
      'Confirmed',
    );
  });

  it('formats stage and timetable time compactly', () => {
    expect(
      studentStageLabel(
        3,
      ),
    ).toBe(
      'Y2S1',
    );

    expect(
      formatPortalClock(
        '14:00:00',
      ),
    ).toBe(
      '2:00 PM',
    );
  });

  it('keeps absence distinct from missing marks', () => {
    expect(
      studentResultDisplay({
        mark:
          null,
        maximumMark:
          50,
        resultStatus:
          'absent',
      }),
    ).toBe(
      'AB',
    );

    expect(
      studentResultDisplay({
        mark:
          null,
        maximumMark:
          50,
        resultStatus:
          'missing_mark',
      }),
    ).toBe(
      '—',
    );
  });
});
