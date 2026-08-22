import { describe, expect, it } from 'vitest';
import {
  deriveStudentRegistrationState,
  formatPortalClock,
  studentRegistrationLabel,
  studentResultDisplay,
  studentStageLabel,
} from '@/features/student-portal/domain';
import type { StudentPortalUnit } from '@/features/student-portal/types';

describe('Student Portal Edge Cases & Isolation', () => {
  it('correctly categorizes registration states without student self-selection', () => {
    const unassignedUnits: StudentPortalUnit[] = [];
    expect(deriveStudentRegistrationState(unassignedUnits, null)).toBe('not_registered');

    const preRegUnits: StudentPortalUnit[] = [
      {
        registrationId: 'r1',
        unitId: 'u1',
        unitCode: 'NUTR 101',
        unitName: 'Basic Nutrition',
        registrationStatus: 'registered',
        source: 'department',
        registeredAt: '2026-08-21T00:00:00Z',
      },
    ];
    expect(deriveStudentRegistrationState(preRegUnits, null)).toBe('pre_registered');
    expect(studentRegistrationLabel('pre_registered')).toBe('Pre-registered');

    expect(deriveStudentRegistrationState(preRegUnits, 'verified')).toBe('confirmed');
    expect(studentRegistrationLabel('confirmed')).toBe('Confirmed');

    const droppedUnits: StudentPortalUnit[] = [
      {
        registrationId: 'r2',
        unitId: 'u2',
        unitCode: 'NUTR 102',
        unitName: 'Clinical Chemistry',
        registrationStatus: 'dropped',
        source: 'department',
        registeredAt: '2026-08-21T00:00:00Z',
      },
    ];
    expect(deriveStudentRegistrationState(droppedUnits, null)).toBe('deregistered');
    expect(studentRegistrationLabel('deregistered')).toBe('Deregistered');
  });

  it('formats timetable sessions accurately across 12-hour AM/PM clocks', () => {
    expect(formatPortalClock('08:00:00')).toBe('8:00 AM');
    expect(formatPortalClock('10:30:00')).toBe('10:30 AM');
    expect(formatPortalClock('12:00:00')).toBe('12:00 PM');
    expect(formatPortalClock('14:00:00')).toBe('2:00 PM');
    expect(formatPortalClock('16:00:00')).toBe('4:00 PM');
  });

  it('handles academic period stage labels for varying programme durations', () => {
    expect(studentStageLabel(1)).toBe('Y1S1');
    expect(studentStageLabel(2)).toBe('Y1S2');
    expect(studentStageLabel(3)).toBe('Y2S1');
    expect(studentStageLabel(4)).toBe('Y2S2');
    expect(studentStageLabel(5)).toBe('Y3S1');
    expect(studentStageLabel(6)).toBe('Y3S2');
    expect(studentStageLabel(null)).toBe('Stage unavailable');
  });

  it('keeps absence (AB) separate from null/missing marks in student result display', () => {
    const satResult = studentResultDisplay({
      mark: 85,
      isAbsent: false,
      grade: 'A',
    });
    expect(satResult.text).toBe('85');
    expect(satResult.variant).toBe('success');

    const absentResult = studentResultDisplay({
      mark: null,
      isAbsent: true,
      grade: 'AB',
    });
    expect(absentResult.text).toBe('AB');
    expect(absentResult.variant).toBe('danger');

    const pendingResult = studentResultDisplay({
      mark: null,
      isAbsent: false,
      grade: null,
    });
    expect(pendingResult.text).toBe('Pending');
    expect(pendingResult.variant).toBe('neutral');
  });
});
