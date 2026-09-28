import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  ExistingScheduledSessionRow,
  GeneratorActionState,
  GeneratorPreview,
} from '@/features/timetable-generator';

describe(
  'timetable generator server contracts',
  () => {
    it(
      'represents an existing scheduled session row',
      () => {
        const row:
        ExistingScheduledSessionRow = {
          id: 'session-1',
          academic_period_id:
            'period-1',
          teaching_allocation_id:
            'allocation-1',
          cohort_id: 'cohort-1',
          unit_id: 'unit-1',
          trainer_id: 'trainer-1',
          working_day_id: 'day-1',
          start_time_slot_id:
            'slot-1',
          end_time_slot_id:
            'slot-2',
          room_id: 'room-1',
          session_number: 1,
          delivery_mode: 'theory',
          status: 'locked',
          source: 'manual',
          conflict_state: 'clear',
          is_locked: true,
          participant_cohort_ids: ['cohort-1'],
          combined_cohort_size: 30,
          notes: null,
          created_at:
            '2026-08-02T08:00:00.000Z',
          updated_at:
            '2026-08-02T08:00:00.000Z',
        };

        expect(row.is_locked).toBe(
          true,
        );

        expect(row.status).toBe(
          'locked',
        );
      },
    );

    it(
      'allows a successful preview action state',
      () => {
        const preview:
        GeneratorPreview = {
          academicPeriod: {
            id: 'period-1',
            code: '2026-S2',
            name: 'Semester 2',
            status: 'active',
            startsOn: '2026-05-01',
            endsOn: '2026-08-31',
            teachingStartsOn:
              '2026-05-04',
            teachingEndsOn:
              '2026-08-21',
          },
          readiness: {
            allocationCount: 1,
            workingDayCount: 5,
            teachingSlotCount: 8,
            trainerCount: 1,
            cohortCount: 1,
            roomCount: 1,
            unitCount: 1,
            existingSessionCount: 0,
            isReady: true,
            issues: [],
          },
          sessions: [],
          workingDays: [],
          teachingSlots: [],
          unscheduled: [],
          conflicts: [],
          statistics: {
            allocationCount: 1,
            requestedSessionCount: 1,
            scheduledSessionCount: 1,
            unscheduledSessionCount: 0,
            conflictCount: 0,
            blockedConflictCount: 0,
            warningCount: 0,
            trainerUtilizationPercentage:
              8.3,
            roomUtilizationPercentage:
              2.5,
            generationDurationMilliseconds:
              12,
          },
          generatedAt:
            '2026-08-02T08:00:00.000Z',
        };

        const state:
        GeneratorActionState = {
          status: 'success',
          message:
            'Timetable preview generated.',
          preview,
        };

        expect(state.status).toBe(
          'success',
        );

        expect(
          state.preview?.readiness.isReady,
        ).toBe(true);
      },
    );
  },
);
