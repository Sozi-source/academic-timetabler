import { describe, expect, it } from 'vitest';

import { assessSchedulingReadiness } from '@/features/scheduling-readiness/assessment';
import type { ReadinessOffering } from '@/features/scheduling-readiness/types';

function offering(overrides: Partial<ReadinessOffering> = {}): ReadinessOffering {
  return {
    id: 'offering-1',
    academicPeriodId: 'period-1',
    title: 'Community Nutrition',
    sharedClassKey: null,
    trainerId: 'trainer-1',
    trainerName: 'Trainer One',
    trainerStaffNumber: 'TR-001',
    trainerActive: true,
    trainerTimetableAvailable: true,
    trainerMaximumWeeklyHours: 20,
    preferredRoomId: 'room-1',
    preferredRoomName: 'Room One',
    preferredRoomCode: 'R1',
    preferredRoomType: 'classroom',
    preferredRoomCapacity: 50,
    preferredRoomActive: true,
    preferredRoomTimetableAvailable: true,
    deliveryMode: 'theory',
    weeklySessions: 2,
    sessionDurationMinutes: 120,
    status: 'active',
    isTimetableEnabled: true,
    participants: [
      {
        id: 'participant-1',
        cohortId: 'cohort-1',
        cohortCode: 'CND-SEP-26',
        cohortName: 'CND SEPT 26',
        cohortSize: 30,
        cohortStatus: 'active',
        cohortTimetableAvailable: true,
        unitId: 'unit-1',
        unitCode: 'CND 1101',
        unitName: 'Community Nutrition',
        unitActive: true,
        unitTimetableAvailable: true,
      },
    ],
    ...overrides,
  };
}

describe('assessSchedulingReadiness', () => {
  it('marks a fully configured period as ready', () => {
    const result = assessSchedulingReadiness({
      academicPeriodStatus: 'active',
      offerings: [offering()],
      workingDayCount: 5,
      teachingSlotCount: 4,
      availableTrainerCount: 2,
      availableRoomCount: 3,
    });

    expect(result.isReady).toBe(true);
    expect(result.blockerCount).toBe(0);
  });

  it('blocks generation when a trainer is missing', () => {
    const result = assessSchedulingReadiness({
      academicPeriodStatus: 'active',
      offerings: [offering({ trainerId: null, trainerName: null })],
      workingDayCount: 5,
      teachingSlotCount: 4,
      availableTrainerCount: 2,
      availableRoomCount: 3,
    });

    expect(result.isReady).toBe(false);
    expect(result.issues.some((entry) => entry.id === 'missing-trainers')).toBe(true);
  });

  it('blocks an undersized preferred room', () => {
    const result = assessSchedulingReadiness({
      academicPeriodStatus: 'active',
      offerings: [offering({ preferredRoomCapacity: 20 })],
      workingDayCount: 5,
      teachingSlotCount: 4,
      availableTrainerCount: 2,
      availableRoomCount: 3,
    });

    expect(result.issues.some((entry) => entry.id === 'undersized-rooms')).toBe(true);
  });

  it('detects trainer weekly overload', () => {
    const result = assessSchedulingReadiness({
      academicPeriodStatus: 'active',
      offerings: [offering({ weeklySessions: 6, trainerMaximumWeeklyHours: 8 })],
      workingDayCount: 5,
      teachingSlotCount: 4,
      availableTrainerCount: 2,
      availableRoomCount: 3,
    });

    expect(result.issues.some((entry) => entry.id === 'trainer-overload')).toBe(true);
  });
});
