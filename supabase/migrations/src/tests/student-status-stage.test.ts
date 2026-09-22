import { describe, expect, it } from 'vitest';

import {
  formatStudentStage,
  getStudentStatusLabel,
} from '@/features/students/student-status-stage';

describe('student status and stage display', () => {
  it.each([
    [1, 'Y1S1'],
    [2, 'Y1S2'],
    [3, 'Y1S3'],
    [4, 'Y2S1'],
    [5, 'Y2S2'],
    [6, 'Y2S3'],
    [7, 'Y3S1'],
    [8, 'Y3S2'],
    [9, 'Y3S3'],
  ])(
    'formats stage %i as %s',
    (stage, expected) => {
      expect(formatStudentStage(stage)).toBe(expected);
    },
  );

  it('uses the clear activity/lifecycle status', () => {
    expect(
      getStudentStatusLabel('active', 'in_class'),
    ).toBe('In class');

    expect(
      getStudentStatusLabel('active', 'attachment'),
    ).toBe('On attachment');

    expect(
      getStudentStatusLabel(
        'active',
        'clinical_rotation',
      ),
    ).toBe('Clinical rotation');

    expect(
      getStudentStatusLabel(
        'completed',
        'awaiting_graduation',
      ),
    ).toBe('Awaiting graduation');

    expect(
      getStudentStatusLabel('graduated', 'graduated'),
    ).toBe('Graduated');
  });
});
